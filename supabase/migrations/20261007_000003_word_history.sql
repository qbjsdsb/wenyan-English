begin;

create index if not exists learning_events_user_word_occurred_idx
  on public.learning_events (user_id, lower(payload ->> 'word'), occurred_at desc, id desc)
  where event_type = 'word_attempted'
    and jsonb_typeof(payload -> 'word') = 'string';

create or replace function public.get_word_history(p_word text, p_limit integer default 30)
returns table (
  evidence_id uuid,
  occurred_at timestamptz,
  received_at timestamptz,
  source_version integer,
  dict text,
  chapter integer,
  review_mode boolean,
  wrong_count integer,
  duration_ms numeric,
  mistakes jsonb,
  dictation_enabled boolean,
  dictation_type text,
  task_run_id text,
  plan_id text,
  task_id text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    events.id as evidence_id,
    events.occurred_at,
    events.created_at as received_at,
    events.source_version,
    events.payload ->> 'dict' as dict,
    case
      when jsonb_typeof(events.payload -> 'chapter') = 'number'
        then (events.payload ->> 'chapter')::numeric::integer
      else null
    end as chapter,
    case
      when jsonb_typeof(events.payload -> 'reviewMode') = 'boolean'
        then (events.payload ->> 'reviewMode')::boolean
      else null
    end as review_mode,
    case
      when jsonb_typeof(events.payload -> 'wrongCount') = 'number'
        then (events.payload ->> 'wrongCount')::numeric::integer
      else null
    end as wrong_count,
    case
      when jsonb_typeof(events.payload -> 'durationMs') = 'number'
        then (events.payload ->> 'durationMs')::numeric
      else null
    end as duration_ms,
    case
      when jsonb_typeof(events.payload -> 'mistakes') = 'object'
        then events.payload -> 'mistakes'
      else null
    end as mistakes,
    case
      when jsonb_typeof(events.payload -> 'dictationEnabled') = 'boolean'
        then (events.payload ->> 'dictationEnabled')::boolean
      else null
    end as dictation_enabled,
    case
      when jsonb_typeof(events.payload -> 'dictationType') = 'string'
        then events.payload ->> 'dictationType'
      else null
    end as dictation_type,
    case
      when jsonb_typeof(events.payload -> 'taskRunId') = 'string'
        then events.payload ->> 'taskRunId'
      else null
    end as task_run_id,
    case
      when jsonb_typeof(events.payload -> 'planId') = 'string'
        then events.payload ->> 'planId'
      else null
    end as plan_id,
    case
      when jsonb_typeof(events.payload -> 'taskId') = 'string'
        then events.payload ->> 'taskId'
      else null
    end as task_id
  from public.learning_events as events
  where events.user_id = (select auth.uid())
    and events.event_type = 'word_attempted'
    and events.source = 'wenyan-english'
    and char_length(btrim(coalesce(p_word, ''))) between 1 and 100
    and jsonb_typeof(events.payload -> 'word') = 'string'
    and lower(events.payload ->> 'word') = lower(btrim(p_word))
  order by events.occurred_at desc, events.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.get_word_history(text, integer) from public, anon, authenticated;
grant execute on function public.get_word_history(text, integer) to authenticated;

commit;
