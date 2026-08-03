-- Add multi-company access without removing the legacy profile/tenant relationship.
-- Existing users keep their current company and permissions.

create table public.tenant_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'professional', 'receptionist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table public.user_active_tenants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  updated_at timestamptz not null default now(),
  foreign key (user_id, tenant_id)
    references public.tenant_memberships(user_id, tenant_id) on delete cascade
);

insert into public.tenant_memberships (user_id, tenant_id, role, created_at, updated_at)
select id, tenant_id, role, created_at, updated_at
from public.profiles
on conflict (user_id, tenant_id) do nothing;

insert into public.user_active_tenants (user_id, tenant_id)
select id, tenant_id
from public.profiles
on conflict (user_id) do nothing;

create trigger tenant_memberships_set_updated_at
before update on public.tenant_memberships
for each row execute function private.set_updated_at();

create trigger user_active_tenants_set_updated_at
before update on public.user_active_tenants
for each row execute function private.set_updated_at();

create index tenant_memberships_tenant_id_idx
  on public.tenant_memberships (tenant_id);
create index user_active_tenants_tenant_id_idx
  on public.user_active_tenants (tenant_id);

alter table public.tenant_memberships enable row level security;
alter table public.user_active_tenants enable row level security;

create policy "users read own memberships"
on public.tenant_memberships for select to authenticated
using (user_id = (select auth.uid()));

create policy "users read own active tenant"
on public.user_active_tenants for select to authenticated
using (user_id = (select auth.uid()));

create policy "members read linked tenants"
on public.tenants for select to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.tenant_id = tenants.id
  )
);

create policy "users read own identity profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

revoke all on public.tenant_memberships, public.user_active_tenants from anon;
revoke all on public.tenant_memberships, public.user_active_tenants from authenticated;
grant select on public.tenant_memberships, public.user_active_tenants to authenticated;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select active.tenant_id
  from public.user_active_tenants as active
  join public.tenant_memberships as membership
    on membership.user_id = active.user_id
   and membership.tenant_id = active.tenant_id
  where active.user_id = (select auth.uid())
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.tenant_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.tenant_id = private.current_tenant_id()
$$;

create function public.switch_active_tenant(target_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tenant_memberships
    where user_id = (select auth.uid())
      and tenant_id = target_tenant_id
  ) then
    raise exception 'Tenant access denied' using errcode = '42501';
  end if;

  insert into public.user_active_tenants (user_id, tenant_id)
  values ((select auth.uid()), target_tenant_id)
  on conflict (user_id) do update
    set tenant_id = excluded.tenant_id,
        updated_at = now();
end;
$$;

create function public.create_company_for_current_user(
  company_name text,
  selected_product text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  tenant_uuid uuid;
  tenant_slug text;
  profile_name text;
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(company_name)) not between 2 and 120 then
    raise exception 'Invalid company name' using errcode = '22023';
  end if;
  if selected_product not in ('beauty', 'barber') then
    raise exception 'Invalid product' using errcode = '22023';
  end if;

  select tenant.id into tenant_uuid
  from public.tenant_memberships as membership
  join public.tenants as tenant on tenant.id = membership.tenant_id
  where membership.user_id = current_user_id
    and tenant.owner_id = current_user_id
    and tenant.product_type = selected_product
  order by tenant.created_at
  limit 1;

  if tenant_uuid is not null then
    perform public.switch_active_tenant(tenant_uuid);
    return tenant_uuid;
  end if;

  select coalesce(
    nullif(trim(profile.full_name), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Proprietário'
  ), auth_user.email
  into profile_name, current_email
  from auth.users as auth_user
  left join public.profiles as profile on profile.id = auth_user.id
  where auth_user.id = current_user_id;

  tenant_slug := trim(both '-' from regexp_replace(lower(trim(company_name)), '[^a-z0-9]+', '-', 'g'));
  tenant_slug := coalesce(nullif(tenant_slug, ''), 'empresa') || '-' ||
    left(gen_random_uuid()::text, 8);

  insert into public.tenants (owner_id, slug, name, email, product_type)
  values (current_user_id, tenant_slug, trim(company_name), current_email, selected_product)
  returning id into tenant_uuid;

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (current_user_id, tenant_uuid, 'owner');

  insert into public.professionals (tenant_id, user_id, name, email, specialty)
  values (tenant_uuid, current_user_id, profile_name, current_email, 'Proprietário(a)');

  perform public.switch_active_tenant(tenant_uuid);
  return tenant_uuid;
end;
$$;

revoke all on function public.switch_active_tenant(uuid) from public, anon;
revoke all on function public.create_company_for_current_user(text, text) from public, anon;
grant execute on function public.switch_active_tenant(uuid) to authenticated;
grant execute on function public.create_company_for_current_user(text, text) to authenticated;

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

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (new.id, tenant_uuid, 'owner');

  insert into public.user_active_tenants (user_id, tenant_id)
  values (new.id, tenant_uuid);

  insert into public.professionals (tenant_id, user_id, name, email, specialty)
  values (tenant_uuid, new.id, profile_name, new.email, 'Proprietário(a)');

  return new;
end;
$$;

comment on table public.tenant_memberships is
  'Independent role and access for each user/company relationship.';
comment on table public.user_active_tenants is
  'Validated active company used by RLS and the authenticated application session.';
comment on function public.create_company_for_current_user(text, text) is
  'Adds another product/company to an already confirmed Supabase Auth account.';
