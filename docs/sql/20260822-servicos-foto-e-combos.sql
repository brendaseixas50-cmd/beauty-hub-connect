-- Serviços: foto opcional + combos (composição de serviços).
-- Executar no banco de produção. Nada é apagado: apenas colunas e tabela novas.

alter table public.services add column if not exists image_url text;
alter table public.services add column if not exists is_combo boolean not null default false;

create table if not exists public.service_combo_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  combo_service_id uuid not null references public.services (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (combo_service_id, service_id)
);

create index if not exists service_combo_items_combo_idx
  on public.service_combo_items (tenant_id, combo_service_id, position);

grant select, insert, update, delete on public.service_combo_items to authenticated;
grant all on public.service_combo_items to service_role;

alter table public.service_combo_items enable row level security;

drop policy if exists "members read own combo items" on public.service_combo_items;
create policy "members read own combo items"
on public.service_combo_items for select to authenticated
using (tenant_id = private.current_tenant_id());

drop policy if exists "managers insert own combo items" on public.service_combo_items;
create policy "managers insert own combo items"
on public.service_combo_items for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy if exists "managers update own combo items" on public.service_combo_items;
create policy "managers update own combo items"
on public.service_combo_items for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy if exists "managers delete own combo items" on public.service_combo_items;
create policy "managers delete own combo items"
on public.service_combo_items for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

-- Página pública passa a devolver a foto e a composição de cada serviço.
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
      'showPublicLocation', tenant.show_public_location
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
  ),
  service_payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', service.id, 'name', service.name, 'category', service.category,
      'description', service.description, 'durationMinutes', service.duration_minutes,
      'priceCents', service.price_cents, 'imageUrl', service.image_url,
      'isCombo', service.is_combo,
      'comboServices', coalesce((
        select jsonb_agg(child.name order by item.position, child.name)
        from public.service_combo_items item
        join public.services child on child.id = item.service_id
        where item.combo_service_id = service.id
      ), '[]'::jsonb)
    ) order by service.category nulls last, service.name), '[]'::jsonb) as payload
    from public.services service join tenant_row tenant on tenant.id = service.tenant_id
    where service.active
  )
  select case when base.payload is null then null else
    jsonb_set(
      jsonb_set(
        jsonb_set(base.payload, '{company}', (base.payload -> 'company') || coalesce(settings.payload, '{}'::jsonb)),
        '{products}', product_payload.payload
      ),
      '{services}', service_payload.payload
    )
  end
  from base left join settings on true cross join product_payload cross join service_payload
$$;

revoke all on function public.get_public_company_page_v3(text) from public;
grant execute on function public.get_public_company_page_v3(text) to anon, authenticated;
