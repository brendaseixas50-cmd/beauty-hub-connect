create schema if not exists private;

alter function public.current_tenant_id() set schema private;
alter function public.handle_new_auth_user() set schema private;
alter function public.set_updated_at() set schema private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.current_tenant_id() from public, anon;
grant execute on function private.current_tenant_id() to authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

drop policy "owners update own tenant" on public.tenants;
create policy "owners update own tenant"
on public.tenants for update to authenticated
using (
  id = private.current_tenant_id()
  and owner_id = (select auth.uid())
)
with check (
  id = private.current_tenant_id()
  and owner_id = (select auth.uid())
);

create index tenants_owner_id_idx on public.tenants (owner_id);
create index appointments_client_tenant_idx
  on public.appointments (client_id, tenant_id);
create index appointments_service_tenant_idx
  on public.appointments (service_id, tenant_id);
create index appointments_professional_tenant_idx
  on public.appointments (professional_id, tenant_id);

comment on schema private is
  'Internal helper functions. This schema is not exposed through the Data API.';
