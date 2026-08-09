create policy "Deny client access to OAuth states"
on public.payment_provider_oauth_states for all to anon, authenticated
using (false)
with check (false);

comment on policy "Deny client access to OAuth states" on public.payment_provider_oauth_states is
  'OAuth state and PKCE verifier are available only to the server service role.';
