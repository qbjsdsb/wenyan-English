begin;

-- Plan write RPCs intentionally use `wenyan.plan_write_rpc = 1` as their
-- transaction-local trusted boundary before mutating plan rows. They call
-- get_plan_status() only to build the mutation response. Do not require an
-- additional plans:read grant for that internal response path; external OAuth
-- reads still require plans:read and direct first-party browser sessions remain
-- owner/RLS scoped.
create or replace function public.wenyan_require_plans_read_if_oauth()
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id text := nullif(auth.jwt() ->> 'client_id', '');
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  -- create/revise/archive study-plan RPCs set this transaction-local flag only
  -- after authenticating the OAuth client and checking plans:write.
  if current_setting('wenyan.plan_write_rpc', true) = '1' then
    return true;
  end if;

  -- Direct first-party browser sessions are authorized by owner checks in the
  -- browser-specific wrapper and by RLS in the plan query itself.
  if v_client_id is null then
    return true;
  end if;

  if not exists (
    select 1
    from public.oauth_client_capabilities as c
    where c.user_id = v_user_id
      and c.client_id = v_client_id
      and c.capability = 'plans:read'
  ) then
    raise exception 'plans_read_not_granted' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.wenyan_require_plans_read_if_oauth() from public, anon, authenticated;
grant execute on function public.wenyan_require_plans_read_if_oauth() to authenticated;

commit;
