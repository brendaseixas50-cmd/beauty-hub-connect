-- Beta fechado: solicitações automáticas pendentes (executar no banco de produção).
-- Nada é aprovado automaticamente: apenas registra o pedido para a administradora decidir.

alter table public.platform_access_grants drop constraint if exists platform_access_grants_status_check;
alter table public.platform_access_grants
  add constraint platform_access_grants_status_check
  check (status in ('pending', 'active', 'suspended', 'revoked', 'expired'));

create or replace function public.request_platform_access(target_product text)
returns text language plpgsql security definer set search_path = '' as $$
declare current_email text; existing_status text;
begin
  if target_product not in ('beauty', 'barber') then
    raise exception 'Invalid product' using errcode = '22023';
  end if;
  select lower(trim(email)) into current_email from auth.users where id = auth.uid();
  if current_email is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select status into existing_status from public.platform_access_grants
  where email = current_email and product_type = target_product;
  if existing_status is not null then
    return existing_status;
  end if;
  insert into public.platform_access_grants
    (email, user_id, product_type, access_type, status, plan_code, notes)
  values (current_email, auth.uid(), target_product, 'beta_tester', 'pending', 'solo',
    'Solicitação automática de acesso ao beta fechado.')
  on conflict (email, product_type) do nothing;
  return 'pending';
end; $$;

revoke all on function public.request_platform_access(text) from public, anon;
grant execute on function public.request_platform_access(text) to authenticated;

-- Painel Master permanece igual, apenas aceitando o status "pending".
create or replace function public.admin_upsert_platform_access(target_email text, target_product text,
  target_access_type text, target_status text, target_plan text,
  target_expires_at timestamptz default null, target_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if not private.is_platform_administrator() then raise exception 'Access denied' using errcode = '42501'; end if;
  if target_product not in ('beauty','barber') or target_access_type not in ('administrator','courtesy','beta_tester')
    or target_status not in ('pending','active','suspended','revoked','expired') or target_plan not in ('solo','team') then
    raise exception 'Invalid access data' using errcode = '22023'; end if;
  insert into public.platform_access_grants (email,user_id,product_type,access_type,status,plan_code,expires_at,notes)
  select lower(trim(target_email)), auth_user.id, target_product, target_access_type, target_status,
    target_plan, target_expires_at, nullif(trim(target_notes), '') from (select 1) source
  left join auth.users auth_user on lower(auth_user.email) = lower(trim(target_email))
  on conflict (email,product_type) do update set user_id = coalesce(excluded.user_id,platform_access_grants.user_id),
    access_type=excluded.access_type,status=excluded.status,plan_code=excluded.plan_code,
    expires_at=excluded.expires_at,notes=excluded.notes,updated_at=now()
  returning platform_access_grants.id into grant_id;
  if target_status = 'active' then
    perform private.apply_access_plan_to_tenant(target_email,target_product,target_plan);
  end if;
  return grant_id;
end; $$;

revoke all on function public.admin_upsert_platform_access(text,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.admin_upsert_platform_access(text,text,text,text,text,timestamptz,text) to authenticated;
