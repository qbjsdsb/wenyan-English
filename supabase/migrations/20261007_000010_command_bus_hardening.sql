begin;

drop policy if exists "website_commands_insert_oauth_rpc" on public.website_commands;
create policy "website_commands_insert_oauth_rpc"
  on public.website_commands
  for insert
  to authenticated
  with check (
    (select auth.uid()) = website_commands.user_id
    and website_commands.client_id = ((select auth.jwt()) ->> 'client_id')
    and website_commands.client_id is not null
    and (select current_setting('wenyan.command_write_rpc', true)) = '1'
    and exists (
      select 1
      from public.wenyan_devices as d
      where d.id = website_commands.target_device_id
        and d.user_id = website_commands.user_id
    )
    and (
      (website_commands.command_type in ('open_today', 'open_dictionary', 'open_chapter') and public.wenyan_has_oauth_capability('navigation:control'))
      or (website_commands.command_type = 'start_task' and public.wenyan_has_oauth_capability('session:control'))
    )
  );

create or replace function public.get_pending_website_commands(p_device_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    raise exception 'direct_wenyan_session_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.wenyan_devices as d
    where d.id = p_device_id and d.user_id = v_user_id
  ) then
    raise exception 'device_not_found' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'type', c.command_type,
    'args', c.args,
    'createdAt', c.created_at,
    'expiresAt', c.expires_at
  ) order by c.created_at), '[]'::jsonb)
  into v_result
  from (
    select id, command_type, args, created_at, expires_at
    from public.website_commands
    where user_id = v_user_id
      and target_device_id = p_device_id
      and status = 'pending'
      and expires_at > now()
    order by created_at
    limit 20
  ) as c;

  return v_result;
end;
$$;

revoke all on function public.get_pending_website_commands(uuid) from public, anon, authenticated;
grant execute on function public.get_pending_website_commands(uuid) to authenticated;

commit;
