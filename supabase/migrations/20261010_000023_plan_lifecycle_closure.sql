begin;

-- Cloud Plan is an explicit commitment layer, not the rolling Smart Session
-- planner. One owner therefore has at most one current active commitment plan.
-- Existing duplicate active rows intentionally make this migration fail rather
-- than silently rewriting history without a revision record.
create unique index if not exists study_plans_one_active_per_user_idx
  on public.study_plans (user_id)
  where status = 'active';

-- Default lookup returns only a plan that has something this website can
-- actually execute now. Explicit plan-id lookup remains historical and may
-- return archived/exhausted plans. Completion is still derived only from
-- immutable matching learning events.
create or replace function public.get_plan_status(p_plan_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select p.*
    from public.study_plans as p
    where p.user_id = (select auth.uid())
      and (
        (p_plan_id is not null and p.id = p_plan_id)
        or (
          p_plan_id is null
          and p.status = 'active'
          and exists (
            select 1
            from public.plan_tasks as actionable
            where actionable.plan_id = p.id
              and actionable.user_id = p.user_id
              and actionable.state = 'active'
              and actionable.kind = 'chapter'
              and not exists (
                select 1
                from public.learning_events as evidence
                where evidence.user_id = actionable.user_id
                  and evidence.event_type = 'chapter_completed'
                  and evidence.payload ->> 'planId' = actionable.plan_id::text
                  and evidence.payload ->> 'taskId' = actionable.id::text
              )
          )
        )
      )
    order by p.updated_at desc
    limit 1
  ),
  task_rows as (
    select
      t.*,
      completion.id as completion_event_id,
      completion.occurred_at as completed_at
    from public.plan_tasks as t
    join target on target.id = t.plan_id and target.user_id = t.user_id
    left join lateral (
      select e.id, e.occurred_at
      from public.learning_events as e
      where e.user_id = t.user_id
        and e.event_type = 'chapter_completed'
        and e.payload ->> 'planId' = t.plan_id::text
        and e.payload ->> 'taskId' = t.id::text
      order by e.occurred_at desc, e.id desc
      limit 1
    ) as completion on true
  ),
  task_counts as (
    select
      count(*) filter (where state = 'active')::integer as active_count,
      count(*) filter (
        where state = 'active' and kind = 'chapter' and completion_event_id is null
      )::integer as actionable_count,
      count(*) filter (
        where state = 'active' and kind = 'chapter' and completion_event_id is not null
      )::integer as completed_count,
      count(*) filter (where state = 'active' and kind <> 'chapter')::integer as deferred_count
    from task_rows
  )
  select case
    when not exists (select 1 from target) then null
    else jsonb_build_object(
      'schemaVersion', 2,
      'plan', (
        select jsonb_build_object(
          'id', id,
          'title', title,
          'timezone', timezone,
          'status', status,
          'revision', revision,
          'source', source,
          'createdByClientId', created_by_client_id,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        from target
      ),
      'tasks', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'position', position,
            'kind', kind,
            'title', title,
            'dueDate', due_date,
            'estimatedMinutes', estimated_minutes,
            'reason', reason,
            'config', config,
            'state', state,
            'completedAt', completed_at,
            'completionEventId', completion_event_id
          )
          order by position
        )
        from task_rows
      ), '[]'::jsonb),
      'lifecycle', (
        select case
          when target.status = 'archived' then 'archived'
          when task_counts.actionable_count > 0 then 'actionable'
          when task_counts.deferred_count > 0 then 'deferred'
          else 'exhausted'
        end
        from target cross join task_counts
      ),
      'taskSummary', (
        select jsonb_build_object(
          'active', active_count,
          'actionable', actionable_count,
          'completed', completed_count,
          'deferred', deferred_count
        )
        from task_counts
      ),
      'completionPolicy', 'Completion is derived only from immutable matching learning events; plan rows cannot assert completed status.'
    )
  end;
$$;

revoke all on function public.get_plan_status(uuid) from public, anon, authenticated;
grant execute on function public.get_plan_status(uuid) to authenticated;

-- Creating a new explicit plan supersedes the previous active plan under the
-- same authenticated owner. The old plan receives its own revision snapshot;
-- no learning event or completed-task evidence is modified.
create or replace function public.create_study_plan(
  p_request_id text,
  p_title text,
  p_timezone text,
  p_tasks jsonb,
  p_change_reason text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := auth.jwt() ->> 'client_id';
  v_plan_id uuid;
  v_response jsonb;
  v_existing_operation text;
  v_existing_response jsonb;
  v_snapshot jsonb;
  v_previous record;
begin
  if v_user_id is null or nullif(v_client_id, '') is null then
    raise exception 'oauth_client_required' using errcode = '42501';
  end if;

  if p_request_id is null
     or char_length(p_request_id) < 8
     or char_length(p_request_id) > 120
     or p_request_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if not public.wenyan_has_oauth_capability('plans:write') then
    raise exception 'plans_write_not_granted' using errcode = '42501';
  end if;

  if p_title is null or char_length(p_title) not between 1 and 160 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;

  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  perform public.wenyan_validate_plan_tasks(p_tasks);
  perform set_config('wenyan.plan_write_rpc', '1', true);

  -- Serialize create/supersede for this owner; the partial unique index below
  -- remains the final invariant if another writer bypasses the RPC.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 9173));

  select r.operation, r.response
  into v_existing_operation, v_existing_response
  from public.plan_mutation_receipts as r
  where r.user_id = v_user_id
    and r.client_id = v_client_id
    and r.request_id = p_request_id;

  if found then
    if v_existing_operation <> 'create' then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;
    return v_existing_response;
  end if;

  for v_previous in
    select p.id, p.revision
    from public.study_plans as p
    where p.user_id = v_user_id and p.status = 'active'
    order by p.updated_at desc, p.id
    for update
  loop
    update public.study_plans
    set status = 'archived',
        revision = v_previous.revision + 1,
        updated_at = now()
    where id = v_previous.id and user_id = v_user_id;

    v_snapshot := public.wenyan_plan_snapshot(v_previous.id);

    insert into public.study_plan_revisions (
      plan_id, user_id, revision, snapshot, change_reason, created_by_client_id
    ) values (
      v_previous.id,
      v_user_id,
      v_previous.revision + 1,
      v_snapshot,
      'Superseded by a newer active plan.',
      v_client_id
    );
  end loop;

  v_plan_id := gen_random_uuid();

  insert into public.study_plans (
    id, user_id, title, timezone, status, revision, source, created_by_client_id
  ) values (
    v_plan_id, v_user_id, p_title, p_timezone, 'active', 1, 'wenyan-english', v_client_id
  );

  insert into public.plan_tasks (
    id, plan_id, user_id, position, kind, title, due_date,
    estimated_minutes, reason, config, state
  )
  select
    case
      when nullif(item ->> 'id', '') is null then gen_random_uuid()
      else (item ->> 'id')::uuid
    end,
    v_plan_id,
    v_user_id,
    ord::integer - 1,
    item ->> 'kind',
    item ->> 'title',
    (item ->> 'dueDate')::date,
    (item ->> 'estimatedMinutes')::integer,
    coalesce(item ->> 'reason', ''),
    coalesce(item -> 'config', '{}'::jsonb),
    'active'
  from jsonb_array_elements(p_tasks) with ordinality as incoming(item, ord);

  v_snapshot := public.wenyan_plan_snapshot(v_plan_id);

  insert into public.study_plan_revisions (
    plan_id, user_id, revision, snapshot, change_reason, created_by_client_id
  ) values (
    v_plan_id, v_user_id, 1, v_snapshot, coalesce(p_change_reason, ''), v_client_id
  );

  v_response := jsonb_build_object(
    'requestId', p_request_id,
    'operation', 'create',
    'plan', public.get_plan_status(v_plan_id)
  );

  insert into public.plan_mutation_receipts (
    user_id, client_id, request_id, operation, plan_id, response
  ) values (
    v_user_id, v_client_id, p_request_id, 'create', v_plan_id, v_response
  );

  return v_response;
end;
$$;

revoke all on function public.create_study_plan(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_study_plan(text, text, text, jsonb, text) to authenticated;

commit;