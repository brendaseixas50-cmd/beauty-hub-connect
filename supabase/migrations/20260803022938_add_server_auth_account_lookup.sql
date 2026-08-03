begin;

create or replace function public.email_has_account(target_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    where lower(account.email) = lower(trim(target_email))
  );
$$;

revoke all on function public.email_has_account(text) from public;
revoke all on function public.email_has_account(text) from anon, authenticated;
grant execute on function public.email_has_account(text) to service_role;

commit;
