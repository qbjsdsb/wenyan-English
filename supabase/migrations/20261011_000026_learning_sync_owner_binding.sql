begin;

-- Browser learning sync captures an owner before reading the local queue/cursor.
-- Bind that owner to the database request so a token/account switch between
-- capture and RPC execution cannot write or return another account's facts.
-- Existing generic RPCs remain available during rollout; the web client moves
-- to these browser-only wrappers without changing MCP/OAuth read contracts.

create or replace function public.ingest_learning_events_for_owner(
  p_expected_user_id uuid,
  p_events jsonb
)
returns integer
language plpgsql
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
    raise exception 'learning_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.ingest_learning_events(p_events);
end;
$$;

create or replace function public.pull_learning_events_for_owner(
  p_expected_user_id uuid,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  event_type text,
  occurred_at timestamptz,
  source text,
  source_version integer,
  payload jsonb,
  created_at timestamptz
)
language plpgsql
stable
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
    raise exception 'learning_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return query
  select *
  from public.pull_learning_events(p_after_created_at, p_after_id, p_limit);
end;
$$;

revoke all on function public.ingest_learning_events_for_owner(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_learning_events_for_owner(uuid, jsonb) to authenticated;

revoke all on function public.pull_learning_events_for_owner(uuid, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.pull_learning_events_for_owner(uuid, timestamptz, uuid, integer) to authenticated;

commit;
