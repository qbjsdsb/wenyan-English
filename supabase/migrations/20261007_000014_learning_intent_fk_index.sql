begin;

create index if not exists learning_intent_revisions_intent_user_idx
  on public.learning_intent_revisions (intent_id, user_id);

commit;
