-- Manage access and plan together through administrator-only security-definer functions.
alter table public.platform_access_grants
  add column if not exists plan_code text not null default 'solo'
  check (plan_code in ('solo', 'team'));

grant all on public.platform_access_grants to service_role;
grant all on public.subscription_plans to service_role;
grant all on public.tenant_subscriptions to service_role;

create or replace function private.apply_access_plan_to_tenant(target_email text, target_product text, target_plan text)
returns void language plpgsql security definer set search_path = '' as $$
declare tenant_uuid uuid; plan_uuid uuid;
begin
  if target_plan not in ('solo', 'team') then raise exception 'Invalid plan' using errcode = '22023'; end if;
  select tenant.id into tenant_uuid from public.tenants tenant
  join auth.users auth_user on auth_user.id = tenant.owner_id
  where lower(auth_user.email) = lower(trim(target_email)) and tenant.product_type = target_product
  order by tenant.created_at limit 1;
  if tenant_uuid is null then return; end if;
  select id into plan_uuid from public.subscription_plans where code = target_plan and code in ('solo', 'team');
  if plan_uuid is null then raise exception 'Plan unavailable' using errcode = '22023'; end if;
  insert into public.tenant_subscriptions (tenant_id, plan_id, status, provider)
  values (tenant_uuid, plan_uuid, 'beta', 'manual')
  on conflict (tenant_id) do update set plan_id = excluded.plan_id, status = 'beta', provider = 'manual', updated_at = now();
end; $$;
revoke all on function private.apply_access_plan_to_tenant(text,text,text) from public, anon, authenticated;

create or replace function private.apply_access_plan_after_tenant_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_plan text; owner_email text;
begin
  select lower(email) into owner_email from auth.users where id = new.owner_id;
  select plan_code into selected_plan from public.platform_access_grants
  where email = owner_email and product_type = new.product_type and status = 'active' limit 1;
  if selected_plan in ('solo', 'team') then
    perform private.apply_access_plan_to_tenant(owner_email, new.product_type, selected_plan);
  end if;
  return new;
end; $$;
drop trigger if exists tenants_apply_access_plan on public.tenants;
create trigger tenants_apply_access_plan after insert on public.tenants
for each row execute function private.apply_access_plan_after_tenant_insert();

drop function if exists public.admin_list_platform_access(text);
create function public.admin_list_platform_access(search_email text default '')
returns table (id uuid, email text, product_type text, access_type text, status text,
  starts_at timestamptz, expires_at timestamptz, notes text, created_at timestamptz,
  updated_at timestamptz, user_id uuid, plan_code text, active_professionals bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_administrator() then raise exception 'Access denied' using errcode = '42501'; end if;
  return query select grant_row.id, grant_row.email, grant_row.product_type, grant_row.access_type,
    grant_row.status, grant_row.starts_at, grant_row.expires_at, grant_row.notes,
    grant_row.created_at, grant_row.updated_at, grant_row.user_id,
    case when grant_row.plan_code = 'team' then 'team' else 'solo' end,
    coalesce((select count(*) from public.professionals professional
      join public.tenants tenant on tenant.id = professional.tenant_id
      join auth.users owner_user on owner_user.id = tenant.owner_id
      where lower(owner_user.email) = grant_row.email
        and tenant.product_type = grant_row.product_type and professional.active), 0)
  from public.platform_access_grants grant_row
  where search_email = '' or grant_row.email ilike '%' || trim(search_email) || '%'
  order by grant_row.email, grant_row.product_type;
end; $$;

drop function if exists public.admin_upsert_platform_access(text,text,text,text,timestamptz,text);
create function public.admin_upsert_platform_access(target_email text, target_product text,
  target_access_type text, target_status text, target_plan text,
  target_expires_at timestamptz default null, target_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if not private.is_platform_administrator() then raise exception 'Access denied' using errcode = '42501'; end if;
  if target_product not in ('beauty','barber') or target_access_type not in ('administrator','courtesy','beta_tester')
    or target_status not in ('active','suspended','revoked','expired') or target_plan not in ('solo','team') then
    raise exception 'Invalid access data' using errcode = '22023'; end if;
  insert into public.platform_access_grants (email,user_id,product_type,access_type,status,plan_code,expires_at,notes)
  select lower(trim(target_email)), auth_user.id, target_product, target_access_type, target_status,
    target_plan, target_expires_at, nullif(trim(target_notes), '') from (select 1) source
  left join auth.users auth_user on lower(auth_user.email) = lower(trim(target_email))
  on conflict (email,product_type) do update set user_id = coalesce(excluded.user_id,platform_access_grants.user_id),
    access_type=excluded.access_type,status=excluded.status,plan_code=excluded.plan_code,
    expires_at=excluded.expires_at,notes=excluded.notes,updated_at=now()
  returning platform_access_grants.id into grant_id;
  perform private.apply_access_plan_to_tenant(target_email,target_product,target_plan);
  return grant_id;
end; $$;

revoke all on function public.admin_list_platform_access(text) from public, anon, authenticated;
revoke all on function public.admin_upsert_platform_access(text,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.admin_list_platform_access(text) to authenticated;
grant execute on function public.admin_upsert_platform_access(text,text,text,text,text,timestamptz,text) to authenticated;
