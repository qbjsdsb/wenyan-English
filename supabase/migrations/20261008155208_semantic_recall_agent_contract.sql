begin;

create or replace function public.wenyan_validate_session_constraints(p_constraints jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_constraints is null or jsonb_typeof(p_constraints) <> 'object' then
    raise exception 'invalid_intent_constraints' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_constraints) as keys(key)
    where key not in ('focusDictionary','targetMinutes','hardStopMinutes','newWordCeiling','reviewPreference','intensity','preferredActivities')
  ) then raise exception 'invalid_intent_constraint_key' using errcode = '22023'; end if;
  if p_constraints ? 'focusDictionary' and (
    jsonb_typeof(p_constraints->'focusDictionary') <> 'string'
    or char_length(p_constraints->>'focusDictionary') not between 1 and 100
  ) then raise exception 'invalid_focus_dictionary' using errcode = '22023'; end if;
  if exists (
    select 1
    from (values ('targetMinutes',240),('hardStopMinutes',240),('newWordCeiling',50)) as bounds(key,max_value)
    where p_constraints ? key and (
      jsonb_typeof(p_constraints->key) <> 'number'
      or coalesce(p_constraints->>key,'') !~ '^[0-9]+$'
      or (p_constraints->>key)::integer > max_value
    )
  ) then raise exception 'invalid_intent_numeric_constraint' using errcode = '22023'; end if;
  if p_constraints ? 'reviewPreference' and (
    jsonb_typeof(p_constraints->'reviewPreference') <> 'string'
    or coalesce(p_constraints->>'reviewPreference','') not in ('balanced','review_first')
  ) then raise exception 'invalid_review_preference' using errcode = '22023'; end if;
  if p_constraints ? 'intensity' and (
    jsonb_typeof(p_constraints->'intensity') <> 'string'
    or coalesce(p_constraints->>'intensity','') not in ('gentle','normal')
  ) then raise exception 'invalid_intensity' using errcode = '22023'; end if;
  if p_constraints ? 'preferredActivities' then
    if jsonb_typeof(p_constraints->'preferredActivities') <> 'array'
       or jsonb_array_length(p_constraints->'preferredActivities') > 10 then
      raise exception 'invalid_preferred_activities' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_constraints->'preferredActivities') as items(item)
      where jsonb_typeof(item) <> 'string'
         or item #>> '{}' not in ('semantic_recall','vocabulary','reading','dictation','cloze','translation','writing','grammar','long_sentence','new_question_type')
    ) then raise exception 'invalid_preferred_activity' using errcode = '22023'; end if;
    if (
      select count(*) <> count(distinct item #>> '{}')
      from jsonb_array_elements(p_constraints->'preferredActivities') as items(item)
    ) then raise exception 'duplicate_preferred_activity' using errcode = '22023'; end if;
  end if;
end;
$$;

-- Preserve existing caller authority. Null capacity identifies an older executor, not zero capacity.
alter table public.wenyan_execution_availability add column semantic_eligible_count integer
  check (semantic_eligible_count is null or semantic_eligible_count >= 0);
alter table public.wenyan_execution_availability drop constraint wenyan_execution_selected_purpose;
alter table public.wenyan_execution_availability add constraint wenyan_execution_selected_purpose
  check (selected_purpose is null or selected_purpose in ('review','correction','weak','new','reading','semantic_recall'));
-- Replace the signature rather than retain ambiguous PostgREST overloads. Existing callers use the default.
drop function public.report_execution_availability(text,text,text,text,text,text,text,timestamptz,integer,integer,integer,integer,integer,integer,integer,text,integer,text);
create or replace function public.report_execution_availability(
  p_algorithm_version text,
  p_focus_dictionary text,
  p_planner_snapshot_id text,
  p_availability_status text,
  p_session_kind text,
  p_disposition text,
  p_reason text,
  p_retry_at timestamptz,
  p_review_eligible_count integer,
  p_weak_eligible_count integer,
  p_correction_eligible_count integer,
  p_correction_cooldown_count integer,
  p_new_eligible_count integer,
  p_new_word_capacity integer,
  p_reading_eligible_count integer,
  p_selected_purpose text,
  p_selected_item_count integer,
  p_coverage text,
  p_semantic_eligible_count integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.wenyan_execution_availability%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;

  perform set_config('wenyan.execution_availability_rpc', '1', true);

  insert into public.wenyan_execution_availability (
    user_id,
    algorithm_version,
    focus_dictionary,
    planner_snapshot_id,
    availability_status,
    session_kind,
    disposition,
    reason,
    retry_at,
    review_eligible_count,
    weak_eligible_count,
    correction_eligible_count,
    correction_cooldown_count,
    new_eligible_count,
    new_word_capacity,
    semantic_eligible_count,
    reading_eligible_count,
    selected_purpose,
    selected_item_count,
    coverage,
    reported_at
  ) values (
    v_user_id,
    p_algorithm_version,
    p_focus_dictionary,
    p_planner_snapshot_id,
    p_availability_status,
    p_session_kind,
    p_disposition,
    p_reason,
    p_retry_at,
    p_review_eligible_count,
    p_weak_eligible_count,
    p_correction_eligible_count,
    p_correction_cooldown_count,
    p_new_eligible_count,
    p_new_word_capacity,
    p_semantic_eligible_count,
    p_reading_eligible_count,
    p_selected_purpose,
    p_selected_item_count,
    p_coverage,
    now()
  )
  on conflict (user_id) do update
  set algorithm_version = excluded.algorithm_version,
      focus_dictionary = excluded.focus_dictionary,
      planner_snapshot_id = excluded.planner_snapshot_id,
      availability_status = excluded.availability_status,
      session_kind = excluded.session_kind,
      disposition = excluded.disposition,
      reason = excluded.reason,
      retry_at = excluded.retry_at,
      review_eligible_count = excluded.review_eligible_count,
      weak_eligible_count = excluded.weak_eligible_count,
      correction_eligible_count = excluded.correction_eligible_count,
      correction_cooldown_count = excluded.correction_cooldown_count,
      new_eligible_count = excluded.new_eligible_count,
      new_word_capacity = excluded.new_word_capacity,
      semantic_eligible_count = excluded.semantic_eligible_count,
      reading_eligible_count = excluded.reading_eligible_count,
      selected_purpose = excluded.selected_purpose,
      selected_item_count = excluded.selected_item_count,
      coverage = excluded.coverage,
      reported_at = now()
  where public.wenyan_execution_availability.user_id = v_user_id
  returning * into v_row;

  return jsonb_build_object(
    'status', 'reported',
    'reportedAt', v_row.reported_at
  );
end;
$$;

create or replace function public.get_execution_availability()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.wenyan_execution_availability%rowtype;
  v_age_seconds integer;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
  into v_row
  from public.wenyan_execution_availability
  where user_id = v_user_id;

  if v_row.user_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_age_seconds := greatest(0, floor(extract(epoch from (now() - v_row.reported_at)))::integer);
  v_status := case when v_row.reported_at > now() - interval '120 seconds' then 'fresh' else 'stale' end;

  return jsonb_build_object(
    'status', v_status,
    'reportedAt', v_row.reported_at,
    'ageSeconds', v_age_seconds,
    'snapshot', jsonb_build_object(
      'algorithmVersion', v_row.algorithm_version,
      'focusDictionary', v_row.focus_dictionary,
      'plannerSnapshotId', v_row.planner_snapshot_id,
      'availabilityStatus', v_row.availability_status,
      'sessionKind', v_row.session_kind,
      'disposition', v_row.disposition,
      'reason', v_row.reason,
      'retryAt', v_row.retry_at,
      'reviewEligibleCount', v_row.review_eligible_count,
      'weakEligibleCount', v_row.weak_eligible_count,
      'correctionEligibleCount', v_row.correction_eligible_count,
      'correctionCooldownCount', v_row.correction_cooldown_count,
      'newEligibleCount', v_row.new_eligible_count,
      'newWordCapacity', v_row.new_word_capacity,
      'semanticEligibleCount', v_row.semantic_eligible_count,
      'readingEligibleCount', v_row.reading_eligible_count,
      'selectedPurpose', v_row.selected_purpose,
      'selectedItemCount', v_row.selected_item_count,
      'coverage', v_row.coverage
    )
  );
end;
$$;

revoke all on function public.report_execution_availability(text, text, text, text, text, text, text, timestamptz, integer, integer, integer, integer, integer, integer, integer, text, integer, text, integer) from public, anon;
grant execute on function public.report_execution_availability(text, text, text, text, text, text, text, timestamptz, integer, integer, integer, integer, integer, integer, integer, text, integer, text, integer) to authenticated;

revoke all on function public.get_execution_availability() from public, anon;
grant execute on function public.get_execution_availability() to authenticated;

commit;
