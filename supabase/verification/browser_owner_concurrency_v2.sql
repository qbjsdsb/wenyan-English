-- Manual production verification for 20261011_000027_browser_owner_concurrency_v2.sql.
-- The transaction is read-only apart from temporary objects/claims and rolls back.
-- Expected result: every row has passed = true.

begin;

create temporary table browser_owner_results(test text, passed boolean, detail text);

do $$
declare
  owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  owner_b constant uuid := '22222222-2222-4222-8222-222222222222';
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_a::text, 'role', 'authenticated')::text, true);

  begin
    perform public.get_plan_status_for_owner(owner_b, null);
    insert into browser_owner_results values ('plan_owner_mismatch_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('plan_owner_mismatch_rejected', sqlerrm = 'browser_owner_changed', sqlerrm);
  when others then
    insert into browser_owner_results values ('plan_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  begin
    perform public.get_learning_preferences_for_owner(owner_b);
    insert into browser_owner_results values ('preferences_read_owner_mismatch_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('preferences_read_owner_mismatch_rejected', sqlerrm = 'browser_owner_changed', sqlerrm);
  when others then
    insert into browser_owner_results values ('preferences_read_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  begin
    perform public.confirm_learning_stage_for_owner(owner_b, 'verify-owner-mismatch', 'vocabulary', 0, 'verification');
    insert into browser_owner_results values ('preferences_write_owner_mismatch_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('preferences_write_owner_mismatch_rejected', sqlerrm = 'browser_owner_changed', sqlerrm);
  when others then
    insert into browser_owner_results values ('preferences_write_owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_a::text, 'role', 'authenticated', 'client_id', 'oauth-verification')::text, true);

  begin
    perform public.get_plan_status_for_owner(owner_a, null);
    insert into browser_owner_results values ('plan_oauth_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('plan_oauth_rejected', sqlerrm = 'direct_wenyan_session_required', sqlerrm);
  when others then
    insert into browser_owner_results values ('plan_oauth_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  begin
    perform public.get_learning_preferences_for_owner(owner_a);
    insert into browser_owner_results values ('preferences_read_oauth_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('preferences_read_oauth_rejected', sqlerrm = 'direct_wenyan_session_required', sqlerrm);
  when others then
    insert into browser_owner_results values ('preferences_read_oauth_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  begin
    perform public.confirm_learning_stage_for_owner(owner_a, 'verify-oauth-rejected', 'vocabulary', 0, 'verification');
    insert into browser_owner_results values ('preferences_write_oauth_rejected', false, 'unexpected success');
  exception when sqlstate '42501' then
    insert into browser_owner_results values ('preferences_write_oauth_rejected', sqlerrm = 'direct_wenyan_session_required', sqlerrm);
  when others then
    insert into browser_owner_results values ('preferences_write_oauth_rejected', false, sqlstate || ':' || sqlerrm);
  end;

  begin
    perform public.get_plan_status(null);
    insert into browser_owner_results values ('generic_plan_read_oauth_compatible', true, 'existing get_plan_status remains callable');
  exception when others then
    insert into browser_owner_results values ('generic_plan_read_oauth_compatible', false, sqlstate || ':' || sqlerrm);
  end;
end $$;

select * from browser_owner_results order by test;
rollback;
