begin;

-- Browser control runtime captures the authenticated owner before starting
-- heartbeat/command work. Bind that owner at the database edge so an auth
-- switch cannot combine stale runtime state with a newer account token.
-- Direct-browser wrappers deliberately reject OAuth-shaped sessions.
-- Existing command tool names, capabilities and payload shapes remain intact;
-- status reporting additionally treats expired executing leases as expired.

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

-- A claimed command is a lease, not a permanent state. If the browser that
-- claimed it disappears (including an account switch), the same owner/device
-- may recover it after 120 seconds while the command TTL is still valid.
create or replace function public.get_pending_website_commands_for_owner(
  p_expected_user_id uuid,
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
  if not exists (
    select 1
    from public.wenyan_devices as d
    where d.id = p_device_id and d.user_id = v_user_id
  ) then
    raise exception 'device_not_found' using errcode = '22023';
  end if;

  perform set_config('wenyan.command_executor_rpc', '1', true);
  update public.website_commands as c
  set status = 'pending',
      started_at = null,
      updated_at = now()
  where c.user_id = v_user_id
    and c.target_device_id = p_device_id
    and c.status = 'executing'
    and c.started_at is not null
    and c.started_at <= now() - interval '120 seconds'
    and c.expires_at > now();

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

-- Keep the public status payload stable, but never make callers wait forever
-- on a command whose TTL already elapsed after it had been claimed.
create or replace function public.get_action_status(p_command_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_row public.website_commands%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if v_client_id is not null
     and not (
       public.wenyan_has_oauth_capability('navigation:control')
       or public.wenyan_has_oauth_capability('session:control')
     ) then
    raise exception 'command_read_not_granted' using errcode = '42501';
  end if;

  select * into v_row
  from public.website_commands as c
  where c.id = p_command_id
    and c.user_id = v_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'type', v_row.command_type,
    'targetDeviceId', v_row.target_device_id,
    'status', v_row.status,
    'effectiveStatus', case
      when v_row.status in ('pending', 'executing') and v_row.expires_at <= now() then 'expired'
      else v_row.status
    end,
    'result', v_row.result,
    'errorCode', v_row.error_code,
    'createdAt', v_row.created_at,
    'expiresAt', v_row.expires_at,
    'startedAt', v_row.started_at,
    'completedAt', v_row.completed_at
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
