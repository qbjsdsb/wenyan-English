-- P1: deterministic, RLS-scoped cloud -> local learning-event restore.

create index if not exists learning_events_user_created_id_idx
  on public.learning_events (user_id, created_at asc, id asc);

create or replace function public.pull_learning_events(
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  event_type text,
  occurred_at timestamptz,
  source text,
  source_version integer,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    le.id,
    le.event_type,
    le.occurred_at,
    le.source,
    le.source_version,
    le.payload,
    le.created_at
  from public.learning_events as le
  where le.user_id = (select auth.uid())
    and (
      p_after_created_at is null
      or le.created_at > p_after_created_at
      or (le.created_at = p_after_created_at and p_after_id is not null and le.id > p_after_id)
    )
  order by le.created_at asc, le.id asc
  limit least(500, greatest(1, coalesce(p_limit, 100)));
$$;

revoke all on function public.pull_learning_events(timestamptz, uuid, integer) from public;
revoke all on function public.pull_learning_events(timestamptz, uuid, integer) from anon;
grant execute on function public.pull_learning_events(timestamptz, uuid, integer) to authenticated;
