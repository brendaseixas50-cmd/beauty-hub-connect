-- Etapa 3 (parte 2/2): garante que a DURAÇÃO REAL e o PREÇO REAL do combo
-- valham na disponibilidade, no bloqueio do horário e no total cobrado.
--
-- Nada é apagado. Só são criadas funções/triggers novas e vínculos derivados
-- (professional_services do próprio combo). Serviços normais não são afetados:
-- todas as regras abaixo só entram em ação quando services.is_combo = true.
--
-- Executar DEPOIS de docs/sql/20260822-servicos-foto-e-combos.sql.

-- ---------------------------------------------------------------------------
-- 1) Integridade da composição: sem auto-referência, sem combo dentro de combo
--    e sem misturar empresas.
-- ---------------------------------------------------------------------------
create or replace function public.validate_service_combo_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent record;
  v_child record;
begin
  if new.combo_service_id = new.service_id then
    raise exception 'Um combo não pode conter ele mesmo.';
  end if;

  select id, tenant_id, is_combo into v_parent
  from public.services where id = new.combo_service_id;
  select id, tenant_id, is_combo into v_child
  from public.services where id = new.service_id;

  if v_parent.tenant_id is distinct from new.tenant_id
     or v_child.tenant_id is distinct from new.tenant_id then
    raise exception 'Serviços de empresas diferentes não podem compor um combo.';
  end if;
  if coalesce(v_child.is_combo, false) then
    raise exception 'Um combo não pode conter outro combo.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_service_combo_item on public.service_combo_items;
create trigger validate_service_combo_item
before insert or update on public.service_combo_items
for each row execute function public.validate_service_combo_item();

-- ---------------------------------------------------------------------------
-- 2) Profissionais compatíveis — regra nova (multiprofissional):
--
--    a) serviço SEM escolha de profissional (requires_professional = false):
--       qualquer profissional ativo da empresa pode ser registrado como
--       responsável interno, então todos ficam vinculados ao serviço. O cliente
--       não precisa escolher ninguém na página pública.
--
--    b) COMBO: a compatibilidade é verificada serviço por serviço. Um
--       profissional é apto ao combo quando executa PELO MENOS UM dos itens que
--       exigem profissional. Se nenhum item do combo exige profissional, todos
--       os profissionais ativos ficam aptos. O combo só fica inviável quando
--       algum item que exige profissional não tem nenhum profissional apto —
--       nesse caso nenhum vínculo é criado e ele não aparece com horários.
--
--    Serviços normais (requires_professional = true e não combo) continuam
--    exatamente como hoje: vínculo manual em professional_services.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_combo_professional_links(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- (a) serviços sem escolha pública de profissional: todos os ativos atendem
  insert into public.professional_services (tenant_id, professional_id, service_id)
  select p_tenant_id, professional.id, service.id
  from public.services service
  join public.professionals professional
    on professional.tenant_id = service.tenant_id and professional.active
  where service.tenant_id = p_tenant_id
    and not service.is_combo
    and not service.requires_professional
  on conflict do nothing;

  -- (b) combos: vincula quem executa ao menos um item que exige profissional
  insert into public.professional_services (tenant_id, professional_id, service_id)
  select p_tenant_id, professional.id, combo.id
  from public.services combo
  join public.professionals professional
    on professional.tenant_id = combo.tenant_id and professional.active
  where combo.tenant_id = p_tenant_id
    and combo.is_combo
    and exists (select 1 from public.service_combo_items item
                where item.combo_service_id = combo.id)
    -- todo item que exige profissional precisa ter alguém apto na empresa
    and not exists (
      select 1
      from public.service_combo_items item
      join public.services child on child.id = item.service_id
      where item.combo_service_id = combo.id
        and child.requires_professional
        and not exists (
          select 1 from public.professional_services link
          join public.professionals other
            on other.id = link.professional_id and other.active
          where link.tenant_id = p_tenant_id and link.service_id = item.service_id
        )
    )
    -- e este profissional executa ao menos um item que exige profissional
    -- (ou o combo é inteiramente composto por serviços sem escolha)
    and (
      not exists (
        select 1 from public.service_combo_items item
        join public.services child on child.id = item.service_id
        where item.combo_service_id = combo.id and child.requires_professional
      )
      or exists (
        select 1 from public.service_combo_items item
        join public.services child on child.id = item.service_id
        join public.professional_services link
          on link.service_id = item.service_id
         and link.tenant_id = p_tenant_id
         and link.professional_id = professional.id
        where item.combo_service_id = combo.id and child.requires_professional
      )
    )
  on conflict do nothing;

  -- remove apenas vínculos derivados de combo que deixaram de ser válidos
  delete from public.professional_services link
  using public.services combo
  where link.tenant_id = p_tenant_id
    and combo.id = link.service_id
    and combo.tenant_id = p_tenant_id
    and combo.is_combo
    and exists (
      select 1 from public.service_combo_items item
      join public.services child on child.id = item.service_id
      where item.combo_service_id = combo.id and child.requires_professional
    )
    and not exists (
      select 1 from public.service_combo_items item
      join public.services child on child.id = item.service_id
      join public.professional_services inner_link
        on inner_link.service_id = item.service_id
       and inner_link.tenant_id = p_tenant_id
       and inner_link.professional_id = link.professional_id
      where item.combo_service_id = combo.id and child.requires_professional
    );
end;
$$;

create or replace function public.sync_combo_professional_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  perform public.refresh_combo_professional_links(v_tenant);
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_combo_links_on_items on public.service_combo_items;
create trigger sync_combo_links_on_items
after insert or update or delete on public.service_combo_items
for each row execute function public.sync_combo_professional_links();

drop trigger if exists sync_combo_links_on_professional_services on public.professional_services;
create trigger sync_combo_links_on_professional_services
after insert or delete on public.professional_services
for each row execute function public.sync_combo_professional_links();

drop trigger if exists sync_combo_links_on_services on public.services;
create trigger sync_combo_links_on_services
after update of is_combo, requires_professional, active on public.services
for each row execute function public.sync_combo_professional_links();

drop trigger if exists sync_combo_links_on_new_services on public.services;
create trigger sync_combo_links_on_new_services
after insert on public.services
for each row execute function public.sync_combo_professional_links();

drop trigger if exists sync_combo_links_on_professionals on public.professionals;
create trigger sync_combo_links_on_professionals
after insert or update of active on public.professionals
for each row execute function public.sync_combo_professional_links();

-- vínculos já cadastrados (combos + serviços sem escolha de profissional)
do $$
declare
  v_tenant uuid;
begin
  for v_tenant in
    select distinct tenant_id from public.services
    where is_combo or not requires_professional
  loop
    perform public.refresh_combo_professional_links(v_tenant);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Preço e duração reais do combo no agendamento.
--    a) o item do agendamento sempre grava a duração/preço configurados no combo
--       (nunca a soma dos serviços individuais);
--    b) o agendamento tem ends_at e price_cents recalculados a partir dos itens
--       quando há combo envolvido — sem tocar em agendamentos sem combo.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_combo_item_values()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_service record;
begin
  select duration_minutes, price_cents, is_combo into v_service
  from public.services where id = new.service_id;
  if coalesce(v_service.is_combo, false) then
    new.duration_minutes := v_service.duration_minutes;
    new.price_cents := v_service.price_cents;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_combo_item_values on public.appointment_services;
create trigger enforce_combo_item_values
before insert or update on public.appointment_services
for each row execute function public.enforce_combo_item_values();

create or replace function public.sync_appointment_totals_for_combo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_appointment uuid := coalesce(new.appointment_id, old.appointment_id);
  v_has_combo boolean;
  v_minutes integer;
  v_price integer;
begin
  select bool_or(service.is_combo),
         sum(item.duration_minutes),
         sum(item.price_cents)
    into v_has_combo, v_minutes, v_price
  from public.appointment_services item
  join public.services service on service.id = item.service_id
  where item.appointment_id = v_appointment;

  if not coalesce(v_has_combo, false) or coalesce(v_minutes, 0) <= 0 then
    return coalesce(new, old);
  end if;

  update public.appointments appointment
     set ends_at = appointment.starts_at + make_interval(mins => v_minutes),
         price_cents = coalesce(v_price, appointment.price_cents),
         updated_at = now()
   where appointment.id = v_appointment;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_appointment_totals_for_combo on public.appointment_services;
create trigger sync_appointment_totals_for_combo
after insert or update or delete on public.appointment_services
for each row execute function public.sync_appointment_totals_for_combo();

-- ---------------------------------------------------------------------------
-- 4) Verificação rápida (opcional) — combos e seus profissionais compatíveis:
--
-- select service.name, service.duration_minutes, service.price_cents,
--        (select count(*) from public.professional_services link
--          where link.service_id = service.id) as profissionais
--   from public.services service where service.is_combo;
-- ---------------------------------------------------------------------------
