begin;

create schema if not exists private;

create table if not exists private.signup_attempt_limits (
  request_fingerprint text primary key,
  attempt_count integer not null check (attempt_count > 0),
  window_started_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.signup_attempt_limits from public, anon, authenticated;

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

  delete from private.signup_attempt_limits
  where window_started_at < now() - interval '10 minutes';

  insert into private.signup_attempt_limits (request_fingerprint, attempt_count)
  values (request_fingerprint, 1)
  on conflict (request_fingerprint) do update
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

drop function public.email_has_account(text);

commit;
