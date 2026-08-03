-- Final premium public experience, independent licenses and notification outbox.
-- Meta credentials are intentionally not stored here. Only server-side secret names are persisted.

alter table public.tenants
  add column if not exists photo_url text,
  add column if not exists facebook text,
  add column if not exists map_url text,
  add column if not exists accent_color text not null default '#d8a7b1',
  add column if not exists button_color text not null default '#8b5e67',
  add column if not exists card_color text not null default '#ffffff',
  add column if not exists menu_color text not null default '#fffaf7',
  add column if not exists background_color text not null default '#fffaf7',
  add column if not exists title_color text not null default '#2d211f',
  add column if not exists text_color text not null default '#5f514d',
  add column if not exists whatsapp_notification_phone text,
  add column if not exists whatsapp_integration_mode text not null default 'development'
    check (whatsapp_integration_mode in ('development', 'cloud_api')),
  add column if not exists meta_phone_number_id text,
  add column if not exists meta_waba_id text,
  add column if not exists meta_access_token_secret_name text not null
    default 'META_WHATSAPP_ACCESS_TOKEN',
  add column if not exists meta_webhook_verify_secret_name text not null
    default 'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN';

alter table public.professionals
  add column if not exists photo_url text,
  add column if not exists bio text;

alter table public.products
  add column if not exists image_url text,
  add column if not exists public_visible boolean not null default false;

alter table public.clients
  add column if not exists phone_normalized text generated always as
    (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored,
  add column if not exists appointment_count integer not null default 0,
  add column if not exists last_appointment_at timestamptz,
  add column if not exists last_professional_id uuid,
  add constraint clients_last_professional_fk foreign key (last_professional_id, tenant_id)
    references public.professionals(id, tenant_id) on delete set null (last_professional_id);

create table public.tenant_licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  product_type text not null check (product_type in ('beauty', 'barber')),
  status text not null default 'active'
    check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  suspended_at timestamptz,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint tenant_license_matches_product check (product_type in ('beauty', 'barber'))
);

insert into public.tenant_licenses (tenant_id, product_type, status)
select id, product_type, case when status = 'active' then 'active' else 'suspended' end
from public.tenants
on conflict (tenant_id) do update set product_type = excluded.product_type;

create or replace function private.ensure_tenant_license()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tenant_licenses (tenant_id, product_type, status)
  values (new.id, new.product_type, case when new.status = 'active' then 'active' else 'suspended' end)
  on conflict (tenant_id) do update set
    product_type = excluded.product_type;
  return new;
end;
$$;

create trigger tenants_ensure_license
after insert on public.tenants
for each row execute function private.ensure_tenant_license();

create table public.public_gallery (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.public_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  client_name text not null check (char_length(trim(client_name)) between 2 and 120),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 2 and 1000),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.professional_services (
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id),
  foreign key (professional_id, tenant_id)
    references public.professionals(id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id)
    references public.services(id, tenant_id) on delete cascade
);

create table public.appointment_services (
  appointment_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null,
  position integer not null default 0,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  primary key (appointment_id, service_id),
  foreign key (appointment_id, tenant_id)
    references public.appointments(id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id)
    references public.services(id, tenant_id) on delete restrict
);

insert into public.appointment_services
  (appointment_id, tenant_id, service_id, position, duration_minutes, price_cents)
select appointment.id, appointment.tenant_id, appointment.service_id, 0,
  service.duration_minutes, appointment.price_cents
from public.appointments appointment
join public.services service on service.id = appointment.service_id
  and service.tenant_id = appointment.tenant_id
on conflict (appointment_id, service_id) do nothing;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid,
  channel text not null check (channel in ('dashboard', 'whatsapp')),
  event_type text not null check (event_type in (
    'booking_created', 'booking_confirmed', 'booking_cancelled', 'marketing_message'
  )),
  recipient text,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'meta_whatsapp_cloud_api'
    check (provider in ('dashboard', 'meta_whatsapp_cloud_api')),
  status text not null default 'pending'
    check (status in ('pending', 'development', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (appointment_id, tenant_id)
    references public.appointments(id, tenant_id) on delete cascade
);

create table public.public_booking_attempts (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fingerprint_hash text not null,
  created_at timestamptz not null default now()
);

create table public.marketing_automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  campaign_type text not null check (campaign_type in (
    'post_service', 'birthday', 'promotion', 'win_back', 'return_reminder', 'custom'
  )),
  name text not null check (char_length(trim(name)) between 2 and 120),
  template_id uuid,
  delay_days integer not null default 0 check (delay_days between 0 and 3650),
  inactive_days integer check (inactive_days is null or inactive_days between 1 and 3650),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (template_id, tenant_id)
    references public.marketing_templates(id, tenant_id) on delete set null (template_id)
);

create index tenant_licenses_status_idx on public.tenant_licenses (tenant_id, status, product_type);
create unique index if not exists appointments_public_request_id_unique_idx
  on public.appointments (public_request_id) where public_request_id is not null;
create unique index if not exists clients_tenant_phone_normalized_unique_idx
  on public.clients (tenant_id, phone_normalized) where phone_normalized is not null;
create index public_gallery_tenant_idx on public.public_gallery (tenant_id, active, sort_order);
create index public_reviews_tenant_idx on public.public_reviews (tenant_id, active, sort_order);
create index professional_services_tenant_idx on public.professional_services (tenant_id, service_id);
create index appointment_services_tenant_idx on public.appointment_services (tenant_id, appointment_id);
create index notification_outbox_queue_idx
  on public.notification_outbox (tenant_id, status, available_at, created_at);
create index public_booking_attempts_limit_idx
  on public.public_booking_attempts (tenant_id, fingerprint_hash, created_at desc);
create index marketing_automation_rules_tenant_idx
  on public.marketing_automation_rules (tenant_id, active, campaign_type);

create trigger tenant_licenses_set_updated_at before update on public.tenant_licenses
for each row execute function private.set_updated_at();
create trigger public_gallery_set_updated_at before update on public.public_gallery
for each row execute function private.set_updated_at();
create trigger public_reviews_set_updated_at before update on public.public_reviews
for each row execute function private.set_updated_at();
create trigger notification_outbox_set_updated_at before update on public.notification_outbox
for each row execute function private.set_updated_at();
create trigger marketing_automation_rules_set_updated_at
before update on public.marketing_automation_rules
for each row execute function private.set_updated_at();

alter table public.tenant_licenses enable row level security;
alter table public.public_gallery enable row level security;
alter table public.public_reviews enable row level security;
alter table public.professional_services enable row level security;
alter table public.appointment_services enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.public_booking_attempts enable row level security;
alter table public.marketing_automation_rules enable row level security;

create policy "members read own license" on public.tenant_licenses for select to authenticated
using (exists (
  select 1 from public.tenant_memberships membership
  where membership.tenant_id = tenant_licenses.tenant_id
    and membership.user_id = (select auth.uid())
));
create policy "members read own gallery" on public.public_gallery for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers manage own gallery" on public.public_gallery for all to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "members read own reviews" on public.public_reviews for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers manage own reviews" on public.public_reviews for all to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));
create policy "members manage own professional services" on public.professional_services
for all to authenticated using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());
create policy "members read own appointment services" on public.appointment_services
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "members manage own appointment services" on public.appointment_services
for all to authenticated using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());
create policy "members read own notifications" on public.notification_outbox
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "members read own automation rules" on public.marketing_automation_rules
for select to authenticated using (tenant_id = private.current_tenant_id());
create policy "managers manage own automation rules" on public.marketing_automation_rules
for all to authenticated
using (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'))
with check (tenant_id = private.current_tenant_id() and (select private.current_role()) in ('owner','admin'));

revoke all on public.tenant_licenses, public.public_gallery, public.public_reviews,
  public.professional_services, public.appointment_services, public.notification_outbox,
  public.public_booking_attempts, public.marketing_automation_rules from anon;
grant select on public.tenant_licenses to authenticated;
grant select, insert, update, delete on public.public_gallery, public.public_reviews,
  public.professional_services, public.appointment_services, public.marketing_automation_rules
  to authenticated;
grant select on public.notification_outbox to authenticated;

create or replace function public.get_public_company_page_v2(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'slug', tenant.slug, 'name', coalesce(nullif(tenant.public_name, ''), tenant.name),
      'logoUrl', tenant.logo_url, 'bannerUrl', tenant.banner_url, 'photoUrl', tenant.photo_url,
      'description', tenant.description, 'productType', tenant.product_type,
      'phone', tenant.phone, 'whatsapp', tenant.whatsapp,
      'whatsappInitialMessage', tenant.whatsapp_initial_message,
      'instagram', tenant.instagram, 'facebook', tenant.facebook,
      'addressLine', tenant.address_line, 'city', tenant.city, 'state', tenant.state,
      'postalCode', tenant.postal_code, 'mapUrl', tenant.map_url,
      'businessHours', tenant.business_hours, 'timezone', tenant.timezone,
      'primaryColor', tenant.primary_color, 'secondaryColor', tenant.secondary_color,
      'accentColor', tenant.accent_color, 'buttonColor', tenant.button_color,
      'cardColor', tenant.card_color, 'menuColor', tenant.menu_color,
      'backgroundColor', tenant.background_color, 'titleColor', tenant.title_color,
      'textColor', tenant.text_color, 'welcomeMessage', tenant.welcome_message,
      'cancellationPolicy', tenant.cancellation_policy,
      'publicInformation', tenant.public_information,
      'bookingIntervalMinutes', tenant.booking_interval_minutes
    ),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
      'id', service.id, 'name', service.name, 'category', service.category,
      'description', service.description, 'durationMinutes', service.duration_minutes,
      'priceCents', service.price_cents) order by service.category, service.name)
      from public.services service where service.tenant_id = tenant.id and service.active), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object(
      'id', professional.id, 'name', professional.name, 'specialty', professional.specialty,
      'color', professional.color, 'photoUrl', professional.photo_url, 'bio', professional.bio,
      'serviceIds', coalesce((select jsonb_agg(link.service_id)
        from public.professional_services link
        where link.tenant_id = tenant.id and link.professional_id = professional.id), '[]'::jsonb)
    ) order by professional.name)
      from public.professionals professional
      where professional.tenant_id = tenant.id and professional.active), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
      'id', product.id, 'name', product.name, 'description', product.description,
      'priceCents', product.sale_price_cents, 'imageUrl', product.image_url) order by product.name)
      from public.products product where product.tenant_id = tenant.id
        and product.active and product.public_visible), '[]'::jsonb),
    'gallery', coalesce((select jsonb_agg(jsonb_build_object(
      'id', gallery.id, 'imageUrl', gallery.image_url, 'altText', gallery.alt_text)
      order by gallery.sort_order, gallery.created_at)
      from public.public_gallery gallery where gallery.tenant_id = tenant.id and gallery.active), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
      'id', review.id, 'clientName', review.client_name, 'rating', review.rating,
      'comment', review.comment) order by review.sort_order, review.created_at desc)
      from public.public_reviews review where review.tenant_id = tenant.id and review.active), '[]'::jsonb)
  )
  from public.tenants tenant
  join public.tenant_licenses license on license.tenant_id = tenant.id
    and license.product_type = tenant.product_type and license.status in ('trial','active')
  where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
    and tenant.public_page_status = 'published'
  limit 1
$$;

revoke all on function public.get_public_company_page_v2(text) from public;
grant execute on function public.get_public_company_page_v2(text) to anon, authenticated;

create or replace function public.get_public_booking_availability_v2(
  p_slug text, p_date date, p_service_ids uuid[], p_professional_id uuid default null
) returns jsonb language sql stable security definer set search_path = '' as $$
  with target as (
    select tenant.id, tenant.timezone, tenant.business_hours, tenant.booking_interval_minutes,
      case extract(dow from p_date)::integer
        when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
        when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday'
        else 'saturday' end as weekday
    from public.tenants tenant
    join public.tenant_licenses license on license.tenant_id = tenant.id
      and license.product_type = tenant.product_type and license.status in ('trial','active')
    where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
      and tenant.public_page_status = 'published'
  ), duration as (
    select sum(service.duration_minutes)::integer as minutes, count(*)::integer as service_count
    from public.services service, target
    where service.tenant_id = target.id and service.active and service.id = any(p_service_ids)
  ), hours as (
    select target.*,
      split_part(target.business_hours ->> target.weekday, '-', 1)::time as opens_at,
      split_part(target.business_hours ->> target.weekday, '-', 2)::time as closes_at
    from target
    where coalesce(target.business_hours ->> target.weekday, 'closed') <> 'closed'
      and target.business_hours ->> target.weekday ~ '^([0-2][0-9]):[0-5][0-9]-([0-2][0-9]):[0-5][0-9]$'
  ), professionals as (
    select professional.id as professional_id, professional.name,
      hours.id as tenant_id, hours.timezone, hours.booking_interval_minutes,
      hours.opens_at, hours.closes_at
    from public.professionals professional join hours on hours.id = professional.tenant_id
    where professional.active and (p_professional_id is null or professional.id = p_professional_id)
      and (not exists (select 1 from public.professional_services existing
            where existing.tenant_id = professional.tenant_id and existing.professional_id = professional.id)
        or not exists (select 1 from unnest(p_service_ids) requested(service_id)
            where not exists (select 1 from public.professional_services link
              where link.tenant_id = professional.tenant_id
                and link.professional_id = professional.id and link.service_id = requested.service_id)))
  ), slots as (
    select professional.professional_id, professional.name,
      candidate as starts_at, candidate + make_interval(mins => duration.minutes) as ends_at
    from professionals professional cross join duration
    cross join lateral generate_series(
      (p_date + professional.opens_at)::timestamp at time zone professional.timezone,
      ((p_date + professional.closes_at)::timestamp at time zone professional.timezone)
        - make_interval(mins => duration.minutes),
      make_interval(mins => professional.booking_interval_minutes)
    ) candidate
    where duration.service_count = cardinality(p_service_ids) and candidate > now()
  ), available as (
    select slot.* from slots slot, target
    where not exists (select 1 from public.appointments appointment
      where appointment.tenant_id = target.id
        and appointment.professional_id = slot.professional_id
        and appointment.status in ('scheduled','confirmed')
        and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
          && tstzrange(slot.starts_at, slot.ends_at, '[)'))
  ), grouped as (
    select starts_at, ends_at,
      jsonb_agg(jsonb_build_object('id', professional_id, 'name', name) order by name) professionals
    from available group by starts_at, ends_at
  )
  select jsonb_build_object(
    'date', p_date,
    'slots', coalesce(jsonb_agg(jsonb_build_object(
      'startsAt', starts_at, 'endsAt', ends_at, 'professionals', professionals
    ) order by starts_at), '[]'::jsonb)
  ) from grouped
$$;

revoke all on function public.get_public_booking_availability_v2(text, date, uuid[], uuid) from public;
grant execute on function public.get_public_booking_availability_v2(text, date, uuid[], uuid)
  to anon, authenticated;

create or replace function public.create_public_booking_v2(
  p_slug text, p_service_ids uuid[], p_professional_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_customer_email text,
  p_customer_birth_date date, p_notes text, p_request_id uuid,
  p_fingerprint text, p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_tenant public.tenants%rowtype;
  selected_professional public.professionals%rowtype;
  normalized_phone text;
  normalized_email text;
  total_duration integer;
  total_price integer;
  service_count integer;
  client_uuid uuid;
  appointment_uuid uuid;
  end_time timestamptz;
  booking_code text;
  notification_status text;
  local_start timestamp;
  local_end timestamp;
  weekday_key text;
  opening_hours text;
  opens_at time;
  closes_at time;
begin
  if coalesce(trim(p_honeypot), '') <> '' then
    return jsonb_build_object('ok', false, 'error', 'Não foi possível confirmar o agendamento.');
  end if;
  if cardinality(p_service_ids) is null or cardinality(p_service_ids) < 1
     or cardinality(p_service_ids) > 8 or p_starts_at <= now()
     or char_length(trim(p_customer_name)) not between 2 and 120
     or char_length(coalesce(p_notes, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'Revise os dados do agendamento.');
  end if;

  select tenant.* into target_tenant
  from public.tenants tenant
  join public.tenant_licenses license on license.tenant_id = tenant.id
    and license.product_type = tenant.product_type and license.status in ('trial','active')
  where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
    and tenant.public_page_status = 'published';
  if target_tenant.id is null then
    return jsonb_build_object('ok', false, 'error', 'Página indisponível.');
  end if;

  normalized_phone := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
  if char_length(normalized_phone) < 10 or char_length(normalized_phone) > 15 then
    return jsonb_build_object('ok', false, 'error', 'Informe um telefone válido.');
  end if;
  normalized_email := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  if normalized_email is not null and
    (position('@' in normalized_email) <= 1 or position('.' in split_part(normalized_email, '@', 2)) <= 1) then
    return jsonb_build_object('ok', false, 'error', 'Informe um e-mail válido.');
  end if;

  if (select count(*) from public.public_booking_attempts attempt
      where attempt.tenant_id = target_tenant.id
        and attempt.fingerprint_hash = encode(digest(p_fingerprint, 'sha256'), 'hex')
        and attempt.created_at > now() - interval '1 hour') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde e tente novamente.');
  end if;
  insert into public.public_booking_attempts (tenant_id, fingerprint_hash)
  values (target_tenant.id, encode(digest(p_fingerprint, 'sha256'), 'hex'));

  select professional.* into selected_professional from public.professionals professional
  where professional.id = p_professional_id and professional.tenant_id = target_tenant.id
    and professional.active;
  if selected_professional.id is null then
    return jsonb_build_object('ok', false, 'error', 'Profissional indisponível.');
  end if;

  select count(*), sum(service.duration_minutes), sum(service.price_cents)
  into service_count, total_duration, total_price
  from public.services service
  where service.tenant_id = target_tenant.id and service.active and service.id = any(p_service_ids);
  if service_count <> cardinality(p_service_ids) then
    return jsonb_build_object('ok', false, 'error', 'Um dos serviços está indisponível.');
  end if;
  if exists (select 1 from public.professional_services link
    where link.tenant_id = target_tenant.id and link.professional_id = p_professional_id)
    and exists (select 1 from unnest(p_service_ids) service_id
      where not exists (select 1 from public.professional_services link
        where link.tenant_id = target_tenant.id and link.professional_id = p_professional_id
          and link.service_id = service_id)) then
    return jsonb_build_object('ok', false, 'error', 'O profissional não realiza todos os serviços.');
  end if;

  end_time := p_starts_at + make_interval(mins => total_duration);
  local_start := p_starts_at at time zone target_tenant.timezone;
  local_end := end_time at time zone target_tenant.timezone;
  weekday_key := case extract(dow from local_start)::integer
    when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
    when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday'
    else 'saturday' end;
  opening_hours := target_tenant.business_hours ->> weekday_key;
  if coalesce(opening_hours, 'closed') = 'closed'
     or opening_hours !~ '^([0-2][0-9]):[0-5][0-9]-([0-2][0-9]):[0-5][0-9]$' then
    return jsonb_build_object('ok', false, 'error', 'A empresa não atende nessa data.');
  end if;
  opens_at := split_part(opening_hours, '-', 1)::time;
  closes_at := split_part(opening_hours, '-', 2)::time;
  if local_start::time < opens_at or local_end::time > closes_at
     or local_start::date <> local_end::date
     or local_start::date > ((now() at time zone target_tenant.timezone)::date + 180)
     or mod(
       extract(epoch from (local_start::time - opens_at))::integer,
       greatest(target_tenant.booking_interval_minutes, 1) * 60
     ) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'Este horário não está disponível.');
  end if;
  if exists (select 1 from public.appointments appointment
    where appointment.tenant_id = target_tenant.id
      and appointment.professional_id = p_professional_id
      and appointment.status in ('scheduled','confirmed')
      and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
        && tstzrange(p_starts_at, end_time, '[)')) then
    return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
  end if;

  select client.id into client_uuid from public.clients client
  where client.tenant_id = target_tenant.id and client.phone_normalized = normalized_phone
  order by client.created_at limit 1;
  if client_uuid is null then
    insert into public.clients (
      tenant_id, name, phone, email, birth_date, active,
      contact_allowed, contact_preference, last_professional_id
    ) values (
      target_tenant.id, trim(p_customer_name), trim(p_customer_phone), normalized_email,
      p_customer_birth_date, true, false, 'whatsapp', p_professional_id
    ) returning id into client_uuid;
  else
    update public.clients set
      name = trim(p_customer_name), phone = trim(p_customer_phone),
      email = coalesce(normalized_email, email), birth_date = coalesce(p_customer_birth_date, birth_date),
      last_professional_id = p_professional_id, active = true
    where id = client_uuid and tenant_id = target_tenant.id;
  end if;

  booking_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.appointments (
    tenant_id, client_id, service_id, professional_id, starts_at, ends_at,
    price_cents, status, notes, source, public_code, public_request_id
  ) values (
    target_tenant.id, client_uuid, p_service_ids[1], p_professional_id, p_starts_at,
    end_time, total_price, 'scheduled', nullif(trim(p_notes), ''), 'public',
    booking_code, p_request_id
  ) returning id into appointment_uuid;

  insert into public.appointment_services
    (appointment_id, tenant_id, service_id, position, duration_minutes, price_cents)
  select appointment_uuid, target_tenant.id, service.id, position.ordinality - 1,
    service.duration_minutes, service.price_cents
  from unnest(p_service_ids) with ordinality position(service_id, ordinality)
  join public.services service on service.id = position.service_id
    and service.tenant_id = target_tenant.id;

  notification_status := case when target_tenant.whatsapp_integration_mode = 'development'
    then 'development' else 'pending' end;
  insert into public.notification_outbox
    (tenant_id, appointment_id, channel, event_type, recipient, payload, provider, status)
  values
    (target_tenant.id, appointment_uuid, 'dashboard', 'booking_created', null,
      jsonb_build_object('code', booking_code, 'customerName', trim(p_customer_name),
        'startsAt', p_starts_at, 'endsAt', end_time, 'totalPriceCents', total_price),
      'dashboard', 'pending'),
    (target_tenant.id, appointment_uuid, 'whatsapp', 'booking_created',
      target_tenant.whatsapp_notification_phone,
      jsonb_build_object('code', booking_code, 'customerName', trim(p_customer_name),
        'customerPhone', trim(p_customer_phone), 'startsAt', p_starts_at,
        'endsAt', end_time, 'professional', selected_professional.name,
        'totalPriceCents', total_price,
        'services', (select jsonb_agg(service.name order by position.ordinality)
          from unnest(p_service_ids) with ordinality position(service_id, ordinality)
          join public.services service on service.id = position.service_id)),
      'meta_whatsapp_cloud_api', notification_status);

  return jsonb_build_object(
    'ok', true, 'code', booking_code, 'appointmentId', appointment_uuid,
    'services', (select jsonb_agg(service.name order by position.ordinality)
      from unnest(p_service_ids) with ordinality position(service_id, ordinality)
      join public.services service on service.id = position.service_id),
    'professional', selected_professional.name, 'startsAt', p_starts_at,
    'endsAt', end_time, 'company', target_tenant.name,
    'totalPriceCents', total_price, 'status', 'scheduled',
    'notificationStatus', notification_status
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Este agendamento já foi enviado.');
when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
end;
$$;

revoke all on function public.create_public_booking_v2(
  text, uuid[], uuid, timestamptz, text, text, text, date, text, uuid, text, text
) from public;
grant execute on function public.create_public_booking_v2(
  text, uuid[], uuid, timestamptz, text, text, text, date, text, uuid, text, text
) to anon, authenticated;

create or replace function private.refresh_client_appointment_summary()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.clients set
      appointment_count = appointment_count + 1,
      last_appointment_at = greatest(last_appointment_at, new.starts_at),
      last_professional_id = new.professional_id
    where id = new.client_id and tenant_id = new.tenant_id;
  elsif old.status = 'completed' and new.status is distinct from 'completed' then
    update public.clients set appointment_count = greatest(appointment_count - 1, 0)
    where id = new.client_id and tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger appointments_refresh_client_summary
after update of status on public.appointments
for each row execute function private.refresh_client_appointment_summary();

comment on table public.tenant_licenses is
  'Independent LuBeauty/LuBarber license per tenant. Access must require an active or trial license.';
comment on table public.notification_outbox is
  'Transactional notification outbox. Development mode records intended Meta WhatsApp messages without sending.';
comment on column public.tenants.meta_access_token_secret_name is
  'Name of the server environment secret. Never store the token itself in this table.';
