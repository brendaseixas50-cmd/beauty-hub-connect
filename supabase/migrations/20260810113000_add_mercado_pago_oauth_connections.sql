create table if not exists public.payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  provider_user_id text,
  account_email text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  scopes text,
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table if not exists public.payment_provider_oauth_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago')),
  state_hash text not null unique,
  code_verifier_ciphertext text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_provider_oauth_states_expiry_idx
  on public.payment_provider_oauth_states (expires_at);

alter table public.payment_provider_connections enable row level security;
alter table public.payment_provider_oauth_states enable row level security;

create policy "Members can view payment connection metadata"
on public.payment_provider_connections for select to authenticated
using (tenant_id = private.current_tenant_id());

revoke all on public.payment_provider_connections from anon, authenticated;
grant select (id, tenant_id, provider, status, provider_user_id, account_email, token_expires_at,
  scopes, last_error, connected_at, created_at, updated_at)
on public.payment_provider_connections to authenticated;
revoke all on public.payment_provider_oauth_states from anon, authenticated;

comment on table public.payment_provider_connections is
  'Conexoes OAuth por empresa. Tokens sao cifrados no servidor e nunca concedidos aos clientes.';
