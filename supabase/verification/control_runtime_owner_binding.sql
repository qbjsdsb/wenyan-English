-- Manual production verification for 20261011_000028_control_runtime_owner_binding.sql.
-- Run after the migration is applied. The transaction writes no persistent rows.
-- Expected result: all rows have passed = true.

begin;

create temporary table control_owner_binding_results (
  test text,
  passed boolean,
  detail text
);

do $$
declare
  owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  owner_b constant uuid := '22222222-2222-4222-8222-222222222222';
  missing_device constant uuid := '33333333-3333-4333-8333-333333333333';
  missing_command constant uuid := '44444444-4444-4444-8444-444444444444';
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_a::text, 'role', 'authenticated')::text,
    true
  );

  -- Matching owner reaches the retained generic runtime contract. Because this
  -- verification uses no real device rows, device_not_found is the expected
  -- downstream result and proves the wrapper did not reject the owner itself.
  begin
    perform public.get_pending_website_commands_for_owner(owner_a, missing_device);
    insert into control_owner_binding_results values (
      'direct_owner_reaches_runtime', false, 'unexpected success without a device row'
    );
  exception when sqlstate '22023' then
    insert into control_owner_binding_results values (
      'direct_owner_reaches_runtime', sqlerrm = 'device_not_found', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'direct_owner_reaches_runtime', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.upsert_wenyan_device_for_owner(
      owner_b, missing_device, 'test', 'test', '/', null, null, 'learn', null
    );
    insert into control_owner_binding_results values (
      'upsert_owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'upsert_owner_mismatch_rejected', sqlerrm = 'control_owner_changed', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'upsert_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.get_pending_website_commands_for_owner(owner_b, missing_device);
    insert into control_owner_binding_results values (
      'pending_owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'pending_owner_mismatch_rejected', sqlerrm = 'control_owner_changed', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'pending_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.claim_website_command_for_owner(owner_b, missing_command, missing_device);
    insert into control_owner_binding_results values (
      'claim_owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'claim_owner_mismatch_rejected', sqlerrm = 'control_owner_changed', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'claim_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.finish_website_command_for_owner(
      owner_b, missing_command, missing_device, false, '{}'::jsonb, 'test'
    );
    insert into control_owner_binding_results values (
      'finish_owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into control_owner_binding_results values (
      'finish_owner_mismatch_rejected', sqlerrm = 'control_owner_changed', sqlerrm
    );
  when others then
    insert into control_owner_binding_results values (
      'finish_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
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
    perform public.get_pending_website_commands_for_owner(owner_a, missing_device);
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
