-- Fix public contrast, normalize legacy cross-product colors and enable atomic public store orders.

update public.tenants
set primary_color = '#161616', secondary_color = '#c9a227', accent_color = '#1b4d63',
    button_color = '#161616', text_color = '#161616', updated_at = now()
where product_type = 'barber'
  and (lower(primary_color) in ('#000000','#8b5e67','#a66ef2','#ec78a8','#c9b8ff','#f9e7ef')
    or lower(secondary_color) in ('#7c3aed','#a66ef2','#ec78a8','#c9b8ff','#f5e7ea','#f9e7ef'));

update public.tenants
set primary_color = '#ec78a8', secondary_color = '#f9e7ef', accent_color = '#a66ef2',
    button_color = '#ec78a8', text_color = '#5e5e5e', updated_at = now()
where product_type = 'beauty'
  and lower(primary_color) in ('#161616','#2f2f2f','#1b4d63','#8b5e67');

alter table public.store_orders
  add column if not exists code text not null default
    ('LOJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  add column if not exists request_id uuid,
  add column if not exists fingerprint_hash text;

create unique index if not exists store_orders_request_id_idx
  on public.store_orders (tenant_id, request_id) where request_id is not null;

alter table public.notification_outbox drop constraint if exists notification_outbox_event_type_check;
alter table public.notification_outbox add constraint notification_outbox_event_type_check
  check (event_type in (
    'booking_created', 'booking_confirmed', 'booking_cancelled', 'marketing_message',
    'store_order_created'
  ));

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
      'publicStoreEnabled', tenant.public_store_enabled
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

create or replace function public.create_public_store_order(
  p_slug text, p_customer_name text, p_customer_phone text, p_items jsonb,
  p_payment_method text, p_request_id uuid, p_fingerprint text,
  p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare tenant_row public.tenants%rowtype;
declare order_row public.store_orders%rowtype;
declare product_row public.products%rowtype;
declare item record;
declare total integer := 0;
declare item_count integer := 0;
declare fingerprint_digest text;
begin
  if coalesce(trim(p_honeypot), '') <> '' then
    return jsonb_build_object('ok', false, 'error', 'Não foi possível concluir o pedido.');
  end if;
  if char_length(trim(p_customer_name)) not between 2 and 120
    or char_length(regexp_replace(p_customer_phone, '\D', '', 'g')) not between 10 and 15
    or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'error', 'Confira seu nome, WhatsApp e os produtos.');
  end if;

  select * into tenant_row from public.tenants
  where slug = lower(trim(p_slug)) and status = 'active'
    and public_page_status = 'published' and public_store_enabled;
  if tenant_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'Loja indisponível.');
  end if;
  if p_payment_method not in ('pix','card','local','mercado_pago')
    or not coalesce((tenant_row.payment_methods ->>
      case p_payment_method when 'mercado_pago' then 'mercadoPago' else p_payment_method end)::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Forma de pagamento indisponível.');
  end if;

  select * into order_row from public.store_orders
  where tenant_id = tenant_row.id and request_id = p_request_id;
  if order_row.id is not null then
    return jsonb_build_object('ok', true, 'orderId', order_row.id, 'code', order_row.code,
      'totalCents', order_row.total_cents, 'paymentMethod', order_row.payment_method,
      'paymentStatus', order_row.payment_status);
  end if;

  fingerprint_digest := encode(extensions.digest(coalesce(p_fingerprint, ''), 'sha256'), 'hex');
  if (select count(*) from public.store_orders existing
      where existing.tenant_id = tenant_row.id and existing.fingerprint_hash = fingerprint_digest
        and existing.created_at > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde alguns minutos.');
  end if;

  for item in
    select (entry.value ->> 'productId')::uuid as product_id,
      sum(greatest(least((entry.value ->> 'quantity')::integer, 50), 1))::integer as quantity
    from jsonb_array_elements(p_items) entry group by (entry.value ->> 'productId')::uuid
  loop
    select product.* into product_row from public.products product
    where product.id = item.product_id and product.tenant_id = tenant_row.id
      and product.active and product.public_visible
    for update;
    if product_row.id is null then
      return jsonb_build_object('ok', false, 'error', 'Um produto não está mais disponível.');
    end if;
    if product_row.stock_quantity < item.quantity then
      return jsonb_build_object('ok', false, 'error', 'Estoque insuficiente para ' || product_row.name || '.');
    end if;
    total := total + product_row.sale_price_cents * item.quantity;
    item_count := item_count + 1;
  end loop;
  if item_count = 0 or total <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Carrinho vazio.');
  end if;

  insert into public.store_orders (
    tenant_id, customer_name, customer_phone, total_cents, payment_method,
    payment_status, status, request_id, fingerprint_hash
  ) values (
    tenant_row.id, trim(p_customer_name), trim(p_customer_phone), total, p_payment_method,
    'pending', 'confirmed', p_request_id, fingerprint_digest
  ) returning * into order_row;

  for item in
    select (entry.value ->> 'productId')::uuid as product_id,
      sum(greatest(least((entry.value ->> 'quantity')::integer, 50), 1))::integer as quantity
    from jsonb_array_elements(p_items) entry group by (entry.value ->> 'productId')::uuid
  loop
    insert into public.store_order_items (order_id, tenant_id, product_id, quantity, unit_price_cents)
    select order_row.id, tenant_row.id, product.id, item.quantity, product.sale_price_cents
    from public.products product
    where product.id = item.product_id and product.tenant_id = tenant_row.id;
    update public.products set stock_quantity = stock_quantity - item.quantity
    where id = item.product_id and tenant_id = tenant_row.id;
  end loop;

  insert into public.financial_entries (
    tenant_id, entry_type, description, category, amount_cents, due_date,
    status, payment_method, notes
  ) values (
    tenant_row.id, 'income', 'Pedido da loja ' || order_row.code, 'Loja', total,
    current_date, 'pending', p_payment_method, 'Venda criada pela página pública.'
  );

  insert into public.notification_outbox
    (tenant_id, channel, event_type, payload, provider, status)
  values (tenant_row.id, 'dashboard', 'store_order_created',
    jsonb_build_object('orderId', order_row.id, 'code', order_row.code,
      'customerName', trim(p_customer_name), 'totalCents', total),
    'dashboard', 'pending');

  return jsonb_build_object('ok', true, 'orderId', order_row.id, 'code', order_row.code,
    'totalCents', total, 'paymentMethod', p_payment_method, 'paymentStatus', 'pending');
exception when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('ok', false, 'error', 'Carrinho inválido. Atualize a página e tente novamente.');
end;
$$;

revoke all on function public.create_public_store_order(
  text,text,text,jsonb,text,uuid,text,text
) from public;
grant execute on function public.create_public_store_order(
  text,text,text,jsonb,text,uuid,text,text
) to anon, authenticated;

comment on function public.create_public_store_order(text,text,text,jsonb,text,uuid,text,text) is
  'Atomic public storefront order with server-side price/stock validation and idempotency.';
