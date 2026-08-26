-- Correção pontual da Rodada de combos multiprofissionais.
--
-- Dois defeitos encontrados em produção na função
-- public.get_public_booking_availability_v3:
--   1. lia target_tenant.booking_rules (coluna que não existe): o horizonte e o
--      prazo mínimo vivem em public.tenants.booking_horizon_days desde 20260830,
--      o que fazia toda consulta de horários falhar com 42703;
--   2. os slots não devolviam o array "professionals", exigido pela página
--      pública para resolver o profissional quando o cliente escolhe
--      "qualquer profissional disponível".
--
-- Incremental e não destrutivo: apenas redefine a função.
-- Ordem: ... -> 20260833 -> ESTE ARQUIVO.

begin;

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
  block_professionals jsonb;
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

  -- Profissionais realmente envolvidos no pedido, na ordem dos blocos: o
  -- primeiro é o responsável principal do agendamento.
  select coalesce(jsonb_agg(jsonb_build_object('id', ordered.id, 'name', ordered.name)), '[]'::jsonb)
    into block_professionals
  from (
    select distinct on (professional.id) professional.id, professional.name, min(block.offset_minutes) as first_offset
    from public.booking_blocks_plan(target_tenant.id, p_service_ids, p_professional_id) block
    join public.professionals professional on professional.id = block.professional_id
    group by professional.id, professional.name
    order by professional.id, first_offset
  ) ordered;

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
  while (slot_local + make_interval(mins => total_duration))::time <= closes_at
        and (slot_local + make_interval(mins => total_duration))::date = p_date loop
    slot_start := slot_local at time zone target_tenant.timezone;
    if slot_start >= now()
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
        'label', to_char(slot_local, 'HH24:MI'),
        'professionals', block_professionals
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

commit;
