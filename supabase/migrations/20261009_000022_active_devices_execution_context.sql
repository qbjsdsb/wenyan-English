begin;

-- Enrich the existing high-level device discovery tool instead of adding another
-- MCP tool. This lets an Agent choose one online device and reason about the same
-- device's short-lived deterministic executor capacity before sending a command.
create or replace function public.get_active_devices()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if v_client_id is not null
     and not (
       public.wenyan_has_oauth_capability('navigation:control')
       or public.wenyan_has_oauth_capability('session:control')
     ) then
    raise exception 'device_read_not_granted' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'deviceName', d.device_name,
    'platform', d.platform,
    'currentPath', d.current_path,
    'currentDictId', d.current_dict_id,
    'currentChapter', d.current_chapter,
    'practiceMode', d.practice_mode,
    'activeTaskRunId', d.active_task_run_id,
    'lastSeenAt', d.last_seen_at,
    'online', d.last_seen_at > now() - interval '120 seconds',
    'executionAvailability', case
      when e.device_id is null then jsonb_build_object(
        'status', 'unavailable',
        'deviceId', d.id
      )
      else jsonb_build_object(
        'status', case when e.reported_at > now() - interval '120 seconds' then 'fresh' else 'stale' end,
        'deviceId', d.id,
        'reportedAt', e.reported_at,
        'ageSeconds', greatest(0, floor(extract(epoch from (now() - e.reported_at)))::integer),
        'snapshot', jsonb_build_object(
          'algorithmVersion', e.algorithm_version,
          'focusDictionary', e.focus_dictionary,
          'plannerSnapshotId', e.planner_snapshot_id,
          'availabilityStatus', e.availability_status,
          'sessionKind', e.session_kind,
          'disposition', e.disposition,
          'reason', e.reason,
          'retryAt', e.retry_at,
          'reviewEligibleCount', e.review_eligible_count,
          'weakEligibleCount', e.weak_eligible_count,
          'correctionEligibleCount', e.correction_eligible_count,
          'correctionCooldownCount', e.correction_cooldown_count,
          'newEligibleCount', e.new_eligible_count,
          'newWordCapacity', e.new_word_capacity,
          'semanticEligibleCount', e.semantic_eligible_count,
          'readingEligibleCount', e.reading_eligible_count,
          'selectedPurpose', e.selected_purpose,
          'selectedItemCount', e.selected_item_count,
          'coverage', e.coverage
        )
      )
    end
  ) order by d.last_seen_at desc), '[]'::jsonb)
  into v_result
  from public.wenyan_devices as d
  left join public.wenyan_execution_availability_devices as e
    on e.user_id = d.user_id and e.device_id = d.id
  where d.user_id = v_user_id
    and d.last_seen_at > now() - interval '24 hours';

  return v_result;
end;
$$;

revoke all on function public.get_active_devices() from public, anon;
grant execute on function public.get_active_devices() to authenticated;

commit;
