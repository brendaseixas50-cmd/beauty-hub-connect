create table if not exists public.payment_provider_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago')),
  entity_type text not null check (entity_type in ('appointment', 'store_order')),
  entity_id uuid not null,
  external_reference text not null unique,
  preference_id text,
  provider_payment_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back', 'in_process')),
  status_detail text,
  checkout_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id)
);

create index if not exists payment_provider_transactions_tenant_status_idx
  on public.payment_provider_transactions (tenant_id, status, created_at desc);

alter table public.payment_provider_transactions enable row level security;

create policy "Members can view payment transaction metadata"
on public.payment_provider_transactions for select to authenticated
using (tenant_id = private.current_tenant_id());

revoke all on public.payment_provider_transactions from anon, authenticated;
grant select (id, tenant_id, provider, entity_type, entity_id, external_reference,
  preference_id, provider_payment_id, amount_cents, status, status_detail,
  approved_at, created_at, updated_at)
on public.payment_provider_transactions to authenticated;

comment on table public.payment_provider_transactions is
  'Projecao interna de cobrancas. Tokens e payloads sensiveis do provedor nunca sao persistidos aqui.';

create or replace function public.apply_mercado_pago_payment(
  p_tenant_id uuid,
  p_external_reference text,
  p_provider_payment_id text,
  p_status text,
  p_status_detail text,
  p_amount_cents integer,
  p_approved_at timestamptz default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare transaction_row public.payment_provider_transactions%rowtype;
declare normalized_status text;
declare was_approved boolean;
begin
  select * into transaction_row
  from public.payment_provider_transactions
  where tenant_id = p_tenant_id and external_reference = p_external_reference
  for update;

  if transaction_row.id is null or transaction_row.amount_cents <> p_amount_cents then
    return false;
  end if;
  was_approved := transaction_row.status = 'approved';

  normalized_status := case
    when p_status = 'approved' then 'approved'
    when p_status in ('rejected', 'cancelled', 'refunded', 'charged_back', 'in_process') then p_status
    else 'pending'
  end;

  update public.payment_provider_transactions set
    provider_payment_id = p_provider_payment_id,
    status = normalized_status,
    status_detail = left(p_status_detail, 160),
    approved_at = case when normalized_status = 'approved' then coalesce(p_approved_at, now()) else approved_at end,
    updated_at = now()
  where id = transaction_row.id;

  if transaction_row.entity_type = 'appointment' then
    update public.appointment_payments set
      status = case
        when normalized_status = 'approved' then 'approved'
        when normalized_status in ('rejected', 'charged_back') then 'failed'
        when normalized_status in ('cancelled', 'refunded') then normalized_status
        else 'pending' end,
      approved_at = case when normalized_status = 'approved' then coalesce(p_approved_at, now()) else approved_at end,
      external_reference = p_provider_payment_id,
      updated_at = now()
    where tenant_id = p_tenant_id and appointment_id = transaction_row.entity_id
      and provider = 'mercado_pago';

    update public.financial_entries set
      status = case
        when normalized_status = 'approved' then 'paid'
        when normalized_status in ('refunded', 'charged_back', 'cancelled') then 'cancelled'
        else status end,
      paid_at = case when normalized_status = 'approved' then coalesce(p_approved_at, now()) else paid_at end,
      updated_at = now()
    where tenant_id = p_tenant_id and appointment_id = transaction_row.entity_id
      and payment_method = 'mercado_pago';
  else
    update public.store_orders set
      payment_status = case
        when normalized_status = 'approved' then 'paid'
        when normalized_status in ('rejected', 'charged_back') then 'failed'
        when normalized_status in ('cancelled', 'refunded') then normalized_status
        else 'pending' end,
      status = case when normalized_status = 'approved' then 'confirmed' else status end,
      updated_at = now()
    where tenant_id = p_tenant_id and id = transaction_row.entity_id;

    update public.financial_entries set
      status = case
        when normalized_status = 'approved' then 'paid'
        when normalized_status in ('refunded', 'charged_back', 'cancelled') then 'cancelled'
        else status end,
      paid_at = case when normalized_status = 'approved' then coalesce(p_approved_at, now()) else paid_at end,
      updated_at = now()
    where tenant_id = p_tenant_id
      and notes = 'Venda criada pela página pública.'
      and description = 'Pedido da loja ' || (
        select store.code from public.store_orders store
        where store.id = transaction_row.entity_id and store.tenant_id = p_tenant_id
      );
  end if;

  if normalized_status = 'approved' and not was_approved then
    insert into public.notification_outbox
      (tenant_id, channel, event_type, payload, provider, status)
    values (p_tenant_id, 'dashboard', 'payment_approved',
      jsonb_build_object('entityType', transaction_row.entity_type,
        'entityId', transaction_row.entity_id, 'amountCents', p_amount_cents),
      'dashboard', 'pending');
  end if;

  return true;
end;
$$;

revoke all on function public.apply_mercado_pago_payment(uuid,text,text,text,text,integer,timestamptz) from public;
grant execute on function public.apply_mercado_pago_payment(uuid,text,text,text,text,integer,timestamptz) to service_role;
