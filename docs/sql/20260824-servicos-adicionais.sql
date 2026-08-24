-- Etapa 3 (parte 3/3): SERVIÇOS ADICIONAIS ("Adicionar também").
--
-- Nada é apagado. Apenas:
--   * services.is_addon (novo, default false)
--   * public.service_addon_links (nova tabela: quais serviços/combos oferecem
--     cada adicional)
--   * get_public_company_page_v3 devolve isAddon + addonForServiceIds
--
-- Serviços normais e combos continuam funcionando exatamente como hoje.
-- Executar DEPOIS de:
--   1) docs/sql/20260822-servicos-foto-e-combos.sql
--   2) docs/sql/20260823-combos-agenda-preco-e-profissionais.sql

alter table public.services add column if not exists is_addon boolean not null default false;

create table if not exists public.service_addon_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- serviço principal OU combo que oferece o adicional
  parent_service_id uuid not null references public.services (id) on delete cascade,
  -- o serviço adicional em si (preço e duração próprios)
  addon_service_id uuid not null references public.services (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (parent_service_id, addon_service_id)
);

create index if not exists service_addon_links_parent_idx
  on public.service_addon_links (tenant_id, parent_service_id, position);
create index if not exists service_addon_links_addon_idx
  on public.service_addon_links (tenant_id, addon_service_id);

grant select, insert, update, delete on public.service_addon_links to authenticated;
grant all on public.service_addon_links to service_role;

alter table public.service_addon_links enable row level security;

drop policy if exists "members read own addon links" on public.service_addon_links;
create policy "members read own addon links"
on public.service_addon_links for select to authenticated
using (tenant_id = private.current_tenant_id());

drop policy if exists "managers insert own addon links" on public.service_addon_links;
create policy "managers insert own addon links"
on public.service_addon_links for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy if exists "managers update own addon links" on public.service_addon_links;
create policy "managers update own addon links"
on public.service_addon_links for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy if exists "managers delete own addon links" on public.service_addon_links;
create policy "managers delete own addon links"
on public.service_addon_links for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

-- Integridade: o adicional é um serviço simples (com preço e duração próprios),
-- nunca um combo, nunca ele mesmo, e sempre da mesma empresa.
create or replace function public.validate_service_addon_link()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent record;
  v_addon record;
begin
  if new.parent_service_id = new.addon_service_id then
    raise exception 'Um serviço não pode ser adicional de si mesmo.';
  end if;

  select tenant_id, is_combo into v_parent
  from public.services where id = new.parent_service_id;
  select tenant_id, is_combo, is_addon into v_addon
  from public.services where id = new.addon_service_id;

  if v_parent.tenant_id is distinct from new.tenant_id
     or v_addon.tenant_id is distinct from new.tenant_id then
    raise exception 'Serviços de empresas diferentes não podem ser vinculados como adicional.';
  end if;
  if coalesce(v_addon.is_combo, false) then
    raise exception 'Um combo não pode ser oferecido como adicional.';
  end if;
  if not coalesce(v_addon.is_addon, false) then
    raise exception 'Marque o serviço como adicional antes de vinculá-lo.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_service_addon_link on public.service_addon_links;
create trigger validate_service_addon_link
before insert or update on public.service_addon_links
for each row execute function public.validate_service_addon_link();

-- Página pública: cada serviço passa a informar se é adicional e para quais
-- serviços/combos ele aparece na seção "Adicionar também".
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
      'isAddon', service.is_addon,
      'requiresProfessional', service.requires_professional,
      'comboServices', coalesce((
        select jsonb_agg(child.name order by item.position, child.name)
        from public.service_combo_items item
        join public.services child on child.id = item.service_id
        where item.combo_service_id = service.id
      ), '[]'::jsonb),
      'addonForServiceIds', coalesce((
        select jsonb_agg(link.parent_service_id order by link.position)
        from public.service_addon_links link
        where link.addon_service_id = service.id
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
