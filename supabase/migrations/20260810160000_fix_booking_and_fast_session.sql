-- Fix the public booking hash lookup and collapse authenticated session bootstrap into one query.

alter function public.create_public_booking_v2(
  text, uuid[], uuid, timestamptz, text, text, text, date, text, uuid, text, text
) set search_path = pg_catalog, extensions;

update public.platform_access_grants grant_row
set user_id = auth_user.id, updated_at = now()
from auth.users auth_user
where lower(auth_user.email) = grant_row.email
  and grant_row.user_id is distinct from auth_user.id;

create or replace function public.get_my_session_bootstrap()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profileName', profile.full_name,
    'activeTenantId', active.tenant_id,
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenantId', tenant.id,
        'tenantName', tenant.name,
        'tenantSlug', tenant.slug,
        'logoUrl', tenant.logo_url,
        'productType', tenant.product_type,
        'onboardingCompleted', tenant.onboarding_completed_at is not null,
        'licenseStatus', license.status,
        'role', membership.role
      ) order by membership.created_at)
      from public.tenant_memberships membership
      join public.tenants tenant on tenant.id = membership.tenant_id and tenant.status = 'active'
      join public.tenant_licenses license on license.tenant_id = tenant.id
        and license.product_type = tenant.product_type and license.status in ('trial', 'active')
      where membership.user_id = auth_user.id
    ), '[]'::jsonb),
    'platformAccess', public.get_my_platform_access()
  )
  from auth.users auth_user
  join public.profiles profile on profile.id = auth_user.id
  left join public.user_active_tenants active on active.user_id = auth_user.id
  where auth_user.id = (select auth.uid())
$$;

revoke all on function public.get_my_session_bootstrap() from public, anon;
grant execute on function public.get_my_session_bootstrap() to authenticated;

comment on function public.get_my_session_bootstrap() is
  'Returns the authenticated multi-company session in one database round trip.';
