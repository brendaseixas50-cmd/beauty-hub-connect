alter table public.tenants
  add column if not exists whatsapp_initial_message text;

alter table public.clients
  add column if not exists contact_allowed boolean not null default false,
  add column if not exists contact_preference text not null default 'whatsapp'
    check (contact_preference in ('whatsapp', 'phone', 'email', 'none'));

create table public.marketing_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  campaign_type text not null check (campaign_type in (
    'post_service', 'birthday', 'promotion', 'win_back', 'return_reminder', 'custom'
  )),
  body text not null check (char_length(trim(body)) between 2 and 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  template_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 120),
  campaign_type text not null check (campaign_type in (
    'post_service', 'birthday', 'promotion', 'win_back', 'return_reminder', 'custom'
  )),
  message text not null check (char_length(trim(message)) between 2 and 2000),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint marketing_campaigns_template_fk foreign key (template_id, tenant_id)
    references public.marketing_templates(id, tenant_id) on delete set null (template_id)
);

create table public.marketing_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  campaign_id uuid,
  client_id uuid not null,
  message_snapshot text not null check (char_length(trim(message_snapshot)) between 2 and 2000),
  status text not null default 'queued'
    check (status in ('queued', 'initiated', 'sent', 'responded', 'converted')),
  initiated_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_actions_campaign_fk foreign key (campaign_id, tenant_id)
    references public.marketing_campaigns(id, tenant_id) on delete cascade,
  constraint marketing_actions_client_fk foreign key (client_id, tenant_id)
    references public.clients(id, tenant_id) on delete cascade
);

create index marketing_templates_tenant_idx
  on public.marketing_templates (tenant_id, active, campaign_type);
create index marketing_campaigns_tenant_idx
  on public.marketing_campaigns (tenant_id, status, created_at desc);
create index marketing_actions_queue_idx
  on public.marketing_actions (tenant_id, campaign_id, status, created_at);
create index appointments_client_last_service_idx
  on public.appointments (tenant_id, client_id, starts_at desc)
  where status in ('completed', 'confirmed');

alter table public.marketing_templates enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_actions enable row level security;

create policy "members read own marketing templates" on public.marketing_templates
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "managers write own marketing templates" on public.marketing_templates
for all to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));

create policy "members read own marketing campaigns" on public.marketing_campaigns
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "managers write own marketing campaigns" on public.marketing_campaigns
for all to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));

create policy "members read own marketing actions" on public.marketing_actions
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "members create own marketing actions" on public.marketing_actions
for insert to authenticated
with check (tenant_id = private.current_tenant_id());
create policy "members update own marketing actions" on public.marketing_actions
for update to authenticated
using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());
create policy "managers delete own marketing actions" on public.marketing_actions
for delete to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));

revoke all on public.marketing_templates, public.marketing_campaigns,
  public.marketing_actions from anon;
grant select, insert, update, delete on public.marketing_templates,
  public.marketing_campaigns, public.marketing_actions to authenticated;

create or replace function public.get_public_company_page(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'slug', tenant.slug, 'name', coalesce(nullif(tenant.public_name, ''), tenant.name),
      'logoUrl', tenant.logo_url, 'bannerUrl', tenant.banner_url,
      'description', tenant.description, 'productType', tenant.product_type,
      'whatsapp', tenant.whatsapp, 'whatsappInitialMessage', tenant.whatsapp_initial_message,
      'instagram', tenant.instagram, 'addressLine', tenant.address_line,
      'city', tenant.city, 'state', tenant.state, 'postalCode', tenant.postal_code,
      'businessHours', tenant.business_hours, 'timezone', tenant.timezone,
      'primaryColor', tenant.primary_color, 'secondaryColor', tenant.secondary_color,
      'welcomeMessage', tenant.welcome_message, 'cancellationPolicy', tenant.cancellation_policy,
      'publicInformation', tenant.public_information,
      'bookingIntervalMinutes', tenant.booking_interval_minutes
    ),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'category', s.category, 'description', s.description,
      'durationMinutes', s.duration_minutes, 'priceCents', s.price_cents) order by s.name)
      from public.services s where s.tenant_id = tenant.id and s.active), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'specialty', p.specialty, 'color', p.color) order by p.name)
      from public.professionals p where p.tenant_id = tenant.id and p.active), '[]'::jsonb)
  )
  from public.tenants tenant
  where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
    and tenant.public_page_status = 'published'
  limit 1
$$;

revoke all on function public.get_public_company_page(text) from public;
grant execute on function public.get_public_company_page(text) to anon, authenticated;

comment on table public.marketing_actions is
  'Assisted WhatsApp outreach ledger. It records intent/status only and never sends automatically.';
