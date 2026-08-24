-- Correção pós-auditoria pré-lançamento — bloqueadores de segurança.
-- Incremental: nenhum DROP de tabela/coluna, nenhum dado ou histórico removido.
-- Ordem de execução: 20260822 -> 20260823 -> 20260824 -> 20260825 -> 20260826 -> ESTE ARQUIVO.

begin;

-- ---------------------------------------------------------------------------
-- 1. CRÍTICO — remover auto-convite baseado em metadata controlável pelo cliente
-- ---------------------------------------------------------------------------
-- raw_user_meta_data é enviado pelo cliente no signup e NÃO pode ser fonte de
-- verdade para vínculo empresa/profissional. O único convite aceito é a linha
-- previamente cadastrada em public.professionals pelo proprietário/admin
-- (e-mail autorizado, sem user_id ainda) — validação 100% server-side.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_uuid uuid;
  tenant_name text;
  profile_name text;
  tenant_slug text;
  selected_product text;
  account_email text := lower(trim(coalesce(new.email, '')));
  invited public.professionals;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Profissional'
  );

  -- Convite confiável: e-mail já autorizado por um proprietário/admin.
  if account_email <> '' then
    select professional.* into invited
    from public.professionals as professional
    where professional.user_id is null
      and professional.active
      and professional.email is not null
      and lower(trim(professional.email)) = account_email
    order by professional.created_at
    limit 1;
  end if;

  if invited.id is not null then
    update public.professionals
    set user_id = new.id
    where id = invited.id
      and user_id is null;

    insert into public.profiles (id, tenant_id, full_name, role)
    values (new.id, invited.tenant_id, coalesce(invited.name, profile_name), 'professional')
    on conflict (id) do nothing;

    insert into public.tenant_memberships (user_id, tenant_id, role)
    values (new.id, invited.tenant_id, 'professional')
    on conflict (user_id, tenant_id) do nothing;

    insert into public.user_active_tenants (user_id, tenant_id)
    values (new.id, invited.tenant_id)
    on conflict (user_id) do nothing;

    return new;
  end if;

  tenant_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Minha empresa'
  );
  selected_product := case
    when new.raw_user_meta_data ->> 'product_type' = 'barber' then 'barber'
    else 'beauty'
  end;
  tenant_slug := trim(both '-' from regexp_replace(lower(tenant_name), '[^a-z0-9]+', '-', 'g'));
  tenant_slug := coalesce(nullif(tenant_slug, ''), 'empresa') || '-' || left(new.id::text, 8);

  insert into public.tenants (owner_id, slug, name, email, product_type)
  values (new.id, tenant_slug, tenant_name, new.email, selected_product)
  returning id into tenant_uuid;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (new.id, tenant_uuid, profile_name, 'owner');

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (new.id, tenant_uuid, 'owner');

  insert into public.user_active_tenants (user_id, tenant_id)
  values (new.id, tenant_uuid);

  insert into public.professionals (tenant_id, user_id, name, email, specialty)
  values (tenant_uuid, new.id, profile_name, new.email, 'Proprietário(a)');

  return new;
end;
$$;

comment on function private.handle_new_auth_user() is
  'Cria empresa própria no signup ou vincula o usuário ao profissional cujo e-mail foi previamente autorizado. Nunca confia em invited_tenant_id/metadata do cliente.';

-- ---------------------------------------------------------------------------
-- 2. Troca/seleção de tenant segura na reivindicação profissional
-- ---------------------------------------------------------------------------
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
  active_role text := private.current_role();
  target public.professionals;
  switched boolean := false;
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
      or (
        professional.user_id is null
        and professional.email is not null
        and lower(trim(professional.email)) = account_email
      )
    )
  order by professional.active desc
  limit 1;

  -- Caso contrário: empresa que autorizou explicitamente este e-mail/usuário.
  if target.id is null then
    select professional.* into target
    from public.professionals as professional
    where (
        professional.user_id = caller
        or (
          professional.user_id is null
          and professional.email is not null
          and lower(trim(professional.email)) = account_email
        )
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
    where id = target.id
      and user_id is null;
  end if;

  -- Vínculo profissional NUNCA gera poderes administrativos na empresa.
  insert into public.profiles (id, tenant_id, full_name, role)
  values (caller, target.tenant_id, coalesce(target.name, 'Profissional'), 'professional')
  on conflict (id) do nothing;

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (caller, target.tenant_id, 'professional')
  on conflict (user_id, tenant_id) do nothing;

  -- Troca de empresa ativa apenas quando não há contexto administrativo em uso.
  if active_tenant is null then
    insert into public.user_active_tenants (user_id, tenant_id)
    values (caller, target.tenant_id)
    on conflict (user_id) do update set tenant_id = excluded.tenant_id;
    switched := true;
  elsif active_tenant is distinct from target.tenant_id
    and coalesce(active_role, 'professional') not in ('owner', 'admin') then
    update public.user_active_tenants
    set tenant_id = target.tenant_id
    where user_id = caller;
    switched := true;
  end if;

  return json_build_object(
    'status', 'ok',
    'professionalId', target.id,
    'tenantId', target.tenant_id,
    'switched', switched,
    'activeTenantId', coalesce(private.current_tenant_id(), target.tenant_id)
  );
end;
$$;

revoke all on function public.claim_professional_access() from public, anon;
grant execute on function public.claim_professional_access() to authenticated;

comment on function public.claim_professional_access() is
  'Valida e-mail previamente autorizado e cria o vínculo profissional. Não substitui contexto administrativo (owner/admin) de outra empresa.';

-- ---------------------------------------------------------------------------
-- 3. ALTO — RLS por papel e por profissional
-- ---------------------------------------------------------------------------

-- appointment_services: profissional restrito só manipula itens dos próprios agendamentos.
drop policy if exists "members manage own appointment services" on public.appointment_services;
create policy "members manage own appointment services"
on public.appointment_services for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
  and (
    not private.is_restricted_professional()
    or exists (
      select 1 from public.appointments as appointment
      where appointment.id = appointment_services.appointment_id
        and appointment.tenant_id = private.current_tenant_id()
        and appointment.professional_id = private.current_professional_id()
    )
  )
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
  and (
    not private.is_restricted_professional()
    or exists (
      select 1 from public.appointments as appointment
      where appointment.id = appointment_services.appointment_id
        and appointment.tenant_id = private.current_tenant_id()
        and appointment.professional_id = private.current_professional_id()
    )
  )
);

-- professional_services: apenas owner/admin gerenciam vínculos; profissional só lê.
drop policy if exists "members manage own professional services" on public.professional_services;
drop policy if exists "managers manage own professional services" on public.professional_services;
create policy "managers manage own professional services"
on public.professional_services for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

drop policy if exists "members read own professional services" on public.professional_services;
create policy "members read own professional services"
on public.professional_services for select to authenticated
using (tenant_id = private.current_tenant_id());

-- Cupons, lista de espera, categorias e pacotes: gestão administrativa/recepção.
drop policy if exists "members manage own coupons" on public.coupons;
drop policy if exists "managers manage own coupons" on public.coupons;
create policy "managers manage own coupons"
on public.coupons for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
drop policy if exists "members read own coupons" on public.coupons;
create policy "members read own coupons"
on public.coupons for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'receptionist')
);

drop policy if exists "members manage own waitlist" on public.waitlist_entries;
drop policy if exists "managers manage own waitlist" on public.waitlist_entries;
create policy "managers manage own waitlist"
on public.waitlist_entries for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'receptionist')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'receptionist')
);
drop policy if exists "members read own waitlist" on public.waitlist_entries;
create policy "members read own waitlist"
on public.waitlist_entries for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (
    not private.is_restricted_professional()
    or professional_id = private.current_professional_id()
  )
);

drop policy if exists "members manage own categories" on public.product_categories;
drop policy if exists "managers manage own categories" on public.product_categories;
create policy "managers manage own categories"
on public.product_categories for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
drop policy if exists "members read own categories" on public.product_categories;
create policy "members read own categories"
on public.product_categories for select to authenticated
using (tenant_id = private.current_tenant_id());

drop policy if exists "members manage own packages" on public.service_packages;
drop policy if exists "managers manage own packages" on public.service_packages;
create policy "managers manage own packages"
on public.service_packages for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
drop policy if exists "members read own packages" on public.service_packages;
create policy "members read own packages"
on public.service_packages for select to authenticated
using (tenant_id = private.current_tenant_id());

-- ---------------------------------------------------------------------------
-- 4. BAIXO — cliente duplicado por telefone (mesmo tenant, sem cruzar empresas)
-- ---------------------------------------------------------------------------
create or replace function public.professional_create_client(
  p_name text,
  p_phone text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := private.current_professional_id();
  target_tenant uuid := private.current_tenant_id();
  normalized_phone text;
  existing_id uuid;
  new_id uuid;
begin
  if target is null or target_tenant is null then
    raise exception 'Acesso profissional desativado' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'Informe o nome do cliente' using errcode = '22023';
  end if;

  normalized_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');

  if normalized_phone is not null then
    select client.id into existing_id
    from public.clients as client
    where client.tenant_id = target_tenant
      and client.phone_normalized = normalized_phone
    limit 1;
  end if;

  if existing_id is not null then
    update public.clients
    set last_professional_id = target,
        name = case when char_length(trim(p_name)) >= 2 then trim(p_name) else name end,
        email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email)
    where id = existing_id
      and tenant_id = target_tenant;
    return existing_id;
  end if;

  begin
    insert into public.clients (tenant_id, name, phone, email, last_professional_id)
    values (
      target_tenant,
      trim(p_name),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      target
    )
    returning id into new_id;
  exception when unique_violation then
    raise exception 'Já existe um cliente com este telefone nesta empresa.' using errcode = '23505';
  end;

  return new_id;
end;
$$;

revoke all on function public.professional_create_client(text, text, text) from public, anon;
grant execute on function public.professional_create_client(text, text, text) to authenticated;

comment on function public.professional_create_client(text, text, text) is
  'Cria (ou reutiliza, dentro da mesma empresa) o cliente do profissional autenticado, sem deduplicar entre empresas.';

commit;
