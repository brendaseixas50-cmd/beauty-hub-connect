-- Reference schema for the future Supabase project. It is not applied automatically.
create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner', 'admin', 'professional', 'receptionist')),
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_tenant_id_idx on public.clients (tenant_id);
create index services_tenant_id_idx on public.services (tenant_id);
create index appointments_tenant_starts_idx on public.appointments (tenant_id, starts_at);

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create policy "members read own tenant" on public.tenants for select
using (id = public.current_tenant_id());
create policy "members read own profiles" on public.profiles for select
using (tenant_id = public.current_tenant_id());
create policy "members manage own clients" on public.clients for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());
create policy "members manage own services" on public.services for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());
create policy "members manage own appointments" on public.appointments for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());
