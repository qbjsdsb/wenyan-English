begin;

-- get_plan_status() is SECURITY INVOKER and calls these pure immutable helpers.
-- Migration 20261010_000024 intentionally removed PUBLIC/anon access, but also
-- removed authenticated EXECUTE, which made the otherwise-authorized plan read
-- fail inside the helper call. Restore only the authenticated execution edge;
-- neither helper reads tables nor mutates learning history.
revoke all on function public.wenyan_chapter_task_execution_fingerprint(jsonb) from public, anon;
revoke all on function public.wenyan_completion_matches_chapter_task(jsonb, jsonb) from public, anon;

grant execute on function public.wenyan_chapter_task_execution_fingerprint(jsonb) to authenticated;
grant execute on function public.wenyan_completion_matches_chapter_task(jsonb, jsonb) to authenticated;

commit;
