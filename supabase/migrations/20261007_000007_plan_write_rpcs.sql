begin;

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

create or replace function public.revise_study_plan(
  p_request_id text,
  p_plan_id uuid,
  p_expected_revision integer,
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
  v_current_revision integer;
  v_status text;
  v_new_revision integer;
  v_response jsonb;
  v_existing_operation text;
  v_existing_response jsonb;
  v_snapshot jsonb;
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

  select r.operation, r.response
  into v_existing_operation, v_existing_response
  from public.plan_mutation_receipts as r
  where r.user_id = v_user_id
    and r.client_id = v_client_id
    and r.request_id = p_request_id;

  if found then
    if v_existing_operation <> 'revise' then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;
    return v_existing_response;
  end if;

  select p.revision, p.status
  into v_current_revision, v_status
  from public.study_plans as p
  where p.id = p_plan_id and p.user_id = v_user_id
  for update;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_status <> 'active' then
    raise exception 'plan_not_active' using errcode = '22023';
  end if;

  if p_expected_revision is null or p_expected_revision <> v_current_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;

  -- A completed task is an immutable evidence anchor. Any revision containing
  -- completed work must preserve that task's ID, position and planned fields.
  if exists (
    select 1
    from public.plan_tasks as t
    where t.plan_id = p_plan_id
      and t.user_id = v_user_id
      and exists (
        select 1
        from public.learning_events as e
        where e.user_id = t.user_id
          and e.event_type = 'chapter_completed'
          and e.payload ->> 'planId' = t.plan_id::text
          and e.payload ->> 'taskId' = t.id::text
      )
      and not exists (
        select 1
        from jsonb_array_elements(p_tasks) with ordinality as incoming(item, ord)
        where incoming.item ->> 'id' = t.id::text
          and incoming.ord::integer - 1 = t.position
          and incoming.item ->> 'kind' = t.kind
          and incoming.item ->> 'title' = t.title
          and (incoming.item ->> 'dueDate')::date = t.due_date
          and (incoming.item ->> 'estimatedMinutes')::integer = t.estimated_minutes
          and coalesce(incoming.item ->> 'reason', '') = t.reason
          and coalesce(incoming.item -> 'config', '{}'::jsonb) = t.config
      )
  ) then
    raise exception 'completed_task_is_immutable' using errcode = '22023';
  end if;

  delete from public.plan_tasks as t
  where t.plan_id = p_plan_id
    and t.user_id = v_user_id
    and not exists (
      select 1
      from public.learning_events as e
      where e.user_id = t.user_id
        and e.event_type = 'chapter_completed'
        and e.payload ->> 'planId' = t.plan_id::text
        and e.payload ->> 'taskId' = t.id::text
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
    p_plan_id,
    v_user_id,
    ord::integer - 1,
    item ->> 'kind',
    item ->> 'title',
    (item ->> 'dueDate')::date,
    (item ->> 'estimatedMinutes')::integer,
    coalesce(item ->> 'reason', ''),
    coalesce(item -> 'config', '{}'::jsonb),
    'active'
  from jsonb_array_elements(p_tasks) with ordinality as incoming(item, ord)
  where not exists (
    select 1
    from public.plan_tasks as completed
    where completed.plan_id = p_plan_id
      and completed.user_id = v_user_id
      and completed.id::text = incoming.item ->> 'id'
      and exists (
        select 1
        from public.learning_events as e
        where e.user_id = completed.user_id
          and e.event_type = 'chapter_completed'
          and e.payload ->> 'planId' = completed.plan_id::text
          and e.payload ->> 'taskId' = completed.id::text
      )
  );

  v_new_revision := v_current_revision + 1;

  update public.study_plans
  set title = p_title,
      timezone = p_timezone,
      revision = v_new_revision,
      updated_at = now()
  where id = p_plan_id and user_id = v_user_id;

  v_snapshot := public.wenyan_plan_snapshot(p_plan_id);

  insert into public.study_plan_revisions (
    plan_id, user_id, revision, snapshot, change_reason, created_by_client_id
  ) values (
    p_plan_id, v_user_id, v_new_revision, v_snapshot, coalesce(p_change_reason, ''), v_client_id
  );

  v_response := jsonb_build_object(
    'requestId', p_request_id,
    'operation', 'revise',
    'plan', public.get_plan_status(p_plan_id)
  );

  insert into public.plan_mutation_receipts (
    user_id, client_id, request_id, operation, plan_id, response
  ) values (
    v_user_id, v_client_id, p_request_id, 'revise', p_plan_id, v_response
  );

  return v_response;
end;
$$;

create or replace function public.archive_study_plan(
  p_request_id text,
  p_plan_id uuid,
  p_expected_revision integer,
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
  v_current_revision integer;
  v_status text;
  v_new_revision integer;
  v_response jsonb;
  v_existing_operation text;
  v_existing_response jsonb;
  v_snapshot jsonb;
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

  perform set_config('wenyan.plan_write_rpc', '1', true);

  select r.operation, r.response
  into v_existing_operation, v_existing_response
  from public.plan_mutation_receipts as r
  where r.user_id = v_user_id
    and r.client_id = v_client_id
    and r.request_id = p_request_id;

  if found then
    if v_existing_operation <> 'archive' then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;
    return v_existing_response;
  end if;

  select p.revision, p.status
  into v_current_revision, v_status
  from public.study_plans as p
  where p.id = p_plan_id and p.user_id = v_user_id
  for update;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if p_expected_revision is null or p_expected_revision <> v_current_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;

  if v_status <> 'active' then
    raise exception 'plan_not_active' using errcode = '22023';
  end if;

  v_new_revision := v_current_revision + 1;

  update public.study_plans
  set status = 'archived',
      revision = v_new_revision,
      updated_at = now()
  where id = p_plan_id and user_id = v_user_id;

  v_snapshot := public.wenyan_plan_snapshot(p_plan_id);

  insert into public.study_plan_revisions (
    plan_id, user_id, revision, snapshot, change_reason, created_by_client_id
  ) values (
    p_plan_id, v_user_id, v_new_revision, v_snapshot, coalesce(p_change_reason, ''), v_client_id
  );

  v_response := jsonb_build_object(
    'requestId', p_request_id,
    'operation', 'archive',
    'plan', public.get_plan_status(p_plan_id)
  );

  insert into public.plan_mutation_receipts (
    user_id, client_id, request_id, operation, plan_id, response
  ) values (
    v_user_id, v_client_id, p_request_id, 'archive', p_plan_id, v_response
  );

  return v_response;
end;
$$;

revoke all on function public.create_study_plan(text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.revise_study_plan(text, uuid, integer, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.archive_study_plan(text, uuid, integer, text) from public, anon, authenticated;

grant execute on function public.create_study_plan(text, text, text, jsonb, text) to authenticated;
grant execute on function public.revise_study_plan(text, uuid, integer, text, text, jsonb, text) to authenticated;
grant execute on function public.archive_study_plan(text, uuid, integer, text) to authenticated;

commit;
