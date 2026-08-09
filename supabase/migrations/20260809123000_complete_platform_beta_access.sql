-- Complete public booking settings, commerce foundations, provider-agnostic plans and closed beta.
-- No payment provider secret is stored in the database or exposed to the browser.

alter table public.tenants
  add column if not exists cancellation_policy_enabled boolean not null default false,
  add column if not exists deposit_enabled boolean not null default false,
  add column if not exists deposit_type text not null default 'none'
    check (deposit_type in ('none', 'percent_30', 'percent_50', 'fixed')),
  add column if not exists deposit_value_cents integer not null default 0
    check (deposit_value_cents >= 0),
  add column if not exists payment_methods jsonb not null default
    '{"pix":false,"card":false,"local":true,"mercadoPago":false}'::jsonb,
  add column if not exists public_store_enabled boolean not null default false;

create table public.platform_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  user_id uuid references auth.users(id) on delete set null,
  product_type text not null check (product_type in ('beauty', 'barber')),
  access_type text not null check (access_type in ('administrator', 'courtesy', 'beta_tester')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, product_type),
  unique (user_id, product_type)
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('solo', 'team', 'business')),
  name text not null,
  professional_limit integer not null check (professional_limit > 0),
  active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, professional_limit, features) values
  ('solo', 'Solo', 1, '{"products":["beauty","barber"]}'::jsonb),
  ('team', 'Equipe', 8, '{"products":["beauty","barber"]}'::jsonb),
  ('business', 'Empresa', 50, '{"products":["beauty","barber"]}'::jsonb)
on conflict (code) do update set name = excluded.name, professional_limit = excluded.professional_limit;

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'beta' check (status in ('beta', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  provider text not null default 'manual' check (provider in ('manual', 'hotmart', 'kiwify', 'mercado_pago', 'other')),
  external_customer_id text,
  external_subscription_id text,
  starts_at timestamptz not null default now(),
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tenant_subscriptions (tenant_id, plan_id, status)
select tenant.id, plan.id, 'beta'
from public.tenants tenant cross join public.subscription_plans plan
where plan.code = 'business'
on conflict (tenant_id) do nothing;

create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  client_name text not null,
  phone text not null,
  desired_date date,
  service_ids uuid[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  total_cents integer not null check (total_cents >= 0),
  payment_method text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  status text not null default 'created' check (status in ('created', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.store_order_items (
  order_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  primary key (order_id, product_id),
  foreign key (order_id, tenant_id) references public.store_orders(id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete restrict
);

create table public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null,
  provider text not null default 'manual' check (provider in ('manual', 'pix', 'card', 'mercado_pago')),
  payment_option text not null check (payment_option in ('deposit', 'full')),
  amount_cents integer not null check (amount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  remaining_cents integer not null check (remaining_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'failed', 'cancelled', 'refunded')),
  external_reference text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (appointment_id, tenant_id) references public.appointments(id, tenant_id) on delete cascade
);

create index platform_access_active_lookup_idx on public.platform_access_grants
  (email, product_type, status, expires_at);
create index platform_access_user_idx on public.platform_access_grants (user_id, product_type, status);
create index tenant_subscriptions_status_idx on public.tenant_subscriptions (tenant_id, status);
create index service_packages_tenant_idx on public.service_packages (tenant_id, active);
create index coupons_tenant_idx on public.coupons (tenant_id, active, expires_at);
create index waitlist_tenant_idx on public.waitlist_entries (tenant_id, status, desired_date);
create index product_categories_tenant_idx on public.product_categories (tenant_id, active, sort_order);
create index store_orders_tenant_idx on public.store_orders (tenant_id, status, created_at desc);
create index appointment_payments_tenant_idx on public.appointment_payments (tenant_id, appointment_id, status);

create trigger platform_access_grants_set_updated_at before update on public.platform_access_grants
for each row execute function private.set_updated_at();
create trigger subscription_plans_set_updated_at before update on public.subscription_plans
for each row execute function private.set_updated_at();
create trigger tenant_subscriptions_set_updated_at before update on public.tenant_subscriptions
for each row execute function private.set_updated_at();
create trigger service_packages_set_updated_at before update on public.service_packages
for each row execute function private.set_updated_at();
create trigger coupons_set_updated_at before update on public.coupons
for each row execute function private.set_updated_at();
create trigger waitlist_entries_set_updated_at before update on public.waitlist_entries
for each row execute function private.set_updated_at();
create trigger product_categories_set_updated_at before update on public.product_categories
for each row execute function private.set_updated_at();
create trigger store_orders_set_updated_at before update on public.store_orders
for each row execute function private.set_updated_at();
create trigger appointment_payments_set_updated_at before update on public.appointment_payments
for each row execute function private.set_updated_at();

alter table public.platform_access_grants enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.service_packages enable row level security;
alter table public.coupons enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.product_categories enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.appointment_payments enable row level security;

create or replace function private.is_platform_administrator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_access_grants grant_row
    join auth.users auth_user on auth_user.id = (select auth.uid())
    where grant_row.email = lower(auth_user.email)
      and grant_row.access_type = 'administrator'
      and grant_row.status = 'active'
      and grant_row.starts_at <= now()
      and (grant_row.expires_at is null or grant_row.expires_at > now())
  )
$$;

create or replace function private.has_product_access(target_product text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_access_grants grant_row
    join auth.users auth_user on auth_user.id = (select auth.uid())
    where (grant_row.user_id = auth_user.id or grant_row.email = lower(auth_user.email))
      and grant_row.product_type = target_product
      and grant_row.status = 'active'
      and grant_row.starts_at <= now()
      and (grant_row.expires_at is null or grant_row.expires_at > now())
  )
$$;

create policy "users read own beta access" on public.platform_access_grants for select to authenticated
using (
  user_id = (select auth.uid())
  or email = lower((select email from auth.users where id = (select auth.uid())))
  or (select private.is_platform_administrator())
);
create policy "platform admins manage beta access" on public.platform_access_grants for all to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()));
create policy "authenticated read plans" on public.subscription_plans for select to authenticated using (true);
create policy "members read own subscription" on public.tenant_subscriptions for select to authenticated
using (tenant_id = private.current_tenant_id());

create policy "members manage own packages" on public.service_packages for all to authenticated
using (tenant_id = private.current_tenant_id()) with check (tenant_id = private.current_tenant_id());
create policy "members manage own coupons" on public.coupons for all to authenticated
using (tenant_id = private.current_tenant_id()) with check (tenant_id = private.current_tenant_id());
create policy "members manage own waitlist" on public.waitlist_entries for all to authenticated
using (tenant_id = private.current_tenant_id()) with check (tenant_id = private.current_tenant_id());
create policy "members manage own categories" on public.product_categories for all to authenticated
using (tenant_id = private.current_tenant_id()) with check (tenant_id = private.current_tenant_id());
create policy "members read own orders" on public.store_orders for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "members read own order items" on public.store_order_items for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "members read own appointment payments" on public.appointment_payments for select to authenticated
using (tenant_id = private.current_tenant_id());

revoke all on public.platform_access_grants, public.subscription_plans, public.tenant_subscriptions,
  public.service_packages, public.coupons, public.waitlist_entries, public.product_categories,
  public.store_orders, public.store_order_items, public.appointment_payments from anon, authenticated;
grant select, insert, update, delete on public.platform_access_grants to authenticated;
grant select on public.subscription_plans, public.tenant_subscriptions, public.store_orders,
  public.store_order_items, public.appointment_payments to authenticated;
grant select, insert, update, delete on public.service_packages, public.coupons,
  public.waitlist_entries, public.product_categories to authenticated;

insert into public.platform_access_grants (email, product_type, access_type, status, notes) values
  ('brendaseixas50@gmail.com', 'beauty', 'administrator', 'active', 'Administrador inicial do beta fechado'),
  ('brendaseixas50@gmail.com', 'barber', 'administrator', 'active', 'Administrador inicial do beta fechado')
on conflict (email, product_type) do update set
  access_type = 'administrator', status = 'active', expires_at = null, updated_at = now();

create or replace function public.get_my_platform_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'isAdministrator', coalesce(bool_or(grant_row.access_type = 'administrator'), false),
    'grants', coalesce(jsonb_agg(jsonb_build_object(
      'productType', grant_row.product_type, 'accessType', grant_row.access_type,
      'status', grant_row.status, 'startsAt', grant_row.starts_at, 'expiresAt', grant_row.expires_at
    ) order by grant_row.product_type) filter (where grant_row.id is not null), '[]'::jsonb)
  )
  from auth.users auth_user
  left join public.platform_access_grants grant_row
    on (grant_row.user_id = auth_user.id or grant_row.email = lower(auth_user.email))
  where auth_user.id = (select auth.uid())
$$;

revoke all on function public.get_my_platform_access() from public, anon;
grant execute on function public.get_my_platform_access() to authenticated;

create or replace function private.current_tenant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select active.tenant_id
  from public.user_active_tenants active
  join public.tenant_memberships membership
    on membership.user_id = active.user_id and membership.tenant_id = active.tenant_id
  join public.tenants tenant on tenant.id = active.tenant_id
  where active.user_id = (select auth.uid())
    and private.has_product_access(tenant.product_type)
$$;

create or replace function private.enforce_professional_plan_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed_limit integer;
declare current_count integer;
begin
  if not new.active then return new; end if;
  select plan.professional_limit into allowed_limit
  from public.tenant_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.tenant_id = new.tenant_id
    and subscription.status in ('beta','trial','active');
  if allowed_limit is null then allowed_limit := 1; end if;
  select count(*) into current_count from public.professionals professional
  where professional.tenant_id = new.tenant_id and professional.active
    and (tg_op = 'INSERT' or professional.id <> new.id);
  if current_count >= allowed_limit then
    raise exception 'Limite de profissionais atingido. Faça upgrade do plano.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger professionals_enforce_plan_limit
before insert or update of active on public.professionals
for each row execute function private.enforce_professional_plan_limit();

create or replace function public.get_public_company_page_v3(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (select public.get_public_company_page_v2(p_slug) as payload),
  settings as (
    select jsonb_build_object(
      'cancellationPolicyEnabled', tenant.cancellation_policy_enabled,
      'depositEnabled', tenant.deposit_enabled,
      'depositType', tenant.deposit_type,
      'depositValueCents', tenant.deposit_value_cents,
      'paymentMethods', tenant.payment_methods,
      'publicStoreEnabled', tenant.public_store_enabled
    ) as payload
    from public.tenants tenant
    where tenant.slug = lower(trim(p_slug))
  )
  select case when base.payload is null then null else
    jsonb_set(base.payload, '{company}', (base.payload -> 'company') || coalesce(settings.payload, '{}'::jsonb))
  end
  from base left join settings on true
$$;

revoke all on function public.get_public_company_page_v3(text) from public;
grant execute on function public.get_public_company_page_v3(text) to anon, authenticated;

create or replace function public.create_public_booking_v3(
  p_slug text, p_service_ids uuid[], p_professional_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_request_id uuid,
  p_fingerprint text, p_payment_method text, p_payment_option text,
  p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
declare tenant_row public.tenants%rowtype;
declare appointment_uuid uuid;
declare total integer;
declare signal integer;
declare amount_due integer;
declare remaining integer;
begin
  select * into tenant_row from public.tenants where slug = lower(trim(p_slug));
  if tenant_row.id is null then return jsonb_build_object('ok', false, 'error', 'Página indisponível.'); end if;
  if p_payment_method not in ('pix','card','local','mercado_pago')
    or not coalesce((tenant_row.payment_methods ->> case p_payment_method when 'mercado_pago' then 'mercadoPago' else p_payment_method end)::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Forma de pagamento indisponível.');
  end if;

  result := public.create_public_booking_v2(
    p_slug, p_service_ids, p_professional_id, p_starts_at,
    p_customer_name, p_customer_phone, '', null, '', p_request_id, p_fingerprint, p_honeypot
  );
  if not coalesce((result ->> 'ok')::boolean, false) then return result; end if;

  appointment_uuid := (result ->> 'appointmentId')::uuid;
  total := (result ->> 'totalPriceCents')::integer;
  signal := case
    when not tenant_row.deposit_enabled then 0
    when tenant_row.deposit_type = 'percent_30' then round(total * 0.30)
    when tenant_row.deposit_type = 'percent_50' then round(total * 0.50)
    when tenant_row.deposit_type = 'fixed' then least(tenant_row.deposit_value_cents, total)
    else 0 end;
  amount_due := case when p_payment_option = 'deposit' and signal > 0 then signal else total end;
  remaining := greatest(total - amount_due, 0);

  insert into public.appointment_payments (
    tenant_id, appointment_id, provider, payment_option, amount_cents,
    total_cents, remaining_cents, status
  ) values (
    tenant_row.id, appointment_uuid,
    case p_payment_method when 'local' then 'manual' when 'mercado_pago' then 'mercado_pago' else p_payment_method end,
    case when p_payment_option = 'deposit' and signal > 0 then 'deposit' else 'full' end,
    amount_due, total, remaining, 'pending'
  );

  insert into public.financial_entries (
    tenant_id, appointment_id, entry_type, description, category, amount_cents,
    due_date, status, payment_method, notes
  ) values (
    tenant_row.id, appointment_uuid, 'income', 'Agendamento online', 'Agendamentos',
    amount_due, (p_starts_at at time zone tenant_row.timezone)::date, 'pending', p_payment_method,
    case when remaining > 0 then 'Sinal pendente; saldo restante: ' || remaining::text || ' centavos.' else 'Pagamento pendente.' end
  );

  return result || jsonb_build_object(
    'paymentMethod', p_payment_method, 'paymentStatus', 'pending',
    'depositCents', signal, 'amountDueCents', amount_due, 'remainingCents', remaining,
    'whatsapp', tenant_row.whatsapp
  );
exception when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
end;
$$;

revoke all on function public.create_public_booking_v3(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text
) from public;
grant execute on function public.create_public_booking_v3(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text
) to anon, authenticated;

create or replace function public.admin_list_platform_access(search_email text default '')
returns setof public.platform_access_grants language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_administrator() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  return query select grant_row.* from public.platform_access_grants grant_row
    where search_email = '' or grant_row.email ilike '%' || trim(search_email) || '%'
    order by grant_row.email, grant_row.product_type;
end;
$$;

create or replace function public.admin_upsert_platform_access(
  target_email text, target_product text, target_access_type text,
  target_status text, target_expires_at timestamptz default null, target_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if not private.is_platform_administrator() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if target_product not in ('beauty','barber') or target_access_type not in ('administrator','courtesy','beta_tester')
    or target_status not in ('active','suspended','revoked','expired') then
    raise exception 'Invalid access data' using errcode = '22023';
  end if;
  insert into public.platform_access_grants (email, user_id, product_type, access_type, status, expires_at, notes)
  select lower(trim(target_email)), auth_user.id, target_product, target_access_type, target_status,
    target_expires_at, nullif(trim(target_notes), '')
  from (select 1) source left join auth.users auth_user on lower(auth_user.email) = lower(trim(target_email))
  on conflict (email, product_type) do update set
    user_id = coalesce(excluded.user_id, platform_access_grants.user_id),
    access_type = excluded.access_type, status = excluded.status,
    expires_at = excluded.expires_at, notes = excluded.notes, updated_at = now()
  returning id into grant_id;
  return grant_id;
end;
$$;

create or replace function public.admin_remove_platform_access(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_administrator() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  delete from public.platform_access_grants where id = target_id;
end;
$$;

revoke all on function public.admin_list_platform_access(text),
  public.admin_upsert_platform_access(text,text,text,text,timestamptz,text),
  public.admin_remove_platform_access(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_platform_access(text),
  public.admin_upsert_platform_access(text,text,text,text,timestamptz,text),
  public.admin_remove_platform_access(uuid) to authenticated;

comment on table public.platform_access_grants is
  'Temporary provider-agnostic closed-beta authorization. Independent grant per product.';
comment on table public.tenant_subscriptions is
  'Provider-agnostic subscription projection for Hotmart, Kiwify, Mercado Pago or future Master Panel.';
