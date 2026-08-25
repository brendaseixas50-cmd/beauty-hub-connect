-- Permissão para concluir atendimentos (LuBeauty + LuBarber).
-- Incremental e não destrutivo: apenas adiciona uma preferência por empresa.
--
-- Valores:
--   'management'              -> somente proprietário/administrador (PADRÃO)
--   'management_professional' -> gestão + profissional responsável pelo atendimento
--
-- Ordem de execução: ... -> 20260831 -> ESTE ARQUIVO.

begin;

alter table public.tenants
  add column if not exists completion_permission text not null default 'management';

update public.tenants
set completion_permission = 'management'
where completion_permission is null
   or completion_permission not in ('management', 'management_professional');

alter table public.tenants
  drop constraint if exists tenants_completion_permission_check;

alter table public.tenants
  add constraint tenants_completion_permission_check
  check (completion_permission in ('management', 'management_professional'));

comment on column public.tenants.completion_permission is
  'Quem pode marcar um atendimento como concluído: management (padrão) ou management_professional.';

commit;
