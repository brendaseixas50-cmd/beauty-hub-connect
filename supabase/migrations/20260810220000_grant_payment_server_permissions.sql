-- Payment credentials and OAuth state remain inaccessible to browser roles.
-- The backend service role needs explicit DML grants because the hardened
-- default privileges intentionally do not grant them on newly created tables.
revoke all on public.payment_provider_oauth_states from anon, authenticated;
revoke all on public.payment_provider_connections from anon;
revoke all on public.payment_provider_transactions from anon;

grant select, insert, update, delete
on public.payment_provider_oauth_states
to service_role;

grant select, insert, update, delete
on public.payment_provider_connections
to service_role;

grant select, insert, update, delete
on public.payment_provider_transactions
to service_role;

comment on table public.payment_provider_oauth_states is
  'Server-only OAuth state and encrypted PKCE verifier. Browser roles have no privileges.';
