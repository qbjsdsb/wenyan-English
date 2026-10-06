begin;

create table if not exists public.learning_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  source text not null default 'wenyan-english',
  source_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_events_event_type_nonempty check (char_length(event_type) between 1 and 64),
  constraint learning_events_source_version_positive check (source_version > 0)
);

create index if not exists learning_events_user_occurred_idx
  on public.learning_events (user_id, occurred_at desc);

create index if not exists learning_events_user_type_occurred_idx
  on public.learning_events (user_id, event_type, occurred_at desc);

alter table public.learning_events enable row level security;

revoke all on table public.learning_events from public, anon, authenticated;
grant select, insert on table public.learning_events to authenticated;

drop policy if exists "learning_events_select_own" on public.learning_events;
create policy "learning_events_select_own"
  on public.learning_events
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

drop policy if exists "learning_events_insert_own_direct_session" on public.learning_events;
create policy "learning_events_insert_own_direct_session"
  on public.learning_events
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create or replace function public.ingest_learning_events(p_events jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception 'OAuth clients are read-only';
  end if;

  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'p_events must be a JSON array';
  end if;

  insert into public.learning_events (
    id,
    user_id,
    event_type,
    occurred_at,
    source,
    source_version,
    payload
  )
  select
    item.id,
    (select auth.uid()),
    item.event_type,
    item.occurred_at,
    coalesce(nullif(item.source, ''), 'wenyan-english'),
    coalesce(item.source_version, 1),
    coalesce(item.payload, '{}'::jsonb)
  from jsonb_to_recordset(p_events) as item(
    id uuid,
    event_type text,
    occurred_at timestamptz,
    source text,
    source_version integer,
    payload jsonb
  )
  where item.id is not null
    and item.event_type is not null
    and item.occurred_at is not null
  on conflict (id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.ingest_learning_events(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_learning_events(jsonb) to authenticated;

create or replace function public.get_learning_overview(p_days integer default 7)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select least(greatest(coalesce(p_days, 7), 1), 365) as days
  ),
  recent as (
    select event_type, occurred_at, payload
    from public.learning_events, bounds
    where user_id = (select auth.uid())
      and occurred_at >= now() - make_interval(days => bounds.days)
  ),
  word_attempts as (
    select
      occurred_at,
      case
        when jsonb_typeof(payload -> 'wrongCount') = 'number' then (payload ->> 'wrongCount')::integer
        else null
      end as wrong_count,
      case
        when jsonb_typeof(payload -> 'durationMs') = 'number' then (payload ->> 'durationMs')::numeric
        else null
      end as duration_ms
    from recent
    where event_type = 'word_attempted'
  ),
  word_stats as (
    select
      count(*) as attempts,
      count(*) filter (where wrong_count = 0) as first_try_correct,
      round(avg(duration_ms), 0) as avg_duration_ms
    from word_attempts
  )
  select jsonb_build_object(
    'days', (select days from bounds),
    'events', (select count(*) from recent),
    'studyDays', (select count(distinct occurred_at::date) from recent),
    'wordAttempts', word_stats.attempts,
    'firstTryCorrect', word_stats.first_try_correct,
    'firstTryAccuracy', case
      when word_stats.attempts = 0 then null
      else round((word_stats.first_try_correct::numeric * 100.0) / word_stats.attempts::numeric, 1)
    end,
    'avgDurationMs', word_stats.avg_duration_ms
  )
  from word_stats;
$$;

revoke all on function public.get_learning_overview(integer) from public, anon, authenticated;
grant execute on function public.get_learning_overview(integer) to authenticated;

create or replace function public.get_weak_words(p_days integer default 30, p_limit integer default 50)
returns table (
  word text,
  attempts bigint,
  mistake_attempts bigint,
  avg_duration_ms numeric,
  last_seen timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    events.payload ->> 'word' as word,
    count(*) as attempts,
    count(*) filter (
      where jsonb_typeof(events.payload -> 'wrongCount') = 'number'
        and (events.payload ->> 'wrongCount')::integer > 0
    ) as mistake_attempts,
    round(avg(
      case
        when jsonb_typeof(events.payload -> 'durationMs') = 'number'
          then (events.payload ->> 'durationMs')::numeric
        else null
      end
    ), 0) as avg_duration_ms,
    max(events.occurred_at) as last_seen
  from public.learning_events as events
  where events.user_id = (select auth.uid())
    and events.event_type = 'word_attempted'
    and events.occurred_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    and jsonb_typeof(events.payload -> 'word') = 'string'
  group by events.payload ->> 'word'
  having count(*) >= 2
  order by mistake_attempts desc, avg_duration_ms desc nulls last, last_seen desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_weak_words(integer, integer) from public, anon, authenticated;
grant execute on function public.get_weak_words(integer, integer) to authenticated;

commit;
