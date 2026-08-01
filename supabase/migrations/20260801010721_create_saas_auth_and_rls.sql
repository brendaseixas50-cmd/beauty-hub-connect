create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null check (char_length(trim(name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'professional', 'receptionist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.tenant_id
  from public.profiles as profile
  where profile.id = auth.uid()
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  client_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, tenant_id)
    references public.clients(id, tenant_id) on delete restrict,
  foreign key (service_id, tenant_id)
    references public.services(id, tenant_id) on delete restrict,
  foreign key (professional_id, tenant_id)
    references public.profiles(id, tenant_id) on delete restrict
);

create index profiles_tenant_id_idx on public.profiles (tenant_id);
create index clients_tenant_id_idx on public.clients (tenant_id);
create index services_tenant_id_idx on public.services (tenant_id);
create index appointments_tenant_starts_idx on public.appointments (tenant_id, starts_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
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
  tenant_slug := trim(both '-' from regexp_replace(lower(tenant_name), '[^a-z0-9]+', '-', 'g'));
  tenant_slug := coalesce(nullif(tenant_slug, ''), 'empresa') || '-' || left(new.id::text, 8);

  insert into public.tenants (owner_id, slug, name)
  values (new.id, tenant_slug, tenant_name)
  returning id into tenant_uuid;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (new.id, tenant_uuid, profile_name, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create policy "members read own tenant"
on public.tenants for select to authenticated
using (id = public.current_tenant_id());

create policy "owners update own tenant"
on public.tenants for update to authenticated
using (id = public.current_tenant_id() and owner_id = auth.uid())
with check (id = public.current_tenant_id() and owner_id = auth.uid());

create policy "members read profiles in own tenant"
on public.profiles for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "members manage own clients"
on public.clients for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "members manage own services"
on public.services for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "members manage own appointments"
on public.appointments for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

revoke all on public.tenants, public.profiles, public.clients, public.services,
  public.appointments from anon;
grant select, update on public.tenants to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.clients, public.services,
  public.appointments to authenticated;
grant execute on function public.current_tenant_id() to authenticated;

comment on function public.current_tenant_id() is
  'Returns the tenant linked to auth.uid(); used by every private RLS policy.';
comment on function public.handle_new_auth_user() is
  'Creates one isolated tenant and owner profile for every Supabase Auth signup.';
