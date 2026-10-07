begin;

create index if not exists plan_tasks_plan_owner_idx
  on public.plan_tasks (plan_id, user_id);

create index if not exists study_plan_revisions_plan_owner_idx
  on public.study_plan_revisions (plan_id, user_id);

commit;
