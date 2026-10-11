begin;

-- Browser reads/writes capture an authenticated owner before RPC execution.
-- These wrappers bind that captured owner to execution-time auth.uid() and
-- reject OAuth clients. Existing generic RPCs remain unchanged for MCP/OAuth.

create or replace function public.get_plan_status_for_owner(
  p_expected_user_id uuid,
  p_plan_id uuid default null
)
returns jsonb
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
    raise exception 'browser_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.get_plan_status(p_plan_id);
end;
$$;

create or replace function public.get_learning_preferences_for_owner(
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
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_user_id then
    raise exception 'browser_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.get_learning_preferences();
end;
$$;

create or replace function public.confirm_learning_stage_for_owner(
  p_expected_user_id uuid,
  p_request_id text,
  p_stage text,
  p_expected_revision integer,
  p_change_reason text default ''
)
returns jsonb
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
    raise exception 'browser_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.confirm_learning_stage(
    p_request_id,
    p_stage,
    p_expected_revision,
    p_change_reason
  );
end;
$$;

revoke all on function public.get_plan_status_for_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_plan_status_for_owner(uuid, uuid) to authenticated;

revoke all on function public.get_learning_preferences_for_owner(uuid) from public, anon, authenticated;
grant execute on function public.get_learning_preferences_for_owner(uuid) to authenticated;

revoke all on function public.confirm_learning_stage_for_owner(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_learning_stage_for_owner(uuid, text, text, integer, text) to authenticated;

commit;
