-- Rodada final: COMBOS E ADICIONAIS MULTIPROFISSIONAIS.
--
-- Problema corrigido: hoje um combo bloqueia a agenda inteira de UM único
-- profissional, mesmo quando parte dos serviços é executada por outra pessoa.
--
-- O que passa a existir (nada é apagado):
--   * service_combo_items.assigned_professional_id  -> quem faz aquele item
--   * service_combo_items.execution_mode            -> 'sequential' | 'parallel'
--   * service_addon_links.assigned_professional_id / execution_mode (mesma ideia)
--   * appointments.booking_group_id                 -> agrupa os blocos de um
--     mesmo atendimento do cliente (1 pedido = 1 grupo = N blocos)
--   * public.booking_blocks_plan(...)               -> plano de execução
--   * public.get_public_booking_availability_v3(...)-> horários por bloco
--   * public.create_public_booking_v4(...)          -> cria os blocos
--
-- Compatibilidade: serviço simples, e combo com um só profissional, continuam
-- gerando exatamente UM bloco — o comportamento atual, sem mudança visível.
--
-- Receita: cada bloco carrega o preço dos SEUS itens, então a soma dos blocos
-- é igual ao total do pedido (relatórios não inflam) e a comissão de cada
-- profissional sai correta, pelo próprio bloco.

-- ---------------------------------------------------------------------------
-- 1) Colunas novas
-- ---------------------------------------------------------------------------
alter table public.service_combo_items
  add column if not exists assigned_professional_id uuid references public.professionals (id) on delete set null,
  add column if not exists execution_mode text not null default 'sequential';

alter table public.service_addon_links
  add column if not exists assigned_professional_id uuid references public.professionals (id) on delete set null,
  add column if not exists execution_mode text not null default 'sequential';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_combo_items_execution_mode_check') then
    alter table public.service_combo_items
      add constraint service_combo_items_execution_mode_check
      check (execution_mode in ('sequential', 'parallel'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_addon_links_execution_mode_check') then
    alter table public.service_addon_links
      add constraint service_addon_links_execution_mode_check
      check (execution_mode in ('sequential', 'parallel'));
  end if;
end;
$$;

alter table public.appointments
  add column if not exists booking_group_id uuid;

create index if not exists appointments_booking_group_idx
  on public.appointments (tenant_id, booking_group_id);

-- O profissional atribuído a um item precisa ser da mesma empresa do combo.
create or replace function public.validate_combo_item_professional()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_professional_id is not null and not exists (
    select 1 from public.professionals professional
    where professional.id = new.assigned_professional_id
      and professional.tenant_id = new.tenant_id
  ) then
    raise exception 'O profissional escolhido não pertence a esta empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_combo_item_professional on public.service_combo_items;
create trigger validate_combo_item_professional
before insert or update on public.service_combo_items
for each row execute function public.validate_combo_item_professional();

drop trigger if exists validate_addon_link_professional on public.service_addon_links;
create trigger validate_addon_link_professional
before insert or update on public.service_addon_links
for each row execute function public.validate_combo_item_professional();

-- ---------------------------------------------------------------------------
-- 2) Plano de execução: um registro por item, já com profissional e horário
--    relativo (offset em minutos a partir do início do atendimento).
-- ---------------------------------------------------------------------------
create or replace function public.booking_blocks_plan(
  p_tenant_id uuid, p_service_ids uuid[], p_professional_id uuid
) returns table (
  professional_id uuid, service_id uuid, root_service_id uuid,
  offset_minutes integer, duration_minutes integer, price_cents integer
) language plpgsql stable security definer set search_path = '' as $$
declare
  root record;
  item record;
  cursor_minutes integer := 0;
  previous_offset integer := 0;
  item_offset integer;
  resolved_professional uuid;
  combo_base integer;
  combo_total integer;
  applied integer;
  item_price integer;
  first_item boolean;
begin
  for root in
    select service.id, service.is_combo, service.duration_minutes, service.price_cents,
      service.requires_professional, position.ordinality
    from unnest(p_service_ids) with ordinality position(service_id, ordinality)
    join public.services service
      on service.id = position.service_id and service.tenant_id = p_tenant_id and service.active
    order by position.ordinality
  loop
    if not root.is_combo then
      resolved_professional := public.resolve_item_professional(
        p_tenant_id, root.id, null, p_professional_id
      );
      if resolved_professional is null then return; end if;
      return query select resolved_professional, root.id, root.id, cursor_minutes,
        root.duration_minutes, root.price_cents;
      previous_offset := cursor_minutes;
      cursor_minutes := cursor_minutes + root.duration_minutes;
    else
      -- preço do combo é o preço oficial: rateado entre os itens
      select coalesce(sum(child.price_cents), 0) into combo_base
      from public.service_combo_items combo_item
      join public.services child on child.id = combo_item.service_id
      where combo_item.combo_service_id = root.id and combo_item.tenant_id = p_tenant_id;
      combo_total := root.price_cents;
      applied := 0;
      first_item := true;

      for item in
        select combo_item.service_id, combo_item.execution_mode,
          combo_item.assigned_professional_id, child.duration_minutes, child.price_cents,
          row_number() over (order by combo_item.position, combo_item.created_at) as seq,
          count(*) over () as total_items
        from public.service_combo_items combo_item
        join public.services child on child.id = combo_item.service_id
        where combo_item.combo_service_id = root.id and combo_item.tenant_id = p_tenant_id
        order by combo_item.position, combo_item.created_at
      loop
        resolved_professional := public.resolve_item_professional(
          p_tenant_id, item.service_id, item.assigned_professional_id, p_professional_id
        );
        if resolved_professional is null then return; end if;

        if item.execution_mode = 'parallel' and not first_item then
          item_offset := previous_offset;
        else
          item_offset := cursor_minutes;
        end if;

        if combo_base > 0 then
          item_price := round(combo_total::numeric * item.price_cents / combo_base)::integer;
        else
          item_price := round(combo_total::numeric / greatest(item.total_items, 1))::integer;
        end if;
        if item.seq = item.total_items then
          item_price := combo_total - applied;
        end if;
        applied := applied + item_price;

        return query select resolved_professional, item.service_id, root.id, item_offset,
          item.duration_minutes, greatest(item_price, 0);

        previous_offset := item_offset;
        cursor_minutes := greatest(cursor_minutes, item_offset + item.duration_minutes);
        first_item := false;
      end loop;
    end if;
  end loop;
end;
$$;

-- Quem executa um item: preferência explícita > profissional escolhido pelo
-- cliente (quando ele realmente faz o serviço) > qualquer ativo habilitado.
create or replace function public.resolve_item_professional(
  p_tenant_id uuid, p_service_id uuid, p_assigned uuid, p_chosen uuid
) returns uuid language sql stable security definer set search_path = '' as $$
  with apto as (
    select professional.id
    from public.professionals professional
    where professional.tenant_id = p_tenant_id and professional.active
      and (
        not exists (
          select 1 from public.professional_services link
          where link.tenant_id = p_tenant_id and link.service_id = p_service_id
        )
        or exists (
          select 1 from public.professional_services link
          where link.tenant_id = p_tenant_id and link.service_id = p_service_id
            and link.professional_id = professional.id
        )
      )
  )
  select coalesce(
    (select id from apto where id = p_assigned),
    (select id from apto where id = p_chosen),
    (select id from apto order by id limit 1)
  );
$$;

revoke all on function public.booking_blocks_plan(uuid, uuid[], uuid) from public;
revoke all on function public.resolve_item_professional(uuid, uuid, uuid, uuid) from public;
grant execute on function public.booking_blocks_plan(uuid, uuid[], uuid) to anon, authenticated, service_role;
grant execute on function public.resolve_item_professional(uuid, uuid, uuid, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Disponibilidade por bloco: um horário só aparece quando TODOS os
--    profissionais envolvidos estão livres nos seus próprios blocos.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_booking_availability_v3(
  p_slug text, p_date date, p_service_ids uuid[], p_professional_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_tenant public.tenants%rowtype;
  weekday_key text;
  opening_hours text;
  opens_at time;
  closes_at time;
  step integer;
  total_duration integer;
  slot_local timestamp;
  slot_start timestamptz;
  slots jsonb := '[]'::jsonb;
  horizon_days integer;
  lead_minutes integer;
begin
  select tenant.* into target_tenant
  from public.tenants tenant
  join public.tenant_licenses license on license.tenant_id = tenant.id
    and license.product_type = tenant.product_type and license.status in ('trial','active')
  where tenant.slug = lower(trim(p_slug)) and tenant.status = 'active'
    and tenant.public_page_status = 'published';
  if target_tenant.id is null then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;

  if not exists (select 1 from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id)) then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;

  select max(block.offset_minutes + block.duration_minutes) into total_duration
  from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) block;
  if coalesce(total_duration, 0) <= 0 then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;

  horizon_days := coalesce((target_tenant.booking_rules ->> 'horizonDays')::integer, 180);
  lead_minutes := coalesce((target_tenant.booking_rules ->> 'minLeadMinutes')::integer, 0);
  if p_date < (now() at time zone target_tenant.timezone)::date
     or p_date > ((now() at time zone target_tenant.timezone)::date + horizon_days) then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;

  weekday_key := case extract(dow from p_date)::integer
    when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
    when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday'
    else 'saturday' end;
  opening_hours := target_tenant.business_hours ->> weekday_key;
  if coalesce(opening_hours, 'closed') = 'closed'
     or opening_hours !~ '^([0-2][0-9]):[0-5][0-9]-([0-2][0-9]):[0-5][0-9]$' then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;
  opens_at := split_part(opening_hours, '-', 1)::time;
  closes_at := split_part(opening_hours, '-', 2)::time;
  step := greatest(coalesce(target_tenant.booking_interval_minutes, 30), 5);

  slot_local := p_date + opens_at;
  while (slot_local + make_interval(mins => total_duration))::time <= closes_at
        and (slot_local + make_interval(mins => total_duration))::date = p_date loop
    slot_start := slot_local at time zone target_tenant.timezone;
    if slot_start >= now() + make_interval(mins => lead_minutes)
       and not exists (
         select 1
         from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) block
         join public.appointments appointment
           on appointment.tenant_id = target_tenant.id
          and appointment.professional_id = block.professional_id
          and appointment.status in ('scheduled','confirmed')
          and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(
                slot_start + make_interval(mins => block.offset_minutes),
                slot_start + make_interval(mins => block.offset_minutes + block.duration_minutes),
                '[)')
       ) then
      slots := slots || jsonb_build_array(jsonb_build_object(
        'startsAt', slot_start,
        'endsAt', slot_start + make_interval(mins => total_duration),
        'label', to_char(slot_local, 'HH24:MI')
      ));
    end if;
    slot_local := slot_local + make_interval(mins => step);
  end loop;

  return jsonb_build_object('date', p_date, 'slots', slots);
end;
$$;

revoke all on function public.get_public_booking_availability_v3(text, date, uuid[], uuid) from public;
grant execute on function public.get_public_booking_availability_v3(text, date, uuid[], uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Criação do agendamento em blocos (1 pedido = 1 grupo = N blocos)
-- ---------------------------------------------------------------------------
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
        and attempt.fingerprint_hash = encode(digest(p_fingerprint, 'sha256'), 'hex')
        and attempt.created_at > now() - interval '1 hour') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde e tente novamente.');
  end if;
  insert into public.public_booking_attempts (tenant_id, fingerprint_hash)
  values (target_tenant.id, encode(digest(p_fingerprint, 'sha256'), 'hex'));

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
      block.price_cents, 'scheduled', 'public', booking_code,
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
