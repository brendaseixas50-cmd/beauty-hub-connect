create extension if not exists btree_gist;

alter table public.tenants
  add column if not exists product_type text not null default 'beauty'
    check (product_type in ('beauty', 'barber')),
  add column if not exists document text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists description text,
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists state text check (state is null or char_length(state) = 2),
  add column if not exists postal_code text,
  add column if not exists timezone text not null default 'America/Fortaleza',
  add column if not exists business_hours jsonb not null default
    '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-18:00","friday":"09:00-18:00","saturday":"09:00-14:00","sunday":"closed"}'::jsonb;

alter table public.clients
  add column if not exists email text,
  add column if not exists birth_date date,
  add column if not exists address text,
  add column if not exists active boolean not null default true;

alter table public.services
  add column if not exists category text,
  add column if not exists description text;

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  specialty text,
  email text,
  phone text,
  commission_percent numeric(5,2) not null default 0
    check (commission_percent between 0 and 100),
  color text not null default '#8b5e67',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, user_id)
);

insert into public.professionals (id, tenant_id, user_id, name, specialty)
select profile.id, profile.tenant_id, profile.id, profile.full_name, 'Proprietário(a)'
from public.profiles as profile
on conflict (id) do nothing;

alter table public.appointments
  drop constraint if exists appointments_professional_id_tenant_id_fkey;

alter table public.appointments
  add column if not exists ends_at timestamptz,
  add column if not exists price_cents integer not null default 0
    check (price_cents >= 0),
  add column if not exists notes text;

update public.appointments as appointment
set
  ends_at = coalesce(
    appointment.ends_at,
    appointment.starts_at + make_interval(mins => service.duration_minutes)
  ),
  price_cents = case
    when appointment.price_cents = 0 then service.price_cents
    else appointment.price_cents
  end
from public.services as service
where service.id = appointment.service_id
  and service.tenant_id = appointment.tenant_id;

update public.appointments
set ends_at = starts_at + interval '1 hour'
where ends_at is null;

alter table public.appointments
  alter column ends_at set not null,
  add constraint appointments_valid_period check (ends_at > starts_at),
  add constraint appointments_id_tenant_key unique (id, tenant_id),
  add constraint appointments_professional_tenant_fk
    foreign key (professional_id, tenant_id)
    references public.professionals(id, tenant_id) on delete restrict;

alter table public.appointments
  add constraint appointments_no_professional_overlap
  exclude using gist (
    tenant_id with =,
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('scheduled', 'confirmed'));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  sku text,
  category text,
  description text,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  sale_price_cents integer not null default 0 check (sale_price_cents >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  unit text not null default 'un',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, sku)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  product_id uuid not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('initial', 'purchase', 'sale', 'use', 'loss', 'adjustment')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (product_id, tenant_id)
    references public.products(id, tenant_id) on delete restrict
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  appointment_id uuid,
  entry_type text not null check (entry_type in ('income', 'expense')),
  description text not null check (char_length(trim(description)) between 2 and 160),
  category text,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null default current_date,
  paid_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (appointment_id, tenant_id)
    references public.appointments(id, tenant_id) on delete set null (appointment_id)
);

create function private.apply_inventory_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.products
  set stock_quantity = stock_quantity + new.quantity_delta
  where id = new.product_id
    and tenant_id = new.tenant_id
    and stock_quantity + new.quantity_delta >= 0;

  if not found then
    raise exception 'Movimentação inválida ou estoque insuficiente.';
  end if;

  return new;
end;
$$;

create trigger inventory_movements_apply_stock
before insert on public.inventory_movements
for each row execute function private.apply_inventory_movement();

create trigger professionals_set_updated_at
before update on public.professionals
for each row execute function private.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger financial_entries_set_updated_at
before update on public.financial_entries
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_uuid uuid;
  tenant_name text;
  profile_name text;
  tenant_slug text;
  selected_product text;
begin
  tenant_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Minha empresa'
  );
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Proprietário'
  );
  selected_product := case
    when new.raw_user_meta_data ->> 'product_type' = 'barber' then 'barber'
    else 'beauty'
  end;
  tenant_slug := trim(both '-' from regexp_replace(lower(tenant_name), '[^a-z0-9]+', '-', 'g'));
  tenant_slug := coalesce(nullif(tenant_slug, ''), 'empresa') || '-' || left(new.id::text, 8);

  insert into public.tenants (owner_id, slug, name, email, product_type)
  values (new.id, tenant_slug, tenant_name, new.email, selected_product)
  returning id into tenant_uuid;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (new.id, tenant_uuid, profile_name, 'owner');

  insert into public.professionals (id, tenant_id, user_id, name, email, specialty)
  values (new.id, tenant_uuid, new.id, profile_name, new.email, 'Proprietário(a)');

  return new;
end;
$$;

alter table public.professionals enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.financial_entries enable row level security;

create policy "members manage own professionals"
on public.professionals for all to authenticated
using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());

create policy "members manage own products"
on public.products for all to authenticated
using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());

create policy "members read own inventory"
on public.inventory_movements for select to authenticated
using (tenant_id = private.current_tenant_id());

create policy "members create own inventory"
on public.inventory_movements for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and created_by = (select auth.uid())
);

create policy "members manage own finances"
on public.financial_entries for all to authenticated
using (tenant_id = private.current_tenant_id())
with check (tenant_id = private.current_tenant_id());

revoke all on public.professionals, public.products, public.inventory_movements,
  public.financial_entries from anon;
grant select, insert, update, delete on public.professionals, public.products,
  public.financial_entries to authenticated;
grant select, insert on public.inventory_movements to authenticated;

revoke all on function private.apply_inventory_movement() from public, anon, authenticated;

create index professionals_tenant_active_idx
  on public.professionals (tenant_id, active, name);
create index clients_tenant_active_name_idx
  on public.clients (tenant_id, active, name);
create index services_tenant_active_name_idx
  on public.services (tenant_id, active, name);
create index products_tenant_active_name_idx
  on public.products (tenant_id, active, name);
create index products_tenant_stock_idx
  on public.products (tenant_id, stock_quantity, minimum_stock)
  where active;
create index inventory_movements_tenant_created_idx
  on public.inventory_movements (tenant_id, created_at desc);
create index financial_entries_tenant_due_idx
  on public.financial_entries (tenant_id, due_date desc);
create index financial_entries_tenant_status_idx
  on public.financial_entries (tenant_id, status, entry_type);
create index appointments_tenant_status_starts_idx
  on public.appointments (tenant_id, status, starts_at);

comment on table public.professionals is
  'Operational team records. A professional may optionally be linked to an Auth user.';
comment on table public.inventory_movements is
  'Immutable stock ledger; inserts update the current product stock through a trigger.';
comment on function private.apply_inventory_movement() is
  'Applies one tenant-scoped stock movement and blocks negative inventory.';
