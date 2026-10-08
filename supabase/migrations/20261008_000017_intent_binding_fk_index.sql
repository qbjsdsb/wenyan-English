begin;

create index learning_intent_session_bindings_intent_user_idx
  on public.learning_intent_session_bindings (intent_id, user_id);

commit;
