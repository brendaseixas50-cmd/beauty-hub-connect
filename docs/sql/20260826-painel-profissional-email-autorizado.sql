-- Complemento do Painel Profissional: autorização prévia por e-mail + revogação imediata.
-- Incremental: nenhum DROP de tabela/coluna, nenhum dado ou histórico removido.
-- Ordem de execução: 20260822 -> 20260823 -> 20260824 -> 20260825 -> ESTE ARQUIVO.

begin;

-- Busca rápida do e-mail autorizado dentro da empresa.
create index if not exists professionals_tenant_email_idx
  on public.professionals (tenant_id, lower(email));

-- ---------------------------------------------------------------------------
-- 1. Reivindicação de acesso pelo e-mail previamente autorizado
-- ---------------------------------------------------------------------------
-- Autenticar (Google ou e-mail/senha) NÃO concede acesso profissional.
-- O acesso só existe quando o proprietário cadastrou o e-mail em professionals
-- e o profissional está ativo. Esta função é a única porta de entrada.
create or replace function public.claim_professional_access()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  account_email text;
  active_tenant uuid := private.current_tenant_id();
  target public.professionals;
begin
  if caller is null then
    return json_build_object('status', 'unauthenticated');
  end if;

  select lower(trim(account.email)) into account_email
  from auth.users as account
  where account.id = caller;

  -- Preferência: vínculo/e-mail autorizado na empresa ativa.
  select professional.* into target
  from public.professionals as professional
  where professional.tenant_id = active_tenant
    and (
      professional.user_id = caller
      or (professional.email is not null and lower(trim(professional.email)) = account_email)
    )
  order by professional.active desc
  limit 1;

  -- Caso contrário: qualquer empresa que autorizou este e-mail.
  if target.id is null then
    select professional.* into target
    from public.professionals as professional
    where (
        professional.user_id = caller
        or (professional.email is not null and lower(trim(professional.email)) = account_email)
      )
      and professional.active
    order by (professional.user_id = caller) desc, professional.created_at
    limit 1;
  end if;

  if target.id is null then
    return json_build_object('status', 'not_authorized');
  end if;

  if target.user_id is not null and target.user_id <> caller then
    return json_build_object('status', 'not_authorized');
  end if;

  if not target.active then
    return json_build_object(
      'status', 'disabled',
      'professionalId', target.id,
      'tenantId', target.tenant_id
    );
  end if;

  if target.user_id is null then
    update public.professionals
    set user_id = caller
    where id = target.id;
  end if;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (caller, target.tenant_id, coalesce(target.name, 'Profissional'), 'professional')
  on conflict (id) do nothing;

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (caller, target.tenant_id, 'professional')
  on conflict (user_id, tenant_id) do nothing;

  if active_tenant is distinct from target.tenant_id then
    insert into public.user_active_tenants (user_id, tenant_id)
    values (caller, target.tenant_id)
    on conflict (user_id) do update set tenant_id = excluded.tenant_id;
  end if;

  return json_build_object(
    'status', 'ok',
    'professionalId', target.id,
    'tenantId', target.tenant_id
  );
end;
$$;

revoke all on function public.claim_professional_access() from public, anon;
grant execute on function public.claim_professional_access() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Contexto: aceita vínculo por user_id OU e-mail previamente autorizado
-- ---------------------------------------------------------------------------
create or replace function public.get_my_professional_context()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'professionalId', professional.id,
    'tenantId', tenant.id,
    'tenantName', tenant.name,
    'tenantSlug', tenant.slug,
    'logoUrl', tenant.logo_url,
    'productType', tenant.product_type,
    'timezone', coalesce(tenant.timezone, 'America/Sao_Paulo'),
    'name', professional.name,
    'specialty', professional.specialty,
    'photoUrl', professional.photo_url,
    'active', professional.active,
    'role', coalesce(private.current_role(), 'professional'),
    'authorizedEmail', professional.email,
    'workingHours', professional.working_hours
  )
  from public.professionals as professional
  join public.tenants as tenant on tenant.id = professional.tenant_id
  where professional.tenant_id = private.current_tenant_id()
    and (
      professional.user_id = (select auth.uid())
      or (
        professional.user_id is null
        and professional.email is not null
        and lower(trim(professional.email)) = (
          select lower(trim(account.email)) from auth.users as account where account.id = (select auth.uid())
        )
      )
    )
  order by professional.active desc
  limit 1
$$;

revoke all on function public.get_my_professional_context() from public, anon;
grant execute on function public.get_my_professional_context() to authenticated;

commit;
