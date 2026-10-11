-- Manual production verification for 20261011_000026_learning_sync_owner_binding.sql.
-- Run after the migration is applied. The transaction leaves no rows or claims behind.
-- Expected result: all four rows have passed = true.

begin;

create temporary table owner_binding_results (
  test text,
  passed boolean,
  detail text
);

do $$
declare
  owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  owner_b constant uuid := '22222222-2222-4222-8222-222222222222';
  inserted integer;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_a::text, 'role', 'authenticated')::text,
    true
  );

  begin
    inserted := public.ingest_learning_events_for_owner(owner_a, '[]'::jsonb);
    insert into owner_binding_results values (
      'direct_owner_match',
      inserted = 0,
      'empty owner-bound ingest accepted'
    );
  exception when others then
    insert into owner_binding_results values (
      'direct_owner_match', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform public.ingest_learning_events_for_owner(owner_b, '[]'::jsonb);
    insert into owner_binding_results values (
      'owner_mismatch_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into owner_binding_results values (
      'owner_mismatch_rejected',
      sqlerrm = 'learning_owner_changed',
      sqlerrm
    );
  when others then
    insert into owner_binding_results values (
      'owner_mismatch_rejected', false, sqlstate || ':' || sqlerrm
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
    perform public.ingest_learning_events_for_owner(owner_a, '[]'::jsonb);
    insert into owner_binding_results values (
      'oauth_wrapper_rejected', false, 'unexpected success'
    );
  exception when sqlstate '42501' then
    insert into owner_binding_results values (
      'oauth_wrapper_rejected',
      sqlerrm = 'direct_wenyan_session_required',
      sqlerrm
    );
  when others then
    insert into owner_binding_results values (
      'oauth_wrapper_rejected', false, sqlstate || ':' || sqlerrm
    );
  end;

  begin
    perform * from public.pull_learning_events(null, null, 1);
    insert into owner_binding_results values (
      'generic_pull_oauth_compatible',
      true,
      'existing generic pull remains callable with OAuth-shaped claims'
    );
  exception when others then
    insert into owner_binding_results values (
      'generic_pull_oauth_compatible', false, sqlstate || ':' || sqlerrm
    );
  end;
end $$;

select *
from owner_binding_results
order by test;

rollback;
