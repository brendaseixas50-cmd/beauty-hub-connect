-- Painel Profissional — acesso individual, isolamento por profissional e revogação imediata.
-- Incremental: nenhum DROP de tabela/coluna, nenhum dado ou histórico removido.
-- Ordem de execução: 20260822 -> 20260823 -> 20260824 -> ESTE ARQUIVO.

begin;

-- ---------------------------------------------------------------------------
-- 1. Helpers de autorização
-- ---------------------------------------------------------------------------

-- Profissional ATIVO vinculado ao usuário autenticado na empresa ativa.
create or replace function private.current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select professional.id
  from public.professionals as professional
  where professional.user_id = (select auth.uid())
    and professional.tenant_id = private.current_tenant_id()
    and professional.active
  limit 1
$$;

revoke all on function private.current_professional_id() from public, anon;
grant execute on function private.current_professional_id() to authenticated;

-- Usuário cuja função na empresa é exclusivamente "profissional".
create or replace function private.is_restricted_professional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'professional', false)
$$;

revoke all on function private.is_restricted_professional() from public, anon;
grant execute on function private.is_restricted_professional() to authenticated;

create index if not exists professionals_tenant_user_idx
  on public.professionals (tenant_id, user_id);
create index if not exists appointments_tenant_professional_start_idx
  on public.appointments (tenant_id, professional_id, starts_at);

-- ---------------------------------------------------------------------------
-- 2. Contexto do Painel Profissional
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
    'workingHours', professional.working_hours
  )
  from public.professionals as professional
  join public.tenants as tenant on tenant.id = professional.tenant_id
  where professional.user_id = (select auth.uid())
    and professional.tenant_id = private.current_tenant_id()
  limit 1
$$;

revoke all on function public.get_my_professional_context() from public, anon;
grant execute on function public.get_my_professional_context() to authenticated;

-- Horários de atendimento do próprio profissional (sem liberar update na tabela).
create or replace function public.professional_update_working_hours(p_working_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := private.current_professional_id();
begin
  if target is null then
    raise exception 'Acesso profissional desativado' using errcode = '42501';
  end if;
  update public.professionals
  set working_hours = coalesce(p_working_hours, '{}'::jsonb)
  where id = target;
end;
$$;

revoke all on function public.professional_update_working_hours(jsonb) from public, anon;
grant execute on function public.professional_update_working_hours(jsonb) to authenticated;

-- Cliente criado pelo profissional durante um agendamento manual.
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
  new_id uuid;
begin
  if target is null or target_tenant is null then
    raise exception 'Acesso profissional desativado' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'Informe o nome do cliente' using errcode = '22023';
  end if;
  insert into public.clients (tenant_id, name, phone, email, last_professional_id)
  values (
    target_tenant,
    trim(p_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    target
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.professional_create_client(text, text, text) from public, anon;
grant execute on function public.professional_create_client(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Provisionamento administrativo (apenas service_role / servidor)
-- ---------------------------------------------------------------------------

create or replace function public.admin_find_auth_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account.id
  from auth.users as account
  where lower(account.email) = lower(trim(p_email))
  limit 1
$$;

revoke all on function public.admin_find_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.admin_find_auth_user_id(text) to service_role;

create or replace function public.admin_link_professional_account(
  p_professional_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant uuid;
  professional_name text;
  professional_email text;
begin
  select tenant_id, name, email
  into target_tenant, professional_name, professional_email
  from public.professionals
  where id = p_professional_id;

  if target_tenant is null then
    raise exception 'Profissional inexistente' using errcode = '22023';
  end if;

  update public.professionals
  set user_id = p_user_id
  where id = p_professional_id;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (p_user_id, target_tenant, coalesce(professional_name, 'Profissional'), 'professional')
  on conflict (id) do nothing;

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (p_user_id, target_tenant, 'professional')
  on conflict (user_id, tenant_id) do nothing;

  insert into public.user_active_tenants (user_id, tenant_id)
  values (p_user_id, target_tenant)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.admin_link_professional_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_link_professional_account(uuid, uuid) to service_role;

-- Contas convidadas como profissional não criam empresa própria.
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
  invited_tenant uuid;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Profissional'
  );

  begin
    invited_tenant := nullif(new.raw_user_meta_data ->> 'invited_tenant_id', '')::uuid;
  exception when others then
    invited_tenant := null;
  end;

  if invited_tenant is not null
     and exists (select 1 from public.tenants where id = invited_tenant) then
    insert into public.profiles (id, tenant_id, full_name, role)
    values (new.id, invited_tenant, profile_name, 'professional')
    on conflict (id) do nothing;
    insert into public.tenant_memberships (user_id, tenant_id, role)
    values (new.id, invited_tenant, 'professional')
    on conflict (user_id, tenant_id) do nothing;
    insert into public.user_active_tenants (user_id, tenant_id)
    values (new.id, invited_tenant)
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

-- ---------------------------------------------------------------------------
-- 4. Isolamento por profissional (RLS)
-- ---------------------------------------------------------------------------

-- Agendamentos: profissional vê e altera apenas os próprios.
drop policy if exists "members read own appointments" on public.appointments;
create policy "members read own appointments"
on public.appointments for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (
    not private.is_restricted_professional()
    or professional_id = private.current_professional_id()
  )
);

drop policy if exists "members write own appointments" on public.appointments;
create policy "members write own appointments"
on public.appointments for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
  and (
    not private.is_restricted_professional()
    or professional_id = private.current_professional_id()
  )
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
  and (
    not private.is_restricted_professional()
    or professional_id = private.current_professional_id()
  )
);

-- Itens do agendamento (combos e adicionais) seguem o agendamento.
drop policy if exists "members read own appointment services" on public.appointment_services;
create policy "members read own appointment services"
on public.appointment_services for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (
    not private.is_restricted_professional()
    or exists (
      select 1 from public.appointments as appointment
      where appointment.id = appointment_services.appointment_id
        and appointment.professional_id = private.current_professional_id()
    )
  )
);

-- Clientes: profissional acessa apenas quem ele atende.
drop policy if exists "members read own clients" on public.clients;
create policy "members read own clients"
on public.clients for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (
    not private.is_restricted_professional()
    or last_professional_id = private.current_professional_id()
    or exists (
      select 1 from public.appointments as appointment
      where appointment.client_id = clients.id
        and appointment.professional_id = private.current_professional_id()
    )
  )
);

drop policy if exists "members write own clients" on public.clients;
create policy "members write own clients"
on public.clients for all to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
  and (
    not private.is_restricted_professional()
    or last_professional_id = private.current_professional_id()
    or exists (
      select 1 from public.appointments as appointment
      where appointment.client_id = clients.id
        and appointment.professional_id = private.current_professional_id()
    )
  )
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin', 'professional', 'receptionist')
);

-- Cadastro de profissionais: profissional só enxerga a própria ficha.
drop policy if exists "members read own professionals" on public.professionals;
create policy "members read own professionals"
on public.professionals for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (
    not private.is_restricted_professional()
    or user_id = (select auth.uid())
  )
);

-- Bloqueios, folgas e férias: cada profissional gerencia os próprios.
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'professional_unavailability'
  ) then
    execute 'alter table public.professional_unavailability enable row level security';
    execute 'drop policy if exists "members read own unavailability" on public.professional_unavailability';
    execute $p$
      create policy "members read own unavailability"
      on public.professional_unavailability for select to authenticated
      using (
        tenant_id = private.current_tenant_id()
        and (
          not private.is_restricted_professional()
          or professional_id = private.current_professional_id()
        )
      )
    $p$;
    execute 'drop policy if exists "members manage own unavailability" on public.professional_unavailability';
    execute 'drop policy if exists "managers manage own unavailability" on public.professional_unavailability';
    execute $p$
      create policy "members manage own unavailability"
      on public.professional_unavailability for all to authenticated
      using (
        tenant_id = private.current_tenant_id()
        and (select private.current_role()) in ('owner', 'admin', 'professional')
        and (
          not private.is_restricted_professional()
          or professional_id = private.current_professional_id()
        )
      )
      with check (
        tenant_id = private.current_tenant_id()
        and (select private.current_role()) in ('owner', 'admin', 'professional')
        and (
          not private.is_restricted_professional()
          or professional_id = private.current_professional_id()
        )
      )
    $p$;
    execute 'revoke all on public.professional_unavailability from anon';
    execute 'grant select, insert, update, delete on public.professional_unavailability to authenticated';
    execute 'grant all on public.professional_unavailability to service_role';
  end if;
end;
$$;

grant select, insert, update, delete on public.appointments, public.clients to authenticated;
grant select on public.professionals, public.professional_services, public.services,
  public.service_combo_items, public.appointment_services to authenticated;
grant all on public.appointments, public.clients, public.professionals to service_role;

comment on function public.get_my_professional_context() is
  'Contexto do Painel Profissional do usuário autenticado (inclui active=false quando desativado).';

commit;
