create function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = auth.uid()
$$;

revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated;

drop policy "members manage own clients" on public.clients;
create policy "members read own clients"
on public.clients for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "members write own clients"
on public.clients for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);

drop policy "members manage own services" on public.services;
create policy "members read own services"
on public.services for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers write own services"
on public.services for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "members manage own appointments" on public.appointments;
create policy "members read own appointments"
on public.appointments for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "members write own appointments"
on public.appointments for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);

drop policy "members manage own professionals" on public.professionals;
create policy "members read own professionals"
on public.professionals for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers write own professionals"
on public.professionals for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "members manage own products" on public.products;
create policy "members read own products"
on public.products for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers write own products"
on public.products for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "members read own inventory" on public.inventory_movements;
drop policy "members create own inventory" on public.inventory_movements;
create policy "members read own inventory"
on public.inventory_movements for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers create own inventory"
on public.inventory_movements for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and created_by = (select auth.uid())
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "members manage own finances" on public.financial_entries;
create policy "managers read own finances"
on public.financial_entries for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers write own finances"
on public.financial_entries for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

comment on function private.current_role() is
  'Returns the server-controlled profile role for auth.uid(); used by RLS permission policies.';
