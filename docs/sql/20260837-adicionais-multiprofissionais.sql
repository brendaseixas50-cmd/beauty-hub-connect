-- Rodada: PROFISSIONAIS POR SERVIÇO PRINCIPAL + ADICIONAIS MULTIPROFISSIONAIS.
--
-- Problema real corrigido:
--   * a etapa "Escolha o profissional" mistura profissionais do serviço
--     principal com profissionais dos adicionais (a manicure aparecia como
--     opção de um Corte);
--   * quando principal e adicional são executados por pessoas diferentes, a
--     resolução caía em "qualquer apto" sem olhar agenda e, em alguns casos,
--     zerava os horários.
--
-- Nada é apagado. Continuam existindo booking_blocks_plan,
-- get_public_booking_availability_v3 e create_public_booking_v4.
--
-- O que passa a existir:
--   * service_addon_links.professional_mode   -> 'any' | 'preferred' | 'client_choice'
--   * service_addon_links.preferred_fallback  -> 'any' | 'none'
--   * public.professional_is_free(...)        -> jornada + intervalo + bloqueio + agenda
--   * public.service_eligible_professionals(...)
--   * public.booking_blocks_plan_v2(...)      -> papel do serviço no pedido
--   * public.get_public_booking_availability_v4(...)
--   * public.create_public_booking_v5(...)
--   * get_public_company_page_v3 devolve a configuração de executor do adicional
--
-- Ordem: ... -> 20260833 -> 20260834 -> 20260835 -> 20260836 -> ESTE ARQUIVO.

begin;

-- ---------------------------------------------------------------------------
-- 1) Configuração de quem executa cada adicional
-- ---------------------------------------------------------------------------
alter table public.service_addon_links
  add column if not exists professional_mode text not null default 'any',
  add column if not exists preferred_fallback text not null default 'any';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_addon_links_professional_mode_check') then
    alter table public.service_addon_links
      add constraint service_addon_links_professional_mode_check
      check (professional_mode in ('any', 'preferred', 'client_choice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_addon_links_preferred_fallback_check') then
    alter table public.service_addon_links
      add constraint service_addon_links_preferred_fallback_check
      check (preferred_fallback in ('any', 'none'));
  end if;
end;
$$;

comment on column public.service_addon_links.professional_mode is
  'Como o executor do adicional é escolhido: any (o sistema escolhe um apto e livre), preferred (usa assigned_professional_id primeiro) ou client_choice (o cliente escolhe entre os aptos).';
comment on column public.service_addon_links.preferred_fallback is
  'Quando professional_mode = preferred e o preferencial está indisponível: any (usa outro apto) ou none (não oferece o horário).';

-- ---------------------------------------------------------------------------
-- 2) Profissional realmente livre: jornada, intervalo, bloqueio e agenda
-- ---------------------------------------------------------------------------
create or replace function public.professional_is_free(
  p_tenant_id uuid, p_professional_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  zone text;
  day jsonb;
  local_start timestamp;
  local_end timestamp;
  weekday_key text;
begin
  if p_professional_id is null then return false; end if;

  select tenant.timezone into zone from public.tenants tenant where tenant.id = p_tenant_id;
  if zone is null then return false; end if;

  -- Bloqueios e folgas pontuais do profissional.
  if exists (
    select 1 from public.professional_unavailability block
    where block.tenant_id = p_tenant_id
      and block.professional_id = p_professional_id
      and tstzrange(block.starts_at, block.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    return false;
  end if;

  -- Agenda: qualquer atendimento ativo que encoste no intervalo.
  if exists (
    select 1 from public.appointments appointment
    where appointment.tenant_id = p_tenant_id
      and appointment.professional_id = p_professional_id
      and appointment.status in ('scheduled', 'confirmed')
      and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    return false;
  end if;

  -- Jornada individual: mapa vazio significa "segue o horário da empresa".
  local_start := p_starts_at at time zone zone;
  local_end := p_ends_at at time zone zone;
  weekday_key := extract(dow from local_start)::integer::text;

  select professional.working_hours -> weekday_key into day
  from public.professionals professional
  where professional.id = p_professional_id and professional.tenant_id = p_tenant_id
    and professional.active;
  if not found then return false; end if;

  if day is null then
    -- Sem jornada própria para o dia: se o profissional tem jornada cadastrada
    -- em algum dia, o dia ausente é folga; se não tem nenhuma, segue a empresa.
    return not exists (
      select 1 from public.professionals professional
      where professional.id = p_professional_id
        and coalesce(jsonb_typeof(professional.working_hours), 'null') = 'object'
        and professional.working_hours <> '{}'::jsonb
    );
  end if;

  if coalesce((day ->> 'dayOff')::boolean, false) then return false; end if;
  if local_start::time < coalesce((day ->> 'startsAt')::time, time '00:00')
     or local_end::time > coalesce((day ->> 'endsAt')::time, time '23:59')
     or local_end::date <> local_start::date then
    return false;
  end if;
  if (day ->> 'breakStartsAt') is not null and (day ->> 'breakEndsAt') is not null
     and local_start::time < (day ->> 'breakEndsAt')::time
     and local_end::time > (day ->> 'breakStartsAt')::time then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.professional_is_free(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.professional_is_free(uuid, uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Quem pode executar um serviço (vínculo serviço/profissional)
-- ---------------------------------------------------------------------------
create or replace function public.service_eligible_professionals(
  p_tenant_id uuid, p_service_id uuid
) returns table (professional_id uuid)
language sql stable security definer set search_path = '' as $$
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
  order by professional.name, professional.id
$$;

revoke all on function public.service_eligible_professionals(uuid, uuid) from public;
grant execute on function public.service_eligible_professionals(uuid, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Plano de execução considerando o PAPEL do serviço no pedido
-- ---------------------------------------------------------------------------
create or replace function public.booking_blocks_plan_v2(
  p_tenant_id uuid,
  p_service_ids uuid[],
  p_professional_id uuid,
  p_addon_professionals jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null
) returns table (
  professional_id uuid, service_id uuid, root_service_id uuid,
  offset_minutes integer, duration_minutes integer, price_cents integer
) language plpgsql stable security definer set search_path = '' as $$
declare
  main_ids uuid[];
  addon_ids uuid[];
  main_row record;
  addon record;
  cursor_minutes integer := 0;
  chosen uuid;
  candidate uuid;
  parent_offset integer;
  addon_offset integer;
  addon_start timestamptz;
  addon_end timestamptz;
begin
  select coalesce(array_agg(entry.service_id order by entry.ordinality), '{}')
    into main_ids
  from unnest(p_service_ids) with ordinality entry(service_id, ordinality)
  join public.services service
    on service.id = entry.service_id and service.tenant_id = p_tenant_id and service.active
  where not service.is_addon;

  select coalesce(array_agg(entry.service_id order by entry.ordinality), '{}')
    into addon_ids
  from unnest(p_service_ids) with ordinality entry(service_id, ordinality)
  join public.services service
    on service.id = entry.service_id and service.tenant_id = p_tenant_id and service.active
  where service.is_addon;

  if coalesce(array_length(main_ids, 1), 0) = 0 then return; end if;

  -- Serviço principal manda: o profissional escolhido precisa executar TODOS os
  -- serviços principais simples. Sem apto, não existe fallback incompatível.
  for main_row in
    select service.id, service.is_combo
    from unnest(main_ids) as entry(service_id)
    join public.services service on service.id = entry.service_id
  loop
    if not main_row.is_combo then
      if p_professional_id is not null then
        if not exists (
          select 1 from public.service_eligible_professionals(p_tenant_id, main_row.id) apto
          where apto.professional_id = p_professional_id
        ) then
          return;
        end if;
      elsif not exists (select 1 from public.service_eligible_professionals(p_tenant_id, main_row.id)) then
        return;
      end if;
    end if;
  end loop;

  -- Blocos dos principais/combos: exatamente a lógica já validada em produção.
  for main_row in
    select plan.* from public.booking_blocks_plan(p_tenant_id, main_ids, p_professional_id) plan
    order by plan.offset_minutes, plan.professional_id
  loop
    return query select main_row.professional_id, main_row.service_id, main_row.root_service_id,
      main_row.offset_minutes, main_row.duration_minutes, main_row.price_cents;
    cursor_minutes := greatest(cursor_minutes, main_row.offset_minutes + main_row.duration_minutes);
  end loop;
  if cursor_minutes <= 0 then return; end if;

  -- Adicionais: bloco próprio, executor resolvido separadamente.
  for addon in
    select service.id, service.duration_minutes, service.price_cents,
      link.parent_service_id, link.execution_mode, link.assigned_professional_id,
      link.professional_mode, link.preferred_fallback
    from unnest(addon_ids) with ordinality entry(service_id, ordinality)
    join public.services service on service.id = entry.service_id
    join lateral (
      select inner_link.*
      from public.service_addon_links inner_link
      where inner_link.tenant_id = p_tenant_id
        and inner_link.addon_service_id = service.id
        and inner_link.parent_service_id = any (main_ids)
      order by inner_link.position, inner_link.created_at
      limit 1
    ) link on true
    order by entry.ordinality
  loop
    chosen := null;

    if addon.professional_mode = 'client_choice' then
      candidate := nullif(p_addon_professionals ->> addon.id::text, '')::uuid;
      if candidate is not null and exists (
        select 1 from public.service_eligible_professionals(p_tenant_id, addon.id) apto
        where apto.professional_id = candidate
      ) then
        chosen := candidate;
      end if;
    elsif addon.professional_mode = 'preferred' then
      candidate := addon.assigned_professional_id;
      if candidate is not null and exists (
        select 1 from public.service_eligible_professionals(p_tenant_id, addon.id) apto
        where apto.professional_id = candidate
      ) then
        chosen := candidate;
      end if;
    end if;

    -- Offset do bloco: simultâneo começa junto do serviço pai, sequencial entra
    -- depois de tudo o que já foi alocado.
    select min(plan.offset_minutes) into parent_offset
    from public.booking_blocks_plan(p_tenant_id, main_ids, p_professional_id) plan
    where plan.root_service_id = addon.parent_service_id;
    if addon.execution_mode = 'parallel' and parent_offset is not null then
      addon_offset := parent_offset;
    else
      addon_offset := cursor_minutes;
    end if;

    if p_starts_at is not null then
      addon_start := p_starts_at + make_interval(mins => addon_offset);
      addon_end := addon_start + make_interval(mins => addon.duration_minutes);

      -- Preferencial indisponível com fallback 'none': o horário não é oferecido.
      if addon.professional_mode = 'preferred' and chosen is not null
         and not public.professional_is_free(p_tenant_id, chosen, addon_start, addon_end) then
        if addon.preferred_fallback = 'none' then return; end if;
        chosen := null;
      end if;
      if addon.professional_mode = 'client_choice' and chosen is not null
         and not public.professional_is_free(p_tenant_id, chosen, addon_start, addon_end) then
        return;
      end if;

      if chosen is null then
        select apto.professional_id into chosen
        from public.service_eligible_professionals(p_tenant_id, addon.id) apto
        where public.professional_is_free(p_tenant_id, apto.professional_id, addon_start, addon_end)
        limit 1;
      end if;

      -- Quando o executor também é o principal, simultâneo viraria conflito com
      -- ele mesmo: nesse caso o adicional entra em sequência.
      if chosen is not null and addon_offset <> cursor_minutes and exists (
        select 1 from public.booking_blocks_plan(p_tenant_id, main_ids, p_professional_id) plan
        where plan.professional_id = chosen
          and int4range(plan.offset_minutes, plan.offset_minutes + plan.duration_minutes, '[)')
              && int4range(addon_offset, addon_offset + addon.duration_minutes, '[)')
      ) then
        addon_offset := cursor_minutes;
        addon_start := p_starts_at + make_interval(mins => addon_offset);
        addon_end := addon_start + make_interval(mins => addon.duration_minutes);
        if not public.professional_is_free(p_tenant_id, chosen, addon_start, addon_end) then
          select apto.professional_id into chosen
          from public.service_eligible_professionals(p_tenant_id, addon.id) apto
          where public.professional_is_free(p_tenant_id, apto.professional_id, addon_start, addon_end)
          limit 1;
        end if;
      end if;
    else
      if chosen is null then
        select apto.professional_id into chosen
        from public.service_eligible_professionals(p_tenant_id, addon.id) apto
        limit 1;
      end if;
      if chosen is not null and addon_offset <> cursor_minutes and exists (
        select 1 from public.booking_blocks_plan(p_tenant_id, main_ids, p_professional_id) plan
        where plan.professional_id = chosen
          and int4range(plan.offset_minutes, plan.offset_minutes + plan.duration_minutes, '[)')
              && int4range(addon_offset, addon_offset + addon.duration_minutes, '[)')
      ) then
        addon_offset := cursor_minutes;
      end if;
    end if;

    -- Sem executor possível o atendimento completo não cabe: plano vazio.
    if chosen is null then return; end if;

    return query select chosen, addon.id, addon.parent_service_id, addon_offset,
      addon.duration_minutes, addon.price_cents;

    cursor_minutes := greatest(cursor_minutes, addon_offset + addon.duration_minutes);
  end loop;
end;
$$;

revoke all on function public.booking_blocks_plan_v2(uuid, uuid[], uuid, jsonb, timestamptz) from public;
grant execute on function public.booking_blocks_plan_v2(uuid, uuid[], uuid, jsonb, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Disponibilidade v4: um horário só aparece quando TODOS os blocos cabem
--    na agenda real de cada profissional envolvido.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_booking_availability_v4(
  p_slug text, p_date date, p_service_ids uuid[], p_professional_id uuid default null,
  p_addon_professionals jsonb default '{}'::jsonb
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_tenant public.tenants%rowtype;
  weekday_key text;
  opening_hours text;
  opens_at time;
  closes_at time;
  step integer;
  base_duration integer;
  slot_duration integer;
  slot_local timestamp;
  slot_start timestamptz;
  slots jsonb := '[]'::jsonb;
  horizon_days integer;
  slot_professionals jsonb;
  blocks_ok boolean;
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

  select max(block.offset_minutes + block.duration_minutes) into base_duration
  from public.booking_blocks_plan_v2(
    target_tenant.id, p_service_ids, p_professional_id, coalesce(p_addon_professionals, '{}'::jsonb), null
  ) block;
  if coalesce(base_duration, 0) <= 0 then
    return jsonb_build_object('date', p_date, 'slots', '[]'::jsonb);
  end if;

  horizon_days := greatest(coalesce(target_tenant.booking_horizon_days, 60), 1);
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
  while (slot_local + make_interval(mins => base_duration))::time <= closes_at
        and (slot_local + make_interval(mins => base_duration))::date = p_date loop
    slot_start := slot_local at time zone target_tenant.timezone;
    if slot_start >= now() then
      -- O plano é recalculado por horário: o executor automático de um adicional
      -- pode mudar conforme a agenda de cada profissional.
      select max(block.offset_minutes + block.duration_minutes),
             coalesce(jsonb_agg(distinct jsonb_build_object('id', professional.id, 'name', professional.name)), '[]'::jsonb),
             bool_and(public.professional_is_free(
               target_tenant.id, block.professional_id,
               slot_start + make_interval(mins => block.offset_minutes),
               slot_start + make_interval(mins => block.offset_minutes + block.duration_minutes)
             ))
        into slot_duration, slot_professionals, blocks_ok
      from public.booking_blocks_plan_v2(
        target_tenant.id, p_service_ids, p_professional_id,
        coalesce(p_addon_professionals, '{}'::jsonb), slot_start
      ) block
      join public.professionals professional on professional.id = block.professional_id;

      if coalesce(slot_duration, 0) > 0 and coalesce(blocks_ok, false)
         and (slot_local + make_interval(mins => slot_duration))::time <= closes_at then
        slots := slots || jsonb_build_array(jsonb_build_object(
          'startsAt', slot_start,
          'endsAt', slot_start + make_interval(mins => slot_duration),
          'label', to_char(slot_local, 'HH24:MI'),
          'professionals', slot_professionals
        ));
      end if;
    end if;
    slot_local := slot_local + make_interval(mins => step);
  end loop;

  return jsonb_build_object('date', p_date, 'slots', slots);
end;
$$;

revoke all on function public.get_public_booking_availability_v4(text, date, uuid[], uuid, jsonb) from public;
grant execute on function public.get_public_booking_availability_v4(text, date, uuid[], uuid, jsonb)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Criação da reserva v5: 1 pedido = 1 grupo = N blocos (principal + adicionais)
-- ---------------------------------------------------------------------------
create or replace function public.create_public_booking_v5(
  p_slug text, p_service_ids uuid[], p_professional_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_request_id uuid,
  p_fingerprint text, p_payment_method text, p_payment_option text,
  p_honeypot text default '', p_addon_professionals jsonb default '{}'::jsonb
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
  addons jsonb := coalesce(p_addon_professionals, '{}'::jsonb);
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
  from public.booking_blocks_plan_v2(target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan;
  if coalesce(block_count, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Estes serviços não estão disponíveis neste horário.');
  end if;

  -- Um único bloco = fluxo antigo, preservado integralmente.
  if block_count = 1 then
    return public.create_public_booking_v3(
      p_slug, p_service_ids,
      (select plan.professional_id from public.booking_blocks_plan_v2(
         target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan limit 1),
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

  -- Cada bloco precisa caber na agenda real do seu profissional (jornada,
  -- intervalo, bloqueio e outros atendimentos).
  if exists (
    select 1
    from public.booking_blocks_plan_v2(target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan
    where not public.professional_is_free(
      target_tenant.id, plan.professional_id,
      p_starts_at + make_interval(mins => plan.offset_minutes),
      p_starts_at + make_interval(mins => plan.offset_minutes + plan.duration_minutes)
    )
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
    select plan.* from public.booking_blocks_plan_v2(
      target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan
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
      from public.booking_blocks_plan_v2(target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan
      join public.professionals professional on professional.id = plan.professional_id),
    'assignments', (select coalesce(jsonb_agg(jsonb_build_object(
        'service', service.name, 'professional', professional.name
      ) order by plan.offset_minutes), '[]'::jsonb)
      from public.booking_blocks_plan_v2(target_tenant.id, p_service_ids, p_professional_id, addons, p_starts_at) plan
      join public.services service on service.id = plan.service_id
      join public.professionals professional on professional.id = plan.professional_id)
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Este agendamento já foi enviado.');
when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'Este horário acabou de ficar indisponível.');
end;
$$;

revoke all on function public.create_public_booking_v5(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text,jsonb
) from public;
grant execute on function public.create_public_booking_v5(
  text,uuid[],uuid,timestamptz,text,text,uuid,text,text,text,text,jsonb
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) Página pública: configuração de executor de cada adicional e quem está
--    apto a cada serviço (a etapa "Escolha o profissional" usa isso).
-- ---------------------------------------------------------------------------
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
      ), '[]'::jsonb),
      -- Quem está apto a executar este serviço (vínculo serviço/profissional).
      'eligibleProfessionalIds', coalesce((
        select jsonb_agg(apto.professional_id)
        from public.service_eligible_professionals(tenant.id, service.id) apto
      ), '[]'::jsonb),
      -- Configuração do executor quando o serviço é usado como adicional.
      'addonProfessionalMode', coalesce((
        select link.professional_mode from public.service_addon_links link
        where link.addon_service_id = service.id and link.tenant_id = tenant.id
        order by link.position, link.created_at limit 1
      ), 'any'),
      'addonPreferredProfessionalId', (
        select link.assigned_professional_id from public.service_addon_links link
        where link.addon_service_id = service.id and link.tenant_id = tenant.id
        order by link.position, link.created_at limit 1
      )
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
grant execute on function public.get_public_company_page_v3(text) to anon, authenticated, service_role;

commit;
