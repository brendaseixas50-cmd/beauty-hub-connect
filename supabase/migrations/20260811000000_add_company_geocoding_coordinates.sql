-- Persist Google Geocoding results per company so public pages never geocode on visit.

alter table public.tenants
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.tenants
  drop constraint if exists tenants_latitude_range,
  add constraint tenants_latitude_range
    check (latitude is null or latitude between -90 and 90),
  drop constraint if exists tenants_longitude_range,
  add constraint tenants_longitude_range
    check (longitude is null or longitude between -180 and 180),
  drop constraint if exists tenants_coordinates_pair,
  add constraint tenants_coordinates_pair
    check ((latitude is null) = (longitude is null));

comment on column public.tenants.latitude is
  'Server-side Google Geocoding latitude. Never populated from browser input.';
comment on column public.tenants.longitude is
  'Server-side Google Geocoding longitude. Never populated from browser input.';

create or replace function public.get_public_company_page_v3(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (select public.get_public_company_page_v2(p_slug) as payload),
  tenant_row as (
    select tenant.* from public.tenants tenant
    where tenant.slug = lower(trim(p_slug))
  ),
  settings as (
    select jsonb_build_object(
      'cancellationPolicyEnabled', tenant.cancellation_policy_enabled,
      'depositEnabled', tenant.deposit_enabled,
      'depositType', tenant.deposit_type,
      'depositValueCents', tenant.deposit_value_cents,
      'paymentMethods', tenant.payment_methods,
      'publicStoreEnabled', tenant.public_store_enabled,
      'showPublicLocation', tenant.show_public_location,
      'latitude', tenant.latitude,
      'longitude', tenant.longitude
    ) as payload from tenant_row tenant
  ),
  product_payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', product.id, 'name', product.name, 'category', product.category,
      'description', product.description, 'priceCents', product.sale_price_cents,
      'stockQuantity', product.stock_quantity, 'imageUrl', product.image_url
    ) order by product.category nulls last, product.name), '[]'::jsonb) as payload
    from public.products product join tenant_row tenant on tenant.id = product.tenant_id
    where product.active and product.public_visible and product.stock_quantity > 0
  )
  select case when base.payload is null then null else
    jsonb_set(
      jsonb_set(base.payload, '{company}', (base.payload -> 'company') || coalesce(settings.payload, '{}'::jsonb)),
      '{products}', product_payload.payload
    )
  end
  from base left join settings on true cross join product_payload
$$;

revoke all on function public.get_public_company_page_v3(text) from public;
grant execute on function public.get_public_company_page_v3(text) to anon, authenticated;
