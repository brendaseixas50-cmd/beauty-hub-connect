create index if not exists marketing_actions_campaign_tenant_idx
  on public.marketing_actions (campaign_id, tenant_id);
create index if not exists marketing_actions_client_tenant_idx
  on public.marketing_actions (client_id, tenant_id);
create index if not exists marketing_campaigns_template_tenant_idx
  on public.marketing_campaigns (template_id, tenant_id);

drop policy if exists "managers write own marketing templates" on public.marketing_templates;
create policy "managers insert own marketing templates" on public.marketing_templates
for insert to authenticated with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
create policy "managers update own marketing templates" on public.marketing_templates
for update to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "managers delete own marketing templates" on public.marketing_templates
for delete to authenticated using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);

drop policy if exists "managers write own marketing campaigns" on public.marketing_campaigns;
create policy "managers insert own marketing campaigns" on public.marketing_campaigns
for insert to authenticated with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
create policy "managers update own marketing campaigns" on public.marketing_campaigns
for update to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "managers delete own marketing campaigns" on public.marketing_campaigns
for delete to authenticated using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner','admin')
);
