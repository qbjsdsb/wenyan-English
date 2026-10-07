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
       or jsonb_array_length(p_constraints->'preferredActivities') > 9 then
      raise exception 'invalid_preferred_activities' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_constraints->'preferredActivities') as items(item)
      where jsonb_typeof(item) <> 'string'
         or item #>> '{}' not in ('vocabulary','reading','dictation','cloze','translation','writing','grammar','long_sentence','new_question_type')
    ) then raise exception 'invalid_preferred_activity' using errcode = '22023'; end if;
    if (
      select count(*) <> count(distinct item #>> '{}')
      from jsonb_array_elements(p_constraints->'preferredActivities') as items(item)
    ) then raise exception 'duplicate_preferred_activity' using errcode = '22023'; end if;
  end if;
end;
$$;

create or replace function public.wenyan_validate_intent_goals(p_goals jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_goals is null or jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) > 20 then
    raise exception 'invalid_intent_goals' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_goals) as goals(goal)
    where jsonb_typeof(goal) <> 'object'
      or exists (select 1 from jsonb_object_keys(goal) as keys(key) where key not in ('kind','description','horizon'))
      or jsonb_typeof(goal->'kind') <> 'string'
      or jsonb_typeof(goal->'description') <> 'string'
      or jsonb_typeof(goal->'horizon') <> 'string'
      or coalesce(goal->>'kind','') not in ('exam_preparation','reading_transfer','question_practice')
      or char_length(coalesce(goal->>'description','')) not between 1 and 500
      or coalesce(goal->>'horizon','') not in ('week','phase')
  ) then raise exception 'invalid_intent_goal_shape' using errcode = '22023'; end if;
end;
$$;

create or replace function public.wenyan_validate_intent_rationale(p_rationale jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_rationale is null or jsonb_typeof(p_rationale) <> 'object' then
    raise exception 'invalid_intent_rationale' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_rationale) as keys(key)
    where key not in ('summary','basis','evidenceIds','confidence','uncertainties')
  ) then raise exception 'invalid_intent_rationale_key' using errcode = '22023'; end if;
  if p_rationale ? 'summary' and (
    jsonb_typeof(p_rationale->'summary') <> 'string' or char_length(p_rationale->>'summary') > 1000
  ) then raise exception 'invalid_intent_summary' using errcode = '22023'; end if;
  if p_rationale ? 'basis' and (
    jsonb_typeof(p_rationale->'basis') <> 'string'
    or coalesce(p_rationale->>'basis','') not in ('user_statement','observed_evidence','inference','default')
  ) then raise exception 'invalid_intent_basis' using errcode = '22023'; end if;
  if p_rationale ? 'confidence' and (
    jsonb_typeof(p_rationale->'confidence') <> 'string'
    or coalesce(p_rationale->>'confidence','') not in ('low','medium','high')
  ) then raise exception 'invalid_intent_confidence' using errcode = '22023'; end if;
  if p_rationale ? 'evidenceIds' then
    if jsonb_typeof(p_rationale->'evidenceIds') <> 'array' or jsonb_array_length(p_rationale->'evidenceIds') > 50 then
      raise exception 'invalid_intent_evidence_ids' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_rationale->'evidenceIds') as evidence(item)
      where jsonb_typeof(item) <> 'string'
         or item #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then raise exception 'invalid_intent_evidence_id' using errcode = '22023'; end if;
  end if;
  if p_rationale ? 'uncertainties' then
    if jsonb_typeof(p_rationale->'uncertainties') <> 'array' or jsonb_array_length(p_rationale->'uncertainties') > 20 then
      raise exception 'invalid_intent_uncertainties' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_rationale->'uncertainties') as uncertainties(item)
      where jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') > 500
    ) then raise exception 'invalid_intent_uncertainty' using errcode = '22023'; end if;
  end if;
end;
$$;

create or replace function public.revise_learning_intent(
  p_request_id text,
  p_scope text,
  p_expected_revision integer,
  p_timezone text default 'Asia/Shanghai',
  p_effective_from timestamptz default null,
  p_expires_at timestamptz default null,
  p_constraints jsonb default '{}'::jsonb,
  p_goals jsonb default '[]'::jsonb,
  p_rationale jsonb default '{}'::jsonb,
  p_change_reason text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_oauth_client_id text := nullif(auth.jwt()->>'client_id','');
  v_actor text := coalesce(v_oauth_client_id,'direct-session');
  v_effective_from timestamptz;
  v_existing public.learning_intents%rowtype;
  v_row public.learning_intents%rowtype;
  v_receipt public.learning_intent_mutation_receipts%rowtype;
  v_request jsonb;
  v_response jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if v_oauth_client_id is not null and not public.wenyan_has_oauth_capability('coach:auto_adjust') then
    raise exception 'coach_auto_adjust_not_granted' using errcode = '42501';
  end if;
  if p_request_id is null or char_length(p_request_id) not between 8 and 120 or p_request_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_scope not in ('ongoing','day','session') then raise exception 'invalid_intent_scope' using errcode = '22023'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'invalid_expected_revision' using errcode = '22023'; end if;
  if char_length(coalesce(p_change_reason,'')) > 1000 then raise exception 'invalid_change_reason' using errcode = '22023'; end if;

  v_request := jsonb_build_object(
    'scope',p_scope,'expectedRevision',p_expected_revision,'timezone',p_timezone,
    'effectiveFrom',p_effective_from,'expiresAt',p_expires_at,'constraints',p_constraints,
    'goals',p_goals,'rationale',p_rationale,'changeReason',p_change_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':learning-intent:' || p_scope,0));

  select * into v_receipt
  from public.learning_intent_mutation_receipts as r
  where r.user_id = v_user_id and r.client_id = v_actor and r.request_id = p_request_id;
  if found then
    if v_receipt.operation <> 'revise' or v_receipt.scope <> p_scope or v_receipt.request_body <> v_request then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;
    return v_receipt.response;
  end if;

  v_effective_from := coalesce(p_effective_from,now());
  if char_length(coalesce(p_timezone,'')) not between 1 and 64
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= v_effective_from then raise exception 'invalid_intent_expiry' using errcode = '22023'; end if;
  if p_scope = 'session' and (p_expires_at is null or p_expires_at > v_effective_from + interval '12 hours') then
    raise exception 'invalid_session_intent_expiry' using errcode = '22023';
  end if;
  if p_scope = 'day' and (p_expires_at is null or p_expires_at > v_effective_from + interval '48 hours') then
    raise exception 'invalid_day_intent_expiry' using errcode = '22023';
  end if;
  perform public.wenyan_validate_session_constraints(p_constraints);
  perform public.wenyan_validate_intent_goals(p_goals);
  perform public.wenyan_validate_intent_rationale(p_rationale);

  select * into v_existing from public.learning_intents as i
  where i.user_id = v_user_id and i.scope = p_scope for update;
  perform set_config('wenyan.intent_write_rpc','1',true);

  if not found then
    if p_expected_revision <> 0 then raise exception 'revision_conflict' using errcode = '40001'; end if;
    insert into public.learning_intents (
      user_id,scope,timezone,status,revision,effective_from,expires_at,constraints,goals,rationale,created_by_client_id,updated_by_client_id
    ) values (
      v_user_id,p_scope,p_timezone,'active',1,v_effective_from,p_expires_at,p_constraints,p_goals,p_rationale,v_oauth_client_id,v_oauth_client_id
    ) returning * into v_row;
  else
    if v_existing.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
    update public.learning_intents set
      timezone=p_timezone,status='active',revision=revision+1,effective_from=v_effective_from,expires_at=p_expires_at,
      constraints=p_constraints,goals=p_goals,rationale=p_rationale,updated_by_client_id=v_oauth_client_id,updated_at=now()
    where id=v_existing.id and user_id=v_user_id returning * into v_row;
  end if;

  v_response := public.wenyan_learning_intent_snapshot(v_row.id);
  insert into public.learning_intent_revisions(intent_id,user_id,revision,snapshot,change_reason,created_by_client_id)
    values (v_row.id,v_user_id,v_row.revision,v_response,p_change_reason,v_oauth_client_id);
  insert into public.learning_intent_mutation_receipts(user_id,client_id,request_id,operation,scope,request_body,response)
    values (v_user_id,v_actor,p_request_id,'revise',p_scope,v_request,v_response);
  return v_response;
end;
$$;

create or replace function public.clear_learning_intent(
  p_request_id text,
  p_scope text,
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
  v_oauth_client_id text := nullif(auth.jwt()->>'client_id','');
  v_actor text := coalesce(v_oauth_client_id,'direct-session');
  v_existing public.learning_intents%rowtype;
  v_row public.learning_intents%rowtype;
  v_receipt public.learning_intent_mutation_receipts%rowtype;
  v_request jsonb;
  v_response jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if v_oauth_client_id is not null and not public.wenyan_has_oauth_capability('coach:auto_adjust') then
    raise exception 'coach_auto_adjust_not_granted' using errcode = '42501';
  end if;
  if p_request_id is null or char_length(p_request_id) not between 8 and 120 or p_request_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_scope not in ('ongoing','day','session') then raise exception 'invalid_intent_scope' using errcode = '22023'; end if;
  if p_expected_revision is null or p_expected_revision < 1 then raise exception 'invalid_expected_revision' using errcode = '22023'; end if;
  if char_length(coalesce(p_change_reason,'')) > 1000 then raise exception 'invalid_change_reason' using errcode = '22023'; end if;

  v_request := jsonb_build_object('scope',p_scope,'expectedRevision',p_expected_revision,'changeReason',p_change_reason);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':learning-intent:' || p_scope,0));

  select * into v_receipt
  from public.learning_intent_mutation_receipts as r
  where r.user_id=v_user_id and r.client_id=v_actor and r.request_id=p_request_id;
  if found then
    if v_receipt.operation <> 'clear' or v_receipt.scope <> p_scope or v_receipt.request_body <> v_request then
      raise exception 'request_id_conflict' using errcode = '23505';
    end if;
    return v_receipt.response;
  end if;

  select * into v_existing from public.learning_intents as i
  where i.user_id=v_user_id and i.scope=p_scope for update;
  if not found then raise exception 'intent_not_found' using errcode = '22023'; end if;
  if v_existing.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;

  perform set_config('wenyan.intent_write_rpc','1',true);
  update public.learning_intents set status='archived',revision=revision+1,updated_by_client_id=v_oauth_client_id,updated_at=now()
  where id=v_existing.id and user_id=v_user_id returning * into v_row;

  v_response := public.wenyan_learning_intent_snapshot(v_row.id);
  insert into public.learning_intent_revisions(intent_id,user_id,revision,snapshot,change_reason,created_by_client_id)
    values (v_row.id,v_user_id,v_row.revision,v_response,p_change_reason,v_oauth_client_id);
  insert into public.learning_intent_mutation_receipts(user_id,client_id,request_id,operation,scope,request_body,response)
    values (v_user_id,v_actor,p_request_id,'clear',p_scope,v_request,v_response);
  return v_response;
end;
$$;

commit;
