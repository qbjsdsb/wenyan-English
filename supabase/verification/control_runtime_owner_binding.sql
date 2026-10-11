-- Production verification for 20261011_000028_control_runtime_owner_binding.sql.
-- Run only after applying the migration. Everything is wrapped in a transaction
-- and rolled back, so the verification leaves no device/command rows behind.
-- Expected result: every row has passed = true.

begin;

create temporary table control_owner_binding_results (
  test text,
  passed boolean,
  detail text
);

do $$
declare
  owner_a uuid;
  owner_b uuid := '22222222-2222-4222-8222-222222222222';
  device_id uuid := '33333333-3333-4333-8333-333333333333';
  command_id uuid := '44444444-4444-4444-8444-444444444444';
  pending jsonb;
  status_payload jsonb;
begin
  select id into owner_a from auth.users order by created_at limit 1;
  if owner_a is null then
    raise exception 'verification_requires_one_auth_user';
  end if;

  insert into public.wenyan_devices (
    id, user_id, device_name, platform, current_path, practice_mode
  ) values (
    device_id, owner_a, 'Wenyan verification', 'verification', '/', 'learn'
  );

  insert into public.website_commands (
    id, user_id, client_id, request_id, command_type, args,
    target_device_id, status, created_at, updated_at, expires_at
  ) values (
    command_id, owner_a, 'verification-client', 'verification-request-000028',
    'open_today', '{}'::jsonb, device_id, 'pending',
    now() - interval '1 minute', now() - interval '1 minute', now() + interval '5 minutes'
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_a::text, 'role', 'authenticated')::text,
    true
  );

  begin
    pending := public.get_pending_website_commands_for_owner(owner_a, device_id);
    insert into control_owner_binding_results values (
      'matching_owner_reaches_pending',
      jsonb_array_length(pending) = 1 and pending -> 0 ->> 'id' = command_id::text,
      pending::text
    );
  exception when others then
    insert into control_owner_binding_results values (
      'matching_owner_reaches_pending', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.get_pending_website_commands_for_owner(owner_b, device_id);
    insert into control_owner_binding_results values (
      'owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'owner_mismatch_rejected', sqlerrm = 'control_owner_changed', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;

  perform public.claim_website_command_for_owner(owner_a, command_id, device_id);
  update public.website_commands
  set started_at = now() - interval '121 seconds', updated_at = now() - interval '121 seconds'
  where id = command_id;

  pending := public.get_pending_website_commands_for_owner(owner_a, device_id);
  insert into control_owner_binding_results
  select
    'slow_execution_not_requeued',
    c.status = 'executing'
      and c.started_at is not null
      and jsonb_array_length(pending) = 0,
    c.status || ':' || coalesce(c.started_at::text, 'null')
  from public.website_commands as c
  where c.id = command_id;

  update public.website_commands
  set created_at = now() - interval '10 minutes',
      expires_at = now() - interval '1 second',
      updated_at = now()
  where id = command_id;

  status_payload := public.get_action_status(command_id);
  insert into control_owner_binding_results values (
    'expired_execution_reports_terminal_effective_status',
    status_payload ->> 'status' = 'executing'
      and status_payload ->> 'effectiveStatus' = 'expired',
    status_payload::text
  );

  begin
    perform public.finish_website_command_for_owner(
      owner_a, command_id, device_id, true, '{}'::jsonb, null
    );
    insert into control_owner_binding_results values (
      'expired_execution_cannot_finish', false, 'unexpected success'
    );
  exception when sqlstate '55000' then
    insert into control_owner_binding_results values (
      'expired_execution_cannot_finish', sqlerrm = 'command_expired', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'expired_execution_cannot_finish', false, sqlstate || ':' || sqlerrm
    );
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', owner_a::text,
      'role', 'authenticated',
      'client_id', 'oauth-verification'
    )::text,
    true
  );

  begin
    perform public.get_pending_website_commands_for_owner(owner_a, device_id);
    insert into control_owner_binding_results values (
      'runtime_wrapper_oauth_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'runtime_wrapper_oauth_rejected', sqlerrm = 'direct_wenyan_session_required', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'runtime_wrapper_oauth_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;
end $$;

select *
from control_owner_binding_results
order by test;

rollback;
