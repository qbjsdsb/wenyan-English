-- Durable cross-device workspace state is intentionally separate from immutable
-- learning facts and from long-term coaching preferences. v1 is explicit/manual:
-- the browser can publish its current study position or restore the cloud copy.

create table if not exists public.wenyan_workspace_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  dict_id text not null check (char_length(dict_id) between 1 and 80),
  chapter_index integer not null check (chapter_index between 0 and 9999),
  practice_mode text not null check (practice_mode in ('spelling', 'recall', 'discrimination')),
  practice_pool text not null check (practice_pool in ('chapter', 'learned', 'errors', 'uncertain')),
  practice_limit integer not null check (practice_limit in (6, 12)),
  updated_at timestamptz not null default now()
);

alter table public.wenyan_workspace_state enable row level security;

revoke all on table public.wenyan_workspace_state from public, anon, authenticated;
grant select, insert, update on table public.wenyan_workspace_state to authenticated;

drop policy if exists wenyan_workspace_state_select_own_browser on public.wenyan_workspace_state;
create policy wenyan_workspace_state_select_own_browser
  on public.wenyan_workspace_state
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt()) ->> 'client_id', '') is null
  );

drop policy if exists wenyan_workspace_state_insert_own_browser on public.wenyan_workspace_state;
create policy wenyan_workspace_state_insert_own_browser
  on public.wenyan_workspace_state
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt()) ->> 'client_id', '') is null
  );

drop policy if exists wenyan_workspace_state_update_own_browser on public.wenyan_workspace_state;
create policy wenyan_workspace_state_update_own_browser
  on public.wenyan_workspace_state
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt()) ->> 'client_id', '') is null
  )
  with check (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt()) ->> 'client_id', '') is null
  );

create or replace function public.get_wenyan_workspace_state(
  p_expected_user_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.wenyan_workspace_state%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_user_id then
    raise exception 'workspace_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'workspace_state_browser_only' using errcode = '42501';
  end if;

  select * into v_row
  from public.wenyan_workspace_state
  where user_id = v_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'schemaVersion', v_row.schema_version,
    'dictId', v_row.dict_id,
    'chapterIndex', v_row.chapter_index,
    'practiceMode', v_row.practice_mode,
    'practicePool', v_row.practice_pool,
    'practiceLimit', v_row.practice_limit,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.save_wenyan_workspace_state(
  p_expected_user_id uuid,
  p_dict_id text,
  p_chapter_index integer,
  p_practice_mode text,
  p_practice_pool text,
  p_practice_limit integer
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_user_id then
    raise exception 'workspace_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'workspace_state_browser_only' using errcode = '42501';
  end if;
  if p_dict_id is null or char_length(p_dict_id) not between 1 and 80
     or p_chapter_index is null or p_chapter_index not between 0 and 9999
     or p_practice_mode is null or p_practice_mode not in ('spelling', 'recall', 'discrimination')
     or p_practice_pool is null or p_practice_pool not in ('chapter', 'learned', 'errors', 'uncertain')
     or p_practice_limit is null or p_practice_limit not in (6, 12) then
    raise exception 'invalid_workspace_state' using errcode = '22023';
  end if;

  insert into public.wenyan_workspace_state (
    user_id,
    schema_version,
    dict_id,
    chapter_index,
    practice_mode,
    practice_pool,
    practice_limit,
    updated_at
  ) values (
    v_user_id,
    1,
    p_dict_id,
    p_chapter_index,
    p_practice_mode,
    p_practice_pool,
    p_practice_limit,
    now()
  )
  on conflict (user_id) do update set
    schema_version = excluded.schema_version,
    dict_id = excluded.dict_id,
    chapter_index = excluded.chapter_index,
    practice_mode = excluded.practice_mode,
    practice_pool = excluded.practice_pool,
    practice_limit = excluded.practice_limit,
    updated_at = now();

  return public.get_wenyan_workspace_state(v_user_id);
end;
$$;

revoke all on function public.get_wenyan_workspace_state(uuid) from public, anon, authenticated;
grant execute on function public.get_wenyan_workspace_state(uuid) to authenticated;

revoke all on function public.save_wenyan_workspace_state(uuid, text, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.save_wenyan_workspace_state(uuid, text, integer, text, text, integer) to authenticated;
