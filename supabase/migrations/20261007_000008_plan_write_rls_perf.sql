begin;

create or replace function public.wenyan_has_oauth_capability(p_capability text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and nullif((select auth.jwt()) ->> 'client_id', '') is not null
    and exists (
      select 1
      from public.oauth_client_capabilities as c
      where c.user_id = (select auth.uid())
        and c.client_id = ((select auth.jwt()) ->> 'client_id')
        and c.capability = p_capability
    );
$$;

drop policy if exists "study_plans_insert_direct_session" on public.study_plans;
drop policy if exists "study_plans_insert_oauth_rpc" on public.study_plans;
create policy "study_plans_insert_authorized"
  on public.study_plans
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (
        ((select auth.jwt()) ->> 'client_id') is null
        and created_by_client_id is null
      )
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  );

drop policy if exists "study_plans_update_direct_session" on public.study_plans;
drop policy if exists "study_plans_update_oauth_rpc" on public.study_plans;
create policy "study_plans_update_authorized"
  on public.study_plans
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  )
  with check (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  );

drop policy if exists "plan_tasks_insert_direct_session" on public.plan_tasks;
drop policy if exists "plan_tasks_insert_oauth_rpc" on public.plan_tasks;
create policy "plan_tasks_insert_authorized"
  on public.plan_tasks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  );

drop policy if exists "plan_tasks_update_direct_session" on public.plan_tasks;
drop policy if exists "plan_tasks_update_oauth_rpc" on public.plan_tasks;
create policy "plan_tasks_update_authorized"
  on public.plan_tasks
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  )
  with check (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  );

drop policy if exists "plan_tasks_delete_direct_session" on public.plan_tasks;
drop policy if exists "plan_tasks_delete_oauth_rpc" on public.plan_tasks;
create policy "plan_tasks_delete_authorized"
  on public.plan_tasks
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or (
        (select current_setting('wenyan.plan_write_rpc', true)) = '1'
        and (select public.wenyan_has_oauth_capability('plans:write'))
      )
    )
  );

drop policy if exists "study_plan_revisions_insert_oauth_rpc" on public.study_plan_revisions;
create policy "study_plan_revisions_insert_oauth_rpc"
  on public.study_plan_revisions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select current_setting('wenyan.plan_write_rpc', true)) = '1'
    and (select public.wenyan_has_oauth_capability('plans:write'))
  );

drop policy if exists "plan_mutation_receipts_select_own_client" on public.plan_mutation_receipts;
create policy "plan_mutation_receipts_select_own_client"
  on public.plan_mutation_receipts
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      ((select auth.jwt()) ->> 'client_id') is null
      or ((select auth.jwt()) ->> 'client_id') = client_id
    )
  );

drop policy if exists "plan_mutation_receipts_insert_oauth_rpc" on public.plan_mutation_receipts;
create policy "plan_mutation_receipts_insert_oauth_rpc"
  on public.plan_mutation_receipts
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and client_id = ((select auth.jwt()) ->> 'client_id')
    and (select current_setting('wenyan.plan_write_rpc', true)) = '1'
    and (select public.wenyan_has_oauth_capability('plans:write'))
  );

commit;
