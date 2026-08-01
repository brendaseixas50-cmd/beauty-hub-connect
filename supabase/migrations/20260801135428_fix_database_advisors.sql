alter extension btree_gist set schema extensions;

create index financial_entries_appointment_tenant_idx
  on public.financial_entries (appointment_id, tenant_id)
  where appointment_id is not null;
create index inventory_movements_product_tenant_idx
  on public.inventory_movements (product_id, tenant_id);
create index inventory_movements_created_by_idx
  on public.inventory_movements (created_by);
create index professionals_user_id_idx
  on public.professionals (user_id)
  where user_id is not null;

drop policy "members write own clients" on public.clients;
create policy "members insert own clients"
on public.clients for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);
create policy "members update own clients"
on public.clients for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);
create policy "members delete own clients"
on public.clients for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);

drop policy "managers write own services" on public.services;
create policy "managers insert own services"
on public.services for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own services"
on public.services for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own services"
on public.services for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "members write own appointments" on public.appointments;
create policy "members insert own appointments"
on public.appointments for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);
create policy "members update own appointments"
on public.appointments for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);
create policy "members delete own appointments"
on public.appointments for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);

drop policy "managers write own professionals" on public.professionals;
create policy "managers insert own professionals"
on public.professionals for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own professionals"
on public.professionals for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own professionals"
on public.professionals for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "managers write own products" on public.products;
create policy "managers insert own products"
on public.products for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own products"
on public.products for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own products"
on public.products for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy "managers write own finances" on public.financial_entries;
create policy "managers insert own finances"
on public.financial_entries for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own finances"
on public.financial_entries for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own finances"
on public.financial_entries for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
