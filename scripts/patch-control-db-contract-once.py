from pathlib import Path

path = Path('supabase/migrations/20261011_000028_control_runtime_owner_binding.sql')
text = path.read_text()

old_guard = """  if v_error_code is not null and (char_length(v_error_code) > 100 or v_error_code !~ '^[A-Za-z0-9._:-]+$') then
    raise exception 'invalid_error_code' using errcode = '22023';
  end if;

  select * into v_row
"""
new_guard = """  if v_error_code is not null and (char_length(v_error_code) > 100 or v_error_code !~ '^[A-Za-z0-9._:-]+$') then
    raise exception 'invalid_error_code' using errcode = '22023';
  end if;

  -- SELECT ... FOR UPDATE is subject to the runtime UPDATE RLS policy.
  -- Set the executor guard before locking, preserving the 000018 hardening.
  perform set_config('wenyan.command_executor_rpc', '1', true);

  select * into v_row
"""
assert old_guard in text
text = text.replace(old_guard, new_guard, 1)

old_late_guard = """  if v_row.status <> 'executing' then
    raise exception 'command_not_executing' using errcode = '55000';
  end if;

  perform set_config('wenyan.command_executor_rpc', '1', true);
  update public.website_commands
"""
new_late_guard = """  if v_row.status <> 'executing' then
    raise exception 'command_not_executing' using errcode = '55000';
  end if;

  update public.website_commands
"""
assert old_late_guard in text
text = text.replace(old_late_guard, new_late_guard, 1)

enqueue_function = r'''
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

'''
marker = "-- Keep the public status payload stable, but never make callers wait forever\n"
assert marker in text
text = text.replace(marker, enqueue_function + marker, 1)
path.write_text(text)
