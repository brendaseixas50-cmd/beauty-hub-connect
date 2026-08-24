-- Correção de GRANTs mínimos para o backend (service_role) — pré-lançamento.
-- Incremental e não destrutivo: nenhum DROP, nenhum dado removido, nenhuma
-- política de RLS alterada. Apenas privilégios de tabela/sequência.
--
-- Motivo: o Data API do Supabase não concede privilégios padrão no schema
-- public. As server functions (cliente administrativo) liam tenants, services,
-- profiles, tenant_memberships, professional_services, appointment_services,
-- products, coupons, waitlist_entries, product_categories, service_packages e
-- user_active_tenants e recebiam "permission denied" (42501), fazendo regras de
-- disponibilidade/agenda "falharem em aberto".
--
-- Ordem de execução: ... -> 20260827 -> 20260828 -> ESTE ARQUIVO.

begin;

-- service_role é exclusivamente server-side (chave secreta, nunca exposta ao
-- navegador) e por definição ignora RLS. Conceder DML completo nas tabelas do
-- schema public é o comportamento padrão do Supabase e o mínimo necessário para
-- que as server functions funcionem.
grant usage on schema public to service_role;

do $$
declare
  target record;
begin
  for target in
    select c.relname
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format(
      'grant select, insert, update, delete on public.%I to service_role',
      target.relname
    );
  end loop;
end;
$$;

do $$
declare
  target record;
begin
  for target in
    select c.relname
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  loop
    execute format('grant usage, select on sequence public.%I to service_role', target.relname);
  end loop;
end;
$$;

-- Tabelas futuras já nascem acessíveis ao backend (evita reincidência do bug).
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

commit;
