begin;

create or replace function public.check_signup_attempt_and_account(
  target_email text,
  request_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  if target_email is null
    or length(target_email) > 254
    or request_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invalid signup request' using errcode = '22023';
  end if;

  delete from private.signup_attempt_limits as limits
  where limits.window_started_at < now() - interval '10 minutes';

  insert into private.signup_attempt_limits (request_fingerprint, attempt_count)
  values (check_signup_attempt_and_account.request_fingerprint, 1)
  on conflict on constraint signup_attempt_limits_pkey do update
    set attempt_count = private.signup_attempt_limits.attempt_count + 1
  returning attempt_count into current_attempts;

  if current_attempts > 5 then
    raise exception 'signup rate limit exceeded' using errcode = 'P0001';
  end if;

  return exists (
    select 1
    from auth.users as account
    where lower(account.email) = lower(trim(target_email))
  );
end;
$$;

revoke all on function public.check_signup_attempt_and_account(text, text) from public;
revoke all on function public.check_signup_attempt_and_account(text, text) from anon, authenticated;
grant execute on function public.check_signup_attempt_and_account(text, text) to service_role;

commit;
