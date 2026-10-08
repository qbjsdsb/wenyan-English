begin;

create table public.wenyan_execution_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
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
  reading_eligible_count integer not null default 0,
  selected_purpose text,
  selected_item_count integer not null default 0,
  coverage text not null,
  reported_at timestamptz not null default now(),
  constraint wenyan_execution_algorithm check (algorithm_version = 'elastic-v2'),
  constraint wenyan_execution_focus_length check (char_length(focus_dictionary) between 1 and 100),
  constraint wenyan_execution_snapshot_length check (char_length(planner_snapshot_id) between 1 and 200),
  constraint wenyan_execution_availability_status check (availability_status in ('evaluated', 'not_evaluated')),
  constraint wenyan_execution_session_kind check (session_kind in ('draft', 'resume')),
  constraint wenyan_execution_disposition check (disposition in ('continue', 'break', 'finish')),
  constraint wenyan_execution_reason_length check (char_length(reason) between 1 and 120),
  constraint wenyan_execution_counts_nonnegative check (
    review_eligible_count >= 0
    and weak_eligible_count >= 0
    and correction_eligible_count >= 0
    and correction_cooldown_count >= 0
    and new_eligible_count >= 0
    and new_word_capacity >= 0
    and reading_eligible_count >= 0
    and selected_item_count >= 0
  ),
  constraint wenyan_execution_selected_purpose check (
    selected_purpose is null or selected_purpose in ('review', 'correction', 'weak', 'new', 'reading')
  ),
  constraint wenyan_execution_coverage check (coverage in ('complete', 'partial', 'unknown'))
);

alter table public.wenyan_execution_availability enable row level security;

revoke all on table public.wenyan_execution_availability from public, anon, authenticated;
grant select, insert, update on table public.wenyan_execution_availability to authenticated;

drop policy if exists "wenyan_execution_availability_select_own" on public.wenyan_execution_availability;
create policy "wenyan_execution_availability_select_own"
  on public.wenyan_execution_availability
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "wenyan_execution_availability_insert_runtime" on public.wenyan_execution_availability;
create policy "wenyan_execution_availability_insert_runtime"
  on public.wenyan_execution_availability
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
    and (select current_setting('wenyan.execution_availability_rpc', true)) = '1'
  );

drop policy if exists "wenyan_execution_availability_update_runtime" on public.wenyan_execution_availability;
create policy "wenyan_execution_availability_update_runtime"
  on public.wenyan_execution_availability
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
  p_coverage text
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
      'readingEligibleCount', v_row.reading_eligible_count,
      'selectedPurpose', v_row.selected_purpose,
      'selectedItemCount', v_row.selected_item_count,
      'coverage', v_row.coverage
    )
  );
end;
$$;

revoke all on function public.report_execution_availability(text, text, text, text, text, text, text, timestamptz, integer, integer, integer, integer, integer, integer, integer, text, integer, text) from public, anon;
grant execute on function public.report_execution_availability(text, text, text, text, text, text, text, timestamptz, integer, integer, integer, integer, integer, integer, integer, text, integer, text) to authenticated;

revoke all on function public.get_execution_availability() from public, anon;
grant execute on function public.get_execution_availability() to authenticated;

commit;
