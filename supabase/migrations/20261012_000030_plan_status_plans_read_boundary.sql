begin;

-- Cloud Plan status has two supported readers:
--   1. the first-party Wenyan browser, which has no OAuth client_id; and
--   2. OAuth/MCP clients, which must hold plans:read.
-- Keep the final authorization boundary inside Postgres so a future caller
-- cannot bypass the MCP adapter's capability model.
create or replace function public.wenyan_require_plans_read_if_oauth()
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  -- Direct first-party browser sessions are authorized by owner checks in the
  -- browser-specific wrapper and by RLS in the plan query itself.
  if v_client_id is null then
    return true;
  end if;

  if not exists (
    select 1
    from public.oauth_client_capabilities as c
    where c.user_id = v_user_id
      and c.client_id = v_client_id
      and c.capability = 'plans:read'
  ) then
    raise exception 'plans_read_not_granted' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.wenyan_require_plans_read_if_oauth() from public, anon, authenticated;
grant execute on function public.wenyan_require_plans_read_if_oauth() to authenticated;

create or replace function public.get_plan_status(p_plan_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with capability_gate as materialized (
    select public.wenyan_require_plans_read_if_oauth() as allowed
  ),
  target as (
    select p.*
    from public.study_plans as p
    cross join capability_gate as gate
    where gate.allowed
      and p.user_id = (select auth.uid())
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
                  and public.wenyan_completion_matches_chapter_task(evidence.payload, actionable.config)
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
        and public.wenyan_completion_matches_chapter_task(e.payload, t.config)
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
      'completionPolicy', 'Completion is derived only from immutable matching learning events; new task-linked facts must also match the current chapter execution fingerprint.'
    )
  end;
$$;

revoke all on function public.get_plan_status(uuid) from public, anon, authenticated;
grant execute on function public.get_plan_status(uuid) to authenticated;

commit;
