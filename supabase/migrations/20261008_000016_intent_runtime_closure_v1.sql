begin;

create table public.learning_intent_session_bindings (
  intent_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_revision integer not null,
  session_id text not null,
  bound_at timestamptz not null default now(),
  primary key (intent_id, intent_revision),
  constraint learning_intent_session_bindings_owner_fk
    foreign key (intent_id, user_id)
    references public.learning_intents(id, user_id)
    on delete cascade,
  constraint learning_intent_session_bindings_revision_positive check (intent_revision > 0),
  constraint learning_intent_session_bindings_session_length check (char_length(session_id) between 8 and 120),
  unique (user_id, session_id)
);

create index learning_intent_session_bindings_user_bound_idx
  on public.learning_intent_session_bindings (user_id, bound_at desc);

alter table public.learning_intent_session_bindings enable row level security;
revoke all on table public.learning_intent_session_bindings from public, anon, authenticated;
grant select, insert on table public.learning_intent_session_bindings to authenticated;

create policy "learning_intent_session_bindings_select_own"
  on public.learning_intent_session_bindings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "learning_intent_session_bindings_insert_via_rpc"
  on public.learning_intent_session_bindings
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt()) ->> 'client_id', '') is null
    and (select current_setting('wenyan.session_intent_bind_rpc', true)) = '1'
  );

create or replace function public.wenyan_learning_intent_snapshot(p_intent_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'id', i.id,
    'scope', i.scope,
    'timezone', i.timezone,
    'status', i.status,
    'revision', i.revision,
    'effectiveFrom', i.effective_from,
    'expiresAt', i.expires_at,
    'constraints', i.constraints,
    'goals', i.goals,
    'rationale', i.rationale,
    'source', i.source,
    'boundSessionId', b.session_id,
    'boundAt', b.bound_at,
    'createdByClientId', i.created_by_client_id,
    'updatedByClientId', i.updated_by_client_id,
    'createdAt', i.created_at,
    'updatedAt', i.updated_at
  )
  from public.learning_intents as i
  left join public.learning_intent_session_bindings as b
    on b.intent_id = i.id
   and b.user_id = i.user_id
   and b.intent_revision = i.revision
  where i.id = p_intent_id
    and i.user_id = (select auth.uid());
$$;

create or replace function public.get_learning_intents()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if v_client_id is not null
     and not (
       public.wenyan_has_oauth_capability('plans:read')
       or public.wenyan_has_oauth_capability('coach:auto_adjust')
     ) then
    raise exception 'intent_read_not_granted' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      public.wenyan_learning_intent_snapshot(i.id)
      order by case i.scope when 'session' then 3 when 'day' then 2 else 1 end, i.updated_at
    ),
    '[]'::jsonb
  )
  into v_result
  from public.learning_intents as i
  where i.user_id = v_user_id
    and i.status = 'active'
    and i.effective_from <= now()
    and (i.expires_at is null or i.expires_at > now())
    and (
      i.scope <> 'day'
      or (now() at time zone i.timezone)::date = (i.effective_from at time zone i.timezone)::date
    );

  return v_result;
end;
$$;

create or replace function public.bind_learning_session_intent(
  p_intent_id uuid,
  p_expected_revision integer,
  p_session_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_intent public.learning_intents%rowtype;
  v_existing public.learning_intent_session_bindings%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if v_client_id is not null then
    raise exception 'first_party_session_required' using errcode = '42501';
  end if;
  if p_intent_id is null then
    raise exception 'invalid_intent_id' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'invalid_expected_revision' using errcode = '22023';
  end if;
  if p_session_id is null or char_length(p_session_id) not between 8 and 120 then
    raise exception 'invalid_session_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':learning-intent-bind:' || p_intent_id::text, 0)
  );

  select * into v_intent
  from public.learning_intents as i
  where i.id = p_intent_id
    and i.user_id = v_user_id
  for update;

  if not found or v_intent.scope <> 'session' then
    raise exception 'session_intent_not_found' using errcode = '22023';
  end if;
  if v_intent.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  if v_intent.status <> 'active'
     or v_intent.effective_from > now()
     or v_intent.expires_at is null
     or v_intent.expires_at <= now() then
    raise exception 'session_intent_not_active' using errcode = '22023';
  end if;

  select * into v_existing
  from public.learning_intent_session_bindings as b
  where b.intent_id = v_intent.id
    and b.intent_revision = v_intent.revision;

  if found then
    if v_existing.user_id = v_user_id and v_existing.session_id = p_session_id then
      return public.wenyan_learning_intent_snapshot(v_intent.id);
    end if;
    raise exception 'session_intent_already_bound' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.learning_intent_session_bindings as b
    where b.user_id = v_user_id
      and b.session_id = p_session_id
      and (b.intent_id <> v_intent.id or b.intent_revision <> v_intent.revision)
  ) then
    raise exception 'session_binding_conflict' using errcode = '23505';
  end if;

  perform set_config('wenyan.session_intent_bind_rpc', '1', true);

  insert into public.learning_intent_session_bindings (
    intent_id, user_id, intent_revision, session_id
  ) values (
    v_intent.id, v_user_id, v_intent.revision, p_session_id
  );

  return public.wenyan_learning_intent_snapshot(v_intent.id);
end;
$$;

revoke all on function public.wenyan_learning_intent_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.get_learning_intents() from public, anon, authenticated;
revoke all on function public.bind_learning_session_intent(uuid, integer, text) from public, anon, authenticated;

grant execute on function public.wenyan_learning_intent_snapshot(uuid) to authenticated;
grant execute on function public.get_learning_intents() to authenticated;
grant execute on function public.bind_learning_session_intent(uuid, integer, text) to authenticated;

commit;
