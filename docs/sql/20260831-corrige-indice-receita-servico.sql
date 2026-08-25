-- ---------------------------------------------------------------------------
-- Correção pontual da Rodada 1: o índice anti-duplicidade da receita de
-- serviço foi criado com entry_type = 'revenue', porém o sistema grava
-- 'income'. Sem esta correção a trava nunca é aplicada e um agendamento
-- poderia gerar duas receitas.
-- ---------------------------------------------------------------------------

drop index if exists public.financial_entries_unique_service_revenue_idx;

create unique index if not exists financial_entries_unique_service_revenue_idx
  on public.financial_entries (tenant_id, appointment_id)
  where appointment_id is not null and entry_type = 'income' and origin = 'service';
