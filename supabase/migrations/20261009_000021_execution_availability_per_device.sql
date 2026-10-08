begin;

-- Keep the owner-wide v1 table/RPC during the rollout so older Pages clients and
-- callers remain compatible. The new table makes executor capacity targetable
-- to the same stable browser device identity used by the command bus.
create table public.wenyan_execution_availability_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  algorithm_version text not null,
  focus_dictionary text not null,
  planner_snapshot_id text not null,
  availability_status text not null,
  session_kind text not null,
  disposition text not null,
  reason text not null,
  retry_at timestamptz,
  review_eligible_count integer not null default 0,
  weak_eligible_count integer not null default 0,
  correction_eligible_count integer not null default 0,
  correction_cooldown_count integer not null default 0,
  new_eligible_count integer not null default 0,
  new_word_capacity integer not null default 0,
  semantic_eligible_count integer,
  reading_eligible_count integer not null default 0,
  selected_purpose text,
  selected_item_count integer not null default 0,
  coverage text not null,
  reported_at timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint wenyan_execution_device_fk
    foreign key (user_id, device_id)
    references public.wenyan_devices(user_id, id)
    on delete cascade,
  constraint wenyan_execution_device_algorithm check (algorithm_version = 'elastic-v2'),
  constraint wenyan_execution_device_focus_length check (char_length(focus_dictionary) between 1 and 100),
  constraint wenyan_execution_device_snapshot_length check (char_length(planner_snapshot_id) between 1 and 200),
  constraint wenyan_execution_device_availability_status check (availability_status in ('evaluated', 'not_evaluated')),
  constraint wenyan_execution_device_session_kind check (session_kind in ('draft', 'resume')),
  constraint wenyan_execution_device_disposition check (disposition in ('continue', 'break', 'finish')),
  constraint wenyan_execution_device_reason_length check (char_length(reason) between 1 and 120),
  constraint wenyan_execution_device_counts_nonnegative check (
    review_eligible_count >= 0
    and weak_eligible_count >= 0
    and correction_eligible_count >= 0
    and correction_cooldown_count >= 0
    and new_eligible_count >= 0
    and new_word_capacity >= 0
    and reading_eligible_count >= 0
    and selected_item_count >= 0
    and (semantic_eligible_count is null or semantic_eligible_count >= 0)
  ),
  constraint wenyan_execution_device_selected_purpose check (
    selected_purpose is null or selected_purpose in ('review', 'correction', 'weak', 'new', 'reading', 'semantic_recall')
  ),
  constraint wenyan_execution_device_coverage check (coverage in ('complete', 'partial', 'unknown'))
);

create index wenyan_execution_devices_user_reported_idx
  on public.wenyan_execution_availability_devices (user_id, reported_at desc);

alter table public.wenyan_execution_availability_devices enable row level security;

revoke all on table public.wenyan_execution_availability_devices from public, anon, authenticated;
grant select, insert, update on table public.wenyan_execution_availability_devices to authenticated;

create policy "wenyan_execution_devices_select_own"
  on public.wenyan_execution_availability_devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "wenyan_execution_devices_insert_runtime"
  on public.wenyan_execution_availability_devices
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.execution_availability_rpc', true)) = '1'
  );

create policy "wenyan_execution_devices_update_runtime"
  on public.wenyan_execution_availability_devices
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.execution_availability_rpc', true)) = '1'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.execution_availability_rpc', true)) = '1'
  );

create or replace function public.report_execution_availability_for_device(
  p_device_id uuid,
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
  v_device_row public.wenyan_execution_availability_devices%rowtype;
  v_owner_row public.wenyan_execution_availability%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;
  if p_device_id is null or not exists (
    select 1
    from public.wenyan_devices as d
    where d.user_id = v_user_id and d.id = p_device_id
  ) then
    raise exception 'unknown_device' using errcode = '22023';
  end if;

  perform set_config('wenyan.execution_availability_rpc', '1', true);

  insert into public.wenyan_execution_availability_devices (
    user_id, device_id, algorithm_version, focus_dictionary, planner_snapshot_id,
    availability_status, session_kind, disposition, reason, retry_at,
    review_eligible_count, weak_eligible_count, correction_eligible_count,
    correction_cooldown_count, new_eligible_count, new_word_capacity,
    semantic_eligible_count, reading_eligible_count, selected_purpose,
    selected_item_count, coverage, reported_at
  ) values (
    v_user_id, p_device_id, p_algorithm_version, p_focus_dictionary, p_planner_snapshot_id,
    p_availability_status, p_session_kind, p_disposition, p_reason, p_retry_at,
    p_review_eligible_count, p_weak_eligible_count, p_correction_eligible_count,
    p_correction_cooldown_count, p_new_eligible_count, p_new_word_capacity,
    p_semantic_eligible_count, p_reading_eligible_count, p_selected_purpose,
    p_selected_item_count, p_coverage, now()
  )
  on conflict (user_id, device_id) do update
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
  returning * into v_device_row;

  -- Compatibility bridge: keep the existing owner-wide v1 snapshot fresh while
  -- old clients and no-target Coaching Context calls still exist.
  insert into public.wenyan_execution_availability (
    user_id, algorithm_version, focus_dictionary, planner_snapshot_id,
    availability_status, session_kind, disposition, reason, retry_at,
    review_eligible_count, weak_eligible_count, correction_eligible_count,
    correction_cooldown_count, new_eligible_count, new_word_capacity,
    semantic_eligible_count, reading_eligible_count, selected_purpose,
    selected_item_count, coverage, reported_at
  ) values (
    v_user_id, p_algorithm_version, p_focus_dictionary, p_planner_snapshot_id,
    p_availability_status, p_session_kind, p_disposition, p_reason, p_retry_at,
    p_review_eligible_count, p_weak_eligible_count, p_correction_eligible_count,
    p_correction_cooldown_count, p_new_eligible_count, p_new_word_capacity,
    p_semantic_eligible_count, p_reading_eligible_count, p_selected_purpose,
    p_selected_item_count, p_coverage, now()
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
  returning * into v_owner_row;

  return jsonb_build_object(
    'status', 'reported',
    'deviceId', v_device_row.device_id,
    'reportedAt', v_device_row.reported_at
  );
end;
$$;

create or replace function public.get_execution_availability_for_device(p_device_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.wenyan_execution_availability_devices%rowtype;
  v_age_seconds integer;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_device_id is null then
    raise exception 'invalid_device_id' using errcode = '22023';
  end if;

  select *
  into v_row
  from public.wenyan_execution_availability_devices
  where user_id = v_user_id and device_id = p_device_id;

  if v_row.user_id is null then
    return jsonb_build_object('status', 'unavailable', 'deviceId', p_device_id);
  end if;

  v_age_seconds := greatest(0, floor(extract(epoch from (now() - v_row.reported_at)))::integer);
  v_status := case when v_row.reported_at > now() - interval '120 seconds' then 'fresh' else 'stale' end;

  return jsonb_build_object(
    'status', v_status,
    'deviceId', v_row.device_id,
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

revoke all on function public.report_execution_availability_for_device(uuid,text,text,text,text,text,text,text,timestamptz,integer,integer,integer,integer,integer,integer,integer,text,integer,text,integer) from public, anon;
grant execute on function public.report_execution_availability_for_device(uuid,text,text,text,text,text,text,text,timestamptz,integer,integer,integer,integer,integer,integer,integer,text,integer,text,integer) to authenticated;

revoke all on function public.get_execution_availability_for_device(uuid) from public, anon;
grant execute on function public.get_execution_availability_for_device(uuid) to authenticated;

commit;
