-- Herança automática de acesso para profissionais previamente autorizados.
-- Incremental: nenhum DROP de tabela/coluna, nenhum dado removido.
-- Ordem de execução: ... -> 20260826 -> 20260827 -> ESTE ARQUIVO.
--
-- Regra implementada:
--   Um usuário autenticado obtém contexto de empresa (private.current_tenant_id)
--   sem liberação individual no Painel Master SOMENTE quando:
--     1. existe um profissional ATIVO nessa empresa cujo e-mail foi previamente
--        cadastrado pelo proprietário e coincide com o e-mail da conta;
--     2. o vínculo (professionals.user_id) é o próprio usuário;
--     3. o papel do usuário nessa empresa é exatamente 'professional';
--     4. a empresa (e-mail do proprietário) possui liberação ATIVA e vigente
--        em platform_access_grants para o produto da empresa.
--
--   A herança NÃO cria liberação em platform_access_grants, ou seja, o usuário
--   continua com betaAccessActive = false e permanece bloqueado em /painel,
--   Equipe, Financeiro, Configurações administrativas e Painel Master.
--   Se a empresa perder/suspender/expirar o acesso, ou o profissional for
--   desativado/removido da equipe, o contexto volta a ser nulo imediatamente.

begin;

create or replace function private.inherited_professional_tenant_access(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professionals as professional
    join public.tenants as tenant on tenant.id = professional.tenant_id
    join auth.users as owner_account on owner_account.id = tenant.owner_id
    join auth.users as caller_account on caller_account.id = (select auth.uid())
    join public.tenant_memberships as membership
      on membership.tenant_id = tenant.id
     and membership.user_id = caller_account.id
     and membership.role = 'professional'
    join public.platform_access_grants as grant_row
      on grant_row.email = lower(trim(owner_account.email))
     and grant_row.product_type = tenant.product_type
     and grant_row.status = 'active'
     and grant_row.starts_at <= now()
     and (grant_row.expires_at is null or grant_row.expires_at > now())
    where professional.tenant_id = target_tenant
      and tenant.status = 'active'
      and professional.active
      and professional.user_id = caller_account.id
      and professional.email is not null
      and lower(trim(professional.email)) = lower(trim(caller_account.email))
  )
$$;

revoke all on function private.inherited_professional_tenant_access(uuid) from public, anon, authenticated;

comment on function private.inherited_professional_tenant_access(uuid) is
  'Verdadeiro quando o usuário é profissional ativo, com e-mail previamente autorizado, de uma empresa com liberação ativa. Não concede papel administrativo.';

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select active.tenant_id
  from public.user_active_tenants active
  join public.tenant_memberships membership
    on membership.user_id = active.user_id and membership.tenant_id = active.tenant_id
  join public.tenants tenant on tenant.id = active.tenant_id
  where active.user_id = (select auth.uid())
    and (
      private.has_product_access(tenant.product_type)
      or (
        membership.role = 'professional'
        and private.inherited_professional_tenant_access(tenant.id)
      )
    )
$$;

comment on function private.current_tenant_id() is
  'Empresa ativa do usuário: liberação própria no beta fechado OU herança estrita de profissional autorizado por empresa ativa.';

commit;
