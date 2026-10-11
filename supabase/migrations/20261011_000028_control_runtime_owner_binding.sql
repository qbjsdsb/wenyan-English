begin;

-- Browser control runtime captures the authenticated owner before starting
-- heartbeat/command work. Bind that owner at the database edge so an auth
-- switch cannot combine stale runtime state with a newer account token.
-- Generic RPCs remain unchanged for compatibility; these wrappers are direct-
-- browser only and deliberately reject OAuth-shaped sessions.

create or replace function public.upsert_wenyan_device_for_owner(
  p_expected_user_id uuid,
  p_device_id uuid,
  p_device_name text,
  p_platform text,
  p_current_path text,
  p_current_dict_id text default null,
  p_current_chapter integer default null,
  p_practice_mode text default 'learn',
  p_active_task_run_id text default null
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
    raise exception 'control_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.upsert_wenyan_device(
    p_device_id,
    p_device_name,
    p_platform,
    p_current_path,
    p_current_dict_id,
    p_current_chapter,
    p_practice_mode,
    p_active_task_run_id
  );
end;
$$;

create or replace function public.get_pending_website_commands_for_owner(
  p_expected_user_id uuid,
  p_device_id uuid
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
    raise exception 'control_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.get_pending_website_commands(p_device_id);
end;
$$;

create or replace function public.claim_website_command_for_owner(
  p_expected_user_id uuid,
  p_command_id uuid,
  p_device_id uuid
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
    raise exception 'control_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.claim_website_command(p_command_id, p_device_id);
end;
$$;

create or replace function public.finish_website_command_for_owner(
  p_expected_user_id uuid,
  p_command_id uuid,
  p_device_id uuid,
  p_success boolean,
  p_result jsonb,
  p_error_code text default null
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
    raise exception 'control_owner_changed' using errcode = '42501';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  return public.finish_website_command(
    p_command_id,
    p_device_id,
    p_success,
    p_result,
    p_error_code
  );
end;
$$;

revoke all on function public.upsert_wenyan_device_for_owner(uuid, uuid, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.upsert_wenyan_device_for_owner(uuid, uuid, text, text, text, text, integer, text, text) to authenticated;

revoke all on function public.get_pending_website_commands_for_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_pending_website_commands_for_owner(uuid, uuid) to authenticated;

revoke all on function public.claim_website_command_for_owner(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_website_command_for_owner(uuid, uuid, uuid) to authenticated;

revoke all on function public.finish_website_command_for_owner(uuid, uuid, uuid, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.finish_website_command_for_owner(uuid, uuid, uuid, boolean, jsonb, text) to authenticated;

commit;
