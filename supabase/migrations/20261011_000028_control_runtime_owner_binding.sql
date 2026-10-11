begin;

-- Browser control runtime captures the authenticated owner before starting
-- heartbeat/command work. Bind that owner at the database edge so an auth
-- switch cannot combine stale runtime state with a newer account token.
-- Direct-browser wrappers deliberately reject OAuth-shaped sessions.
-- Existing command tool names, capabilities and payload shapes remain intact.

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

-- Do not recycle an executing command. A browser that disappears after claim
-- leaves the command fenced in `executing` until its hard TTL expires. This is
-- deliberately conservative: requeueing a merely slow action can duplicate
-- navigation or start_task side effects across tabs. get_action_status below
-- exposes an expired executing command as terminal `effectiveStatus=expired`.
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

-- Preserve the generic direct-browser finish signature for compatibility, but
-- reject late completion after the command TTL. This prevents an old/cached
-- browser runtime from turning an already-expired execution back into success.
create or replace function public.finish_website_command(
  p_command_id uuid,
  p_device_id uuid,
  p_success boolean,
  p_result jsonb default '{}'::jsonb,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.website_commands%rowtype;
  v_error_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 16384 then
    raise exception 'invalid_command_result' using errcode = '22023';
  end if;

  v_error_code := case when p_success then null else coalesce(nullif(p_error_code, ''), 'execution_failed') end;
  if v_error_code is not null and (char_length(v_error_code) > 100 or v_error_code !~ '^[A-Za-z0-9._:-]+$') then
    raise exception 'invalid_error_code' using errcode = '22023';
  end if;

  -- SELECT ... FOR UPDATE is subject to the runtime UPDATE RLS policy.
  -- Set the executor guard before locking, preserving the 000018 hardening.
  perform set_config('wenyan.command_executor_rpc', '1', true);

  select * into v_row
  from public.website_commands as c
  where c.id = p_command_id
    and c.user_id = v_user_id
    and c.target_device_id = p_device_id
  for update;

  if not found then
    raise exception 'command_not_found' using errcode = '22023';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'command_expired' using errcode = '55000';
  end if;
  if v_row.status <> 'executing' then
    raise exception 'command_not_executing' using errcode = '55000';
  end if;

  update public.website_commands
  set status = case when p_success then 'completed' else 'failed' end,
      result = p_result,
      error_code = v_error_code,
      completed_at = now(),
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'result', v_row.result,
    'errorCode', v_row.error_code,
    'completedAt', v_row.completed_at
  );
end;
$$;


-- Keep idempotent OAuth enqueue receipts consistent with get_action_status:
-- an executing command whose hard TTL elapsed is terminally expired too.
create or replace function public.enqueue_website_command(
  p_request_id text,
  p_command_type text,
  p_args jsonb default '{}'::jsonb,
  p_target_device_id uuid default null,
  p_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_device_id uuid;
  v_existing public.website_commands%rowtype;
  v_row public.website_commands%rowtype;
  v_capability text;
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
begin
  if v_user_id is null or v_client_id is null then
    raise exception 'oauth_client_required' using errcode = '42501';
  end if;
  if p_request_id is null
     or char_length(p_request_id) not between 8 and 120
     or p_request_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_command_type not in ('open_today', 'open_dictionary', 'open_chapter', 'start_task')
     or p_args is null
     or jsonb_typeof(p_args) <> 'object' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if p_ttl_seconds not between 30 and 600 then
    raise exception 'invalid_command_ttl' using errcode = '22023';
  end if;

  if p_command_type = 'open_today' then
    if p_args <> '{}'::jsonb then
      raise exception 'invalid_command_args' using errcode = '22023';
    end if;
    v_capability := 'navigation:control';
  elsif p_command_type = 'open_dictionary' then
    if char_length(coalesce(p_args ->> 'dictId', '')) not between 1 and 100 then
      raise exception 'invalid_command_args' using errcode = '22023';
    end if;
    v_capability := 'navigation:control';
  elsif p_command_type = 'open_chapter' then
    if char_length(coalesce(p_args ->> 'dictId', '')) not between 1 and 100
       or coalesce(p_args ->> 'chapterIndex', '') !~ '^[0-9]+$' then
      raise exception 'invalid_command_args' using errcode = '22023';
    end if;
    v_capability := 'navigation:control';
  else
    if coalesce(p_args ->> 'planId', '') !~ v_uuid_pattern
       or coalesce(p_args ->> 'taskId', '') !~ v_uuid_pattern then
      raise exception 'invalid_command_args' using errcode = '22023';
    end if;
    v_capability := 'session:control';
  end if;

  if not public.wenyan_has_oauth_capability(v_capability) then
    raise exception 'command_control_not_granted' using errcode = '42501';
  end if;

  select * into v_existing
  from public.website_commands as c
  where c.user_id = v_user_id
    and c.client_id = v_client_id
    and c.request_id = p_request_id;

  if found then
    if v_existing.command_type <> p_command_type
       or v_existing.args <> p_args
       or (p_target_device_id is not null and v_existing.target_device_id <> p_target_device_id) then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'id', v_existing.id,
      'type', v_existing.command_type,
      'targetDeviceId', v_existing.target_device_id,
      'status', v_existing.status,
      'effectiveStatus', case
        when v_existing.status in ('pending', 'executing') and v_existing.expires_at <= now() then 'expired'
        else v_existing.status
      end,
      'createdAt', v_existing.created_at,
      'expiresAt', v_existing.expires_at
    );
  end if;

  if p_target_device_id is not null then
    select d.id into v_device_id
    from public.wenyan_devices as d
    where d.id = p_target_device_id
      and d.user_id = v_user_id
      and d.last_seen_at > now() - interval '120 seconds';
  else
    select d.id into v_device_id
    from public.wenyan_devices as d
    where d.user_id = v_user_id
      and d.last_seen_at > now() - interval '120 seconds'
    order by d.last_seen_at desc
    limit 1;
  end if;

  if v_device_id is null then
    raise exception 'no_active_device' using errcode = '55000';
  end if;

  perform set_config('wenyan.command_write_rpc', '1', true);

  insert into public.website_commands (
    user_id, client_id, request_id, command_type, args, target_device_id, expires_at
  ) values (
    v_user_id, v_client_id, p_request_id, p_command_type, p_args, v_device_id,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'type', v_row.command_type,
    'targetDeviceId', v_row.target_device_id,
    'status', v_row.status,
    'effectiveStatus', v_row.status,
    'createdAt', v_row.created_at,
    'expiresAt', v_row.expires_at
  );
end;
$$;

-- Keep the public status payload stable, but never make callers wait forever
-- on a command whose TTL elapsed after it had already been claimed.
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
