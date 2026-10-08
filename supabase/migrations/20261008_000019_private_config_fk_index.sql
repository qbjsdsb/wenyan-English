begin;

create index if not exists wenyan_private_config_owner_id_idx
  on wenyan_private.config (owner_id);

commit;
