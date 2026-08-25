-- Rodada 1 — Base de dados + RLS para a atualização final pré-lançamento.
-- Vale para LuBeauty Pro e LuBarber Pro (estrutura compartilhada, identidade
-- e configuração continuam por empresa em public.tenants).
--
-- Incremental e não destrutivo: nenhum DROP de tabela/coluna, nenhum dado ou
-- histórico removido, nenhuma política existente enfraquecida.
-- Ordem: ... -> 20260828 -> 20260829 -> ESTE ARQUIVO.

begin;

-- ---------------------------------------------------------------------------
-- 1. Configurações por empresa: horizonte da agenda, prazo de cancelamento
--    /remarcação online e gatilho da comissão.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists booking_horizon_days integer not null default 60,
  add column if not exists reschedule_deadline_enabled boolean not null default false,
  add column if not exists reschedule_deadline_hours integer not null default 24,
  add column if not exists commission_trigger text not null default 'completed';

-- Validação por trigger (e não CHECK) para permitir evolução sem restore quebrado.
create or replace function private.validate_tenant_booking_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_horizon_days < 1 or new.booking_horizon_days > 365 then
    raise exception 'O limite de abertura da agenda deve ficar entre 1 e 365 dias.';
  end if;
  if new.reschedule_deadline_hours < 0 or new.reschedule_deadline_hours > 720 then
    raise exception 'A antecedência para cancelamento online deve ficar entre 0 e 720 horas.';
  end if;
  if new.commission_trigger not in ('completed', 'paid') then
    raise exception 'Gatilho de comissão inválido.';
  end if;
  return new;
end;
$$;

drop trigger if exists tenants_validate_booking_rules on public.tenants;
create trigger tenants_validate_booking_rules
before insert or update on public.tenants
for each row execute function private.validate_tenant_booking_rules();

comment on column public.tenants.booking_horizon_days is
  'Até quantos dias à frente a página pública libera horários. Avança com o calendário.';
comment on column public.tenants.reschedule_deadline_enabled is
  'Quando verdadeiro, cancelamento/remarcação online só é permitido dentro da antecedência configurada.';
comment on column public.tenants.commission_trigger is
  'completed = comissão ao concluir o atendimento; paid = somente após receita confirmada.';

-- ---------------------------------------------------------------------------
-- 2. Financeiro 2.0 — campos adicionais na tabela existente.
-- ---------------------------------------------------------------------------
alter table public.financial_entries
  add column if not exists origin text not null default 'other',
  add column if not exists competence_date date not null default current_date,
  add column if not exists client_id uuid,
  add column if not exists professional_id uuid,
  add column if not exists product_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financial_entries_client_id_tenant_id_fkey'
  ) then
    alter table public.financial_entries
      add constraint financial_entries_client_id_tenant_id_fkey
      foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'financial_entries_professional_id_tenant_id_fkey'
  ) then
    alter table public.financial_entries
      add constraint financial_entries_professional_id_tenant_id_fkey
      foreign key (professional_id, tenant_id) references public.professionals (id, tenant_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'financial_entries_product_id_fkey'
  ) then
    alter table public.financial_entries
      add constraint financial_entries_product_id_fkey
      foreign key (product_id) references public.products (id) on delete set null;
  end if;
end;
$$;

-- Categorias/origens ficam livres (texto) para permitir categorias personalizadas.
comment on column public.financial_entries.origin is
  'Origem da movimentação: service, product, subscription, single_sale, other_revenue, operating_expense, supply, stock_purchase, equipment, professional_payment, commission, advance, owner_withdrawal, other_expense.';
comment on column public.financial_entries.competence_date is
  'Competência (mês de referência) da movimentação, independente do vencimento.';

create index if not exists financial_entries_tenant_competence_idx
  on public.financial_entries (tenant_id, competence_date desc);
create index if not exists financial_entries_tenant_professional_idx
  on public.financial_entries (tenant_id, professional_id);

-- Trava contra dupla contabilização: um agendamento gera no máximo uma receita
-- de serviço, mesmo com edições ou mudanças de status repetidas.
create unique index if not exists financial_entries_unique_service_revenue_idx
  on public.financial_entries (tenant_id, appointment_id)
  where appointment_id is not null and entry_type = 'revenue' and origin = 'service';

-- ---------------------------------------------------------------------------
-- 3. Comissões, vales e pagamentos do profissional (histórico imutável).
-- ---------------------------------------------------------------------------
create table if not exists public.professional_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  professional_id uuid not null,
  appointment_id uuid,
  financial_entry_id uuid references public.financial_entries (id) on delete set null,
  kind text not null,
  amount_cents integer not null,
  competence_date date not null default current_date,
  description text not null default '',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_ledger_professional_tenant_fk
    foreign key (professional_id, tenant_id) references public.professionals (id, tenant_id) on delete cascade,
  constraint professional_ledger_appointment_tenant_fk
    foreign key (appointment_id, tenant_id) references public.appointments (id, tenant_id) on delete set null
);

grant select, insert, update on public.professional_ledger_entries to authenticated;
grant all on public.professional_ledger_entries to service_role;

alter table public.professional_ledger_entries enable row level security;

comment on table public.professional_ledger_entries is
  'Histórico financeiro por profissional: commission (comissão gerada), advance (vale/adiantamento), payment (pagamento realizado), adjustment (ajuste auditado). Nunca apagar linhas: correções entram como adjustment.';

create index if not exists professional_ledger_tenant_professional_idx
  on public.professional_ledger_entries (tenant_id, professional_id, competence_date desc);

-- Uma comissão por atendimento: reprocessar/concluir de novo não duplica.
create unique index if not exists professional_ledger_unique_commission_idx
  on public.professional_ledger_entries (tenant_id, appointment_id)
  where appointment_id is not null and kind = 'commission';

create or replace function private.validate_professional_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind not in ('commission', 'advance', 'payment', 'adjustment') then
    raise exception 'Tipo de movimentação do profissional inválido.';
  end if;
  if new.amount_cents = 0 then
    raise exception 'O valor da movimentação não pode ser zero.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists professional_ledger_validate on public.professional_ledger_entries;
create trigger professional_ledger_validate
before insert or update on public.professional_ledger_entries
for each row execute function private.validate_professional_ledger();

-- Gestão (owner/admin) administra tudo da própria empresa.
drop policy if exists "professional_ledger_manage" on public.professional_ledger_entries;
create policy "professional_ledger_manage"
on public.professional_ledger_entries
for all
to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

-- Profissional vê SOMENTE as próprias movimentações, e apenas leitura.
drop policy if exists "professional_ledger_read_own" on public.professional_ledger_entries;
create policy "professional_ledger_read_own"
on public.professional_ledger_entries
for select
to authenticated
using (
  tenant_id = private.current_tenant_id()
  and exists (
    select 1
    from public.professionals as professional
    where professional.id = professional_ledger_entries.professional_id
      and professional.tenant_id = professional_ledger_entries.tenant_id
      and professional.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 4. Link seguro individual do agendamento (token não previsível).
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists manage_token text;

update public.appointments
set manage_token = encode(extensions.gen_random_bytes(24), 'hex')
where manage_token is null;

alter table public.appointments
  alter column manage_token set default encode(extensions.gen_random_bytes(24), 'hex');

create unique index if not exists appointments_manage_token_idx
  on public.appointments (manage_token);

comment on column public.appointments.manage_token is
  'Token opaco usado no link público "Gerenciar meu agendamento". Nunca expor IDs internos na URL.';

-- Nenhuma política nova para anon: o acesso público por token acontece apenas
-- por funções security definer do backend, validando o token linha a linha.

-- ---------------------------------------------------------------------------
-- 5. Endurecimento: financeiro da empresa é exclusivo da gestão.
-- ---------------------------------------------------------------------------
-- Política RESTRITIVA: combina em AND com as políticas já existentes, portanto
-- só pode restringir — nunca ampliar — o acesso atual. Garante que um
-- profissional nunca leia o financeiro geral da empresa nem o de um colega.
-- O profissional continua vendo os próprios ganhos por
-- public.professional_ledger_entries.
drop policy if exists "financial_entries_managers_only" on public.financial_entries;
create policy "financial_entries_managers_only"
on public.financial_entries
as restrictive
for all
to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

commit;
