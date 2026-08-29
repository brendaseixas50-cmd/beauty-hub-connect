-- Correção pontual: create_public_booking_v4 falhava em produção com
-- 23505 "duplicate key value violates unique constraint
-- appointments_public_code_key" ao gravar um combo multiprofissional.
--
-- Causa: public_code é único global na tabela appointments, e a função
-- gravava o MESMO código em todos os blocos do mesmo atendimento.
--
-- Correção: o bloco principal mantém o código amigável mostrado ao cliente
-- (e devolvido no retorno); os blocos seguintes recebem um código próprio.
-- O agrupamento do pedido continua sendo feito por booking_group_id.
--
-- Incremental e não destrutivo: apenas redefine a função.
-- Ordem: ... -> 20260834 -> 20260835 -> ESTE ARQUIVO.

begin;

create or replace function public.create_public_booking_v4(
  p_slug text, p_service_ids uuid[], p_professional_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_request_id uuid,
  p_fingerprint text, p_payment_method text, p_payment_option text,
  p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_tenant public.tenants%rowtype;
  block record;
  group_uuid uuid := gen_random_uuid();
  primary_appointment uuid;
  appointment_uuid uuid;
  client_uuid uuid;
  normalized_phone text;
  booking_code text;
  total_price integer := 0;
  total_duration integer;
  block_count integer;
  signal integer;
  amount_due integer;
  remaining integer;
  position_index integer := 0;
begin
  if coalesce(trim(p_honeypot), '') <> '' then
    return jsonb_build_object('ok', false, 'error', 'Não foi possível confirmar o agendamento.');
  end if;

  select tenant.* into target_tenant
  from public.tenants tenant
  join public.tenant_licenses license on license.tenant_id = tenant.id
    and license.product_type = tenant.product_type and license.status in ('trial','active')
  where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
    and tenant.public_page_status = 'published';
  if target_tenant.id is null then
    return jsonb_build_object('ok', false, 'error', 'Página indisponível.');
  end if;

  if p_payment_method not in ('pix','card','local','mercado_pago')
    or not coalesce((target_tenant.payment_methods ->> case p_payment_method
      when 'mercado_pago' then 'mercadoPago' else p_payment_method end)::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Forma de pagamento indisponível.');
  end if;

  select count(*), max(plan.offset_minutes + plan.duration_minutes), sum(plan.price_cents)
  into block_count, total_duration, total_price
  from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) plan;
  if coalesce(block_count, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Estes serviços não estão disponíveis agora.');
  end if;

  -- Um único bloco = fluxo antigo, preservado integralmente.
  if block_count = 1 then
    return public.create_public_booking_v3(
      p_slug, p_service_ids,
      (select plan.professional_id from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) plan limit 1),
      p_starts_at, p_customer_name, p_customer_phone, p_request_id, p_fingerprint,
      p_payment_method, p_payment_option, p_honeypot
    );
  end if;

  if p_starts_at <= now() or char_length(trim(p_customer_name)) not between 2 and 120 then
    return jsonb_build_object('ok', false, 'error', 'Revise os dados do agendamento.');
  end if;
  normalized_phone := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
  if char_length(normalized_phone) < 10 or char_length(normalized_phone) > 15 then
    return jsonb_build_object('ok', false, 'error', 'Informe um telefone válido.');
  end if;

  if (select count(*) from public.public_booking_attempts attempt
      where attempt.tenant_id = target_tenant.id
        and attempt.fingerprint_hash = encode(sha256(convert_to(p_fingerprint, 'utf8')), 'hex')
        and attempt.created_at > now() - interval '1 hour') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde e tente novamente.');
  end if;
  insert into public.public_booking_attempts (tenant_id, fingerprint_hash)
  values (target_tenant.id, encode(sha256(convert_to(p_fingerprint, 'utf8')), 'hex'));

  -- todos os blocos precisam caber na agenda dos respectivos profissionais
  if exists (
    select 1
    from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) plan
    join public.appointments appointment
      on appointment.tenant_id = target_tenant.id
     and appointment.professional_id = plan.professional_id
     and appointment.status in ('scheduled','confirmed')
     and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(
           p_starts_at + make_interval(mins => plan.offset_minutes),
           p_starts_at + make_interval(mins => plan.offset_minutes + plan.duration_minutes),
           '[)')
  ) then
    return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
  end if;

  select client.id into client_uuid from public.clients client
  where client.tenant_id = target_tenant.id and client.phone_normalized = normalized_phone
  order by client.created_at limit 1;
  if client_uuid is null then
    insert into public.clients (
      tenant_id, name, phone, active, contact_allowed, contact_preference, last_professional_id
    ) values (
      target_tenant.id, trim(p_customer_name), trim(p_customer_phone), true, false, 'whatsapp',
      p_professional_id
    ) returning id into client_uuid;
  else
    update public.clients set name = trim(p_customer_name), phone = trim(p_customer_phone), active = true
    where id = client_uuid and tenant_id = target_tenant.id;
  end if;

  booking_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  for block in
    select plan.* from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) plan
    order by plan.offset_minutes, plan.professional_id
  loop
    insert into public.appointments (
      tenant_id, client_id, service_id, professional_id, starts_at, ends_at,
      price_cents, status, source, public_code, public_request_id, booking_group_id
    ) values (
      target_tenant.id, client_uuid, block.service_id, block.professional_id,
      p_starts_at + make_interval(mins => block.offset_minutes),
      p_starts_at + make_interval(mins => block.offset_minutes + block.duration_minutes),
      block.price_cents, 'scheduled', 'public',
      case when primary_appointment is null then booking_code
           else upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) end,
      case when primary_appointment is null then p_request_id else gen_random_uuid() end,
      group_uuid
    ) returning id into appointment_uuid;

    insert into public.appointment_services
      (appointment_id, tenant_id, service_id, position, duration_minutes, price_cents)
    values (appointment_uuid, target_tenant.id, block.service_id, position_index,
      block.duration_minutes, block.price_cents);
    position_index := position_index + 1;

    if primary_appointment is null then primary_appointment := appointment_uuid; end if;
  end loop;

  signal := case
    when not target_tenant.deposit_enabled then 0
    when target_tenant.deposit_type = 'percent_30' then round(total_price * 0.30)
    when target_tenant.deposit_type = 'percent_50' then round(total_price * 0.50)
    when target_tenant.deposit_type = 'fixed' then least(target_tenant.deposit_value_cents, total_price)
    else 0 end;
  amount_due := case when p_payment_option = 'deposit' and signal > 0 then signal else total_price end;
  remaining := greatest(total_price - amount_due, 0);

  insert into public.appointment_payments (
    tenant_id, appointment_id, provider, payment_option, amount_cents,
    total_cents, remaining_cents, status
  ) values (
    target_tenant.id, primary_appointment,
    case p_payment_method when 'local' then 'manual' when 'mercado_pago' then 'mercado_pago' else p_payment_method end,
    case when p_payment_option = 'deposit' and signal > 0 then 'deposit' else 'full' end,
    amount_due, total_price, remaining, 'pending'
  );

  insert into public.financial_entries (
    tenant_id, appointment_id, entry_type, description, category, amount_cents,
    due_date, status, payment_method, notes
  ) values (
    target_tenant.id, primary_appointment, 'income', 'Agendamento online', 'Agendamentos',
    amount_due, (p_starts_at at time zone target_tenant.timezone)::date, 'pending', p_payment_method,
    'Atendimento com mais de um profissional (código ' || booking_code || ').'
  );

  insert into public.notification_outbox
    (tenant_id, appointment_id, channel, event_type, recipient, payload, provider, status)
  values (target_tenant.id, primary_appointment, 'dashboard', 'booking_created', null,
    jsonb_build_object('code', booking_code, 'customerName', trim(p_customer_name),
      'startsAt', p_starts_at, 'totalPriceCents', total_price, 'blocks', block_count),
    'dashboard', 'pending');

  return jsonb_build_object(
    'ok', true, 'code', booking_code, 'appointmentId', primary_appointment,
    'bookingGroupId', group_uuid, 'startsAt', p_starts_at,
    'endsAt', p_starts_at + make_interval(mins => total_duration),
    'company', target_tenant.name, 'status', 'scheduled',
    'totalPriceCents', total_price, 'depositCents', signal,
    'amountDueCents', amount_due, 'remainingCents', remaining,
    'paymentMethod', p_payment_method, 'paymentStatus', 'pending',
    'whatsapp', target_tenant.whatsapp,
    'services', (select jsonb_agg(service.name order by position.ordinality)
      from unnest(p_service_ids) with ordinality position(service_id, ordinality)
      join public.services service on service.id = position.service_id),
    'professional', (select string_agg(distinct professional.name, ' + ')
      from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) plan
      join public.professionals professional on professional.id = plan.professional_id)
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Este agendamento já foi enviado.');
when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
end;
$$;

revoke all on function public.create_public_booking_v4(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text
) from public;
grant execute on function public.create_public_booking_v4(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text
) to anon, authenticated, service_role;

commit;
