-- Follow-up optimizations identified by Supabase advisors after the premium migration.

drop index if exists public.appointments_public_request_id_unique_idx;

create index if not exists appointment_services_appointment_tenant_fk_idx
  on public.appointment_services (appointment_id, tenant_id);
create index if not exists appointment_services_service_tenant_fk_idx
  on public.appointment_services (service_id, tenant_id);
create index if not exists clients_last_professional_tenant_fk_idx
  on public.clients (last_professional_id, tenant_id);
create index if not exists marketing_automation_rules_template_tenant_fk_idx
  on public.marketing_automation_rules (template_id, tenant_id);
create index if not exists notification_outbox_appointment_tenant_fk_idx
  on public.notification_outbox (appointment_id, tenant_id);
create index if not exists professional_services_professional_tenant_fk_idx
  on public.professional_services (professional_id, tenant_id);
create index if not exists professional_services_service_tenant_fk_idx
  on public.professional_services (service_id, tenant_id);
create index if not exists user_active_tenants_user_tenant_fk_idx
  on public.user_active_tenants (user_id, tenant_id);

drop policy if exists "members manage own appointment services" on public.appointment_services;
create policy "members insert own appointment services" on public.appointment_services
for insert to authenticated with check (tenant_id = private.current_tenant_id());
create policy "members update own appointment services" on public.appointment_services
for update to authenticated using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());
create policy "members delete own appointment services" on public.appointment_services
for delete to authenticated using (tenant_id = private.current_tenant_id());

drop policy if exists "managers manage own gallery" on public.public_gallery;
create policy "managers insert own gallery" on public.public_gallery
for insert to authenticated with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
create policy "managers update own gallery" on public.public_gallery
for update to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "managers delete own gallery" on public.public_gallery
for delete to authenticated using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);

drop policy if exists "managers manage own reviews" on public.public_reviews;
create policy "managers insert own reviews" on public.public_reviews
for insert to authenticated with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
create policy "managers update own reviews" on public.public_reviews
for update to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "managers delete own reviews" on public.public_reviews
for delete to authenticated using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);

drop policy if exists "managers manage own automation rules" on public.marketing_automation_rules;
create policy "managers insert own automation rules" on public.marketing_automation_rules
for insert to authenticated with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
create policy "managers update own automation rules" on public.marketing_automation_rules
for update to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "managers delete own automation rules" on public.marketing_automation_rules
for delete to authenticated using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);

-- Direct access remains denied; writes occur only inside the rate-limited booking RPC.
create policy "deny direct booking attempt access" on public.public_booking_attempts
for all to public using (false) with check (false);
