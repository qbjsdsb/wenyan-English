begin;

create table public.wenyan_devices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default 'Wenyan Web',
  platform text not null default 'web',
  current_path text not null default '/',
  current_dict_id text,
  current_chapter integer,
  practice_mode text not null default 'learn',
  active_task_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint wenyan_devices_name_length check (char_length(device_name) between 1 and 120),
  constraint wenyan_devices_platform_length check (char_length(platform) between 1 and 240),
  constraint wenyan_devices_path_length check (char_length(current_path) between 1 and 500),
  constraint wenyan_devices_dict_length check (current_dict_id is null or char_length(current_dict_id) between 1 and 100),
  constraint wenyan_devices_chapter_valid check (current_chapter is null or current_chapter >= 0),
  constraint wenyan_devices_mode_valid check (practice_mode in ('learn', 'dictation', 'review')),
  constraint wenyan_devices_task_run_length check (active_task_run_id is null or char_length(active_task_run_id) between 1 and 120),
  unique (user_id, id)
);

create index wenyan_devices_user_seen_idx
  on public.wenyan_devices (user_id, last_seen_at desc);

create table public.website_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  request_id text not null,
  command_type text not null,
  args jsonb not null default '{}'::jsonb,
  target_device_id uuid not null references public.wenyan_devices(id),
  status text not null default 'pending',
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  constraint website_commands_client_length check (char_length(client_id) between 1 and 200),
  constraint website_commands_request_length check (char_length(request_id) between 8 and 120),
  constraint website_commands_type_valid check (command_type in ('open_today', 'open_dictionary', 'open_chapter', 'start_task')),
  constraint website_commands_args_object check (jsonb_typeof(args) = 'object'),
  constraint website_commands_status_valid check (status in ('pending', 'executing', 'completed', 'failed', 'cancelled')),
  constraint website_commands_result_object check (result is null or jsonb_typeof(result) = 'object'),
  constraint website_commands_error_length check (error_code is null or char_length(error_code) between 1 and 100),
  constraint website_commands_expiry_after_create check (expires_at > created_at),
  unique (user_id, client_id, request_id)
);

create index website_commands_user_created_idx
  on public.website_commands (user_id, created_at desc);
create index website_commands_target_pending_idx
  on public.website_commands (target_device_id, created_at)
  where status = 'pending';

alter table public.wenyan_devices enable row level security;
alter table public.website_commands enable row level security;

revoke all on table public.wenyan_devices from public, anon, authenticated;
revoke all on table public.website_commands from public, anon, authenticated;
grant select, insert, update on table public.wenyan_devices to authenticated;
grant select, insert, update on table public.website_commands to authenticated;

drop policy if exists "wenyan_devices_select_own" on public.wenyan_devices;
create policy "wenyan_devices_select_own"
  on public.wenyan_devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "wenyan_devices_insert_runtime" on public.wenyan_devices;
create policy "wenyan_devices_insert_runtime"
  on public.wenyan_devices
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.device_runtime_rpc', true)) = '1'
  );

drop policy if exists "wenyan_devices_update_runtime" on public.wenyan_devices;
create policy "wenyan_devices_update_runtime"
  on public.wenyan_devices
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.device_runtime_rpc', true)) = '1'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.device_runtime_rpc', true)) = '1'
  );

drop policy if exists "website_commands_select_own" on public.website_commands;
create policy "website_commands_select_own"
  on public.website_commands
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "website_commands_insert_oauth_rpc" on public.website_commands;
create policy "website_commands_insert_oauth_rpc"
  on public.website_commands
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and client_id = ((select auth.jwt()) ->> 'client_id')
    and client_id is not null
    and (select current_setting('wenyan.command_write_rpc', true)) = '1'
    and exists (
      select 1
      from public.wenyan_devices as d
      where d.id = target_device_id
        and d.user_id = user_id
    )
    and (
      (command_type in ('open_today', 'open_dictionary', 'open_chapter') and public.wenyan_has_oauth_capability('navigation:control'))
      or (command_type = 'start_task' and public.wenyan_has_oauth_capability('session:control'))
    )
  );

drop policy if exists "website_commands_update_runtime" on public.website_commands;
create policy "website_commands_update_runtime"
  on public.website_commands
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.command_executor_rpc', true)) = '1'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.command_executor_rpc', true)) = '1'
  );

create or replace function public.upsert_wenyan_device(
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
  v_row public.wenyan_devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;
  if p_device_id is null
     or char_length(coalesce(btrim(p_device_name), '')) not between 1 and 120
     or char_length(coalesce(btrim(p_platform), '')) not between 1 and 240
     or char_length(coalesce(p_current_path, '')) not between 1 and 500
     or (p_current_dict_id is not null and char_length(p_current_dict_id) not between 1 and 100)
     or (p_current_chapter is not null and p_current_chapter < 0)
     or p_practice_mode not in ('learn', 'dictation', 'review')
     or (p_active_task_run_id is not null and char_length(p_active_task_run_id) not between 1 and 120) then
    raise exception 'invalid_device_state' using errcode = '22023';
  end if;

  perform set_config('wenyan.device_runtime_rpc', '1', true);

  insert into public.wenyan_devices (
    id, user_id, device_name, platform, current_path, current_dict_id,
    current_chapter, practice_mode, active_task_run_id, updated_at, last_seen_at
  ) values (
    p_device_id, v_user_id, btrim(p_device_name), btrim(p_platform), p_current_path,
    nullif(p_current_dict_id, ''), p_current_chapter, p_practice_mode,
    nullif(p_active_task_run_id, ''), now(), now()
  )
  on conflict (id) do update
  set device_name = excluded.device_name,
      platform = excluded.platform,
      current_path = excluded.current_path,
      current_dict_id = excluded.current_dict_id,
      current_chapter = excluded.current_chapter,
      practice_mode = excluded.practice_mode,
      active_task_run_id = excluded.active_task_run_id,
      updated_at = now(),
      last_seen_at = now()
  where public.wenyan_devices.user_id = v_user_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'device_id_conflict' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'deviceName', v_row.device_name,
    'platform', v_row.platform,
    'currentPath', v_row.current_path,
    'currentDictId', v_row.current_dict_id,
    'currentChapter', v_row.current_chapter,
    'practiceMode', v_row.practice_mode,
    'activeTaskRunId', v_row.active_task_run_id,
    'lastSeenAt', v_row.last_seen_at
  );
end;
$$;

create or replace function public.get_active_devices()
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
       public.wenyan_has_oauth_capability('navigation:control')
       or public.wenyan_has_oauth_capability('session:control')
     ) then
    raise exception 'device_read_not_granted' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'deviceName', d.device_name,
    'platform', d.platform,
    'currentPath', d.current_path,
    'currentDictId', d.current_dict_id,
    'currentChapter', d.current_chapter,
    'practiceMode', d.practice_mode,
    'activeTaskRunId', d.active_task_run_id,
    'lastSeenAt', d.last_seen_at,
    'online', d.last_seen_at > now() - interval '120 seconds'
  ) order by d.last_seen_at desc), '[]'::jsonb)
  into v_result
  from public.wenyan_devices as d
  where d.user_id = v_user_id
    and d.last_seen_at > now() - interval '24 hours';

  return v_result;
end;
$$;

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
        when v_existing.status = 'pending' and v_existing.expires_at <= now() then 'expired'
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
      when v_row.status = 'pending' and v_row.expires_at <= now() then 'expired'
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

create or replace function public.get_pending_website_commands(p_device_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'type', c.command_type,
    'args', c.args,
    'createdAt', c.created_at,
    'expiresAt', c.expires_at
  ) order by c.created_at), '[]'::jsonb)
  into v_result
  from public.website_commands as c
  where c.user_id = v_user_id
    and c.target_device_id = p_device_id
    and c.status = 'pending'
    and c.expires_at > now()
  limit 20;

  return v_result;
end;
$$;

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

  perform set_config('wenyan.command_executor_rpc', '1', true);
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

  perform set_config('wenyan.command_executor_rpc', '1', true);
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

revoke all on function public.upsert_wenyan_device(uuid, text, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.get_active_devices() from public, anon, authenticated;
revoke all on function public.enqueue_website_command(text, text, jsonb, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_action_status(uuid) from public, anon, authenticated;
revoke all on function public.get_pending_website_commands(uuid) from public, anon, authenticated;
revoke all on function public.claim_website_command(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_website_command(uuid, uuid, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.upsert_wenyan_device(uuid, text, text, text, text, integer, text, text) to authenticated;
grant execute on function public.get_active_devices() to authenticated;
grant execute on function public.enqueue_website_command(text, text, jsonb, uuid, integer) to authenticated;
grant execute on function public.get_action_status(uuid) to authenticated;
grant execute on function public.get_pending_website_commands(uuid) to authenticated;
grant execute on function public.claim_website_command(uuid, uuid) to authenticated;
grant execute on function public.finish_website_command(uuid, uuid, boolean, jsonb, text) to authenticated;

create schema if not exists wenyan_internal;
revoke all on schema wenyan_internal from public, anon, authenticated;

create or replace function wenyan_internal.broadcast_website_command()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'commandId', new.id,
        'type', new.command_type,
        'targetDeviceId', new.target_device_id,
        'expiresAt', new.expires_at
      ),
      'command_created',
      'wenyan:user:' || new.user_id::text || ':control',
      true
    );
  exception when others then
    -- Durable command polling remains the fallback if Realtime delivery is unavailable.
    null;
  end;
  return new;
end;
$$;

revoke all on function wenyan_internal.broadcast_website_command() from public, anon, authenticated;

drop trigger if exists website_commands_broadcast_insert on public.website_commands;
create trigger website_commands_broadcast_insert
after insert on public.website_commands
for each row execute function wenyan_internal.broadcast_website_command();

-- Supabase Realtime owns the realtime schema. Only RLS policies on realtime.messages
-- are modified here, which remains the supported authorization surface.
drop policy if exists "wenyan_control_receive" on realtime.messages;
create policy "wenyan_control_receive"
  on realtime.messages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select realtime.topic()) = 'wenyan:user:' || (select auth.uid())::text || ':control'
    and extension in ('broadcast', 'presence')
  );

drop policy if exists "wenyan_control_presence_track" on realtime.messages;
create policy "wenyan_control_presence_track"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select realtime.topic()) = 'wenyan:user:' || (select auth.uid())::text || ':control'
    and extension = 'presence'
  );

commit;
