begin;

create or replace function public.claim_website_command(
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
  v_row public.website_commands%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.wenyan_devices as d
    where d.id = p_device_id and d.user_id = v_user_id
  ) then
    raise exception 'device_not_found' using errcode = '22023';
  end if;

  -- SELECT ... FOR UPDATE is an update-intent read and is subject to the UPDATE
  -- RLS policy. Set the executor guard before locking the row, not afterwards.
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
  if v_row.status <> 'pending' then
    raise exception 'command_not_pending' using errcode = '55000';
  end if;

  update public.website_commands
  set status = 'executing', started_at = now(), updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'type', v_row.command_type,
    'args', v_row.args,
    'targetDeviceId', v_row.target_device_id,
    'status', v_row.status,
    'expiresAt', v_row.expires_at
  );
end;
$$;

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

  -- As above, the row lock itself must pass the UPDATE RLS policy.
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

revoke all on function public.claim_website_command(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_website_command(uuid, uuid, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_website_command(uuid, uuid) to authenticated;
grant execute on function public.finish_website_command(uuid, uuid, boolean, jsonb, text) to authenticated;

commit;
