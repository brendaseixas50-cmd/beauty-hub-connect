alter table public.tenants
  add column if not exists onboarding_completed_at timestamptz;

create table public.specialty_catalog (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  product_type text not null check (product_type in ('beauty', 'barber')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specialty_service_suggestions (
  id uuid primary key default gen_random_uuid(),
  specialty_id text not null references public.specialty_catalog(id) on delete cascade,
  service_key text not null check (service_key ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  category text,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (specialty_id, service_key)
);

create table public.tenant_specialties (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  specialty_id text not null references public.specialty_catalog(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, specialty_id)
);

create unique index tenant_specialties_one_primary_idx
  on public.tenant_specialties (tenant_id) where is_primary;
create index specialty_service_suggestions_specialty_idx
  on public.specialty_service_suggestions (specialty_id, active, sort_order);

alter table public.specialty_catalog enable row level security;
alter table public.specialty_service_suggestions enable row level security;
alter table public.tenant_specialties enable row level security;

create policy "authenticated read specialty catalog"
on public.specialty_catalog for select to authenticated using (active);
create policy "authenticated read specialty suggestions"
on public.specialty_service_suggestions for select to authenticated using (active);
create policy "members read own specialties"
on public.tenant_specialties for select to authenticated
using (tenant_id = private.current_tenant_id());
create policy "managers insert own specialties"
on public.tenant_specialties for insert to authenticated
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own specialties"
on public.tenant_specialties for update to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own specialties"
on public.tenant_specialties for delete to authenticated
using (
  tenant_id = private.current_tenant_id()
  and (select private.current_role()) in ('owner', 'admin')
);

revoke all on public.specialty_catalog from anon;
revoke all on public.specialty_service_suggestions from anon;
revoke all on public.tenant_specialties from anon;
grant select on public.specialty_catalog, public.specialty_service_suggestions to authenticated;
grant select, insert, update, delete on public.tenant_specialties to authenticated;

insert into public.specialty_catalog (id, name, product_type, sort_order) values
  ('cabeleireira', 'Cabeleireira', 'beauty', 10),
  ('manicure', 'Manicure', 'beauty', 20),
  ('nail-designer', 'Nail designer', 'beauty', 30),
  ('lash-designer', 'Lash designer', 'beauty', 40),
  ('designer-sobrancelhas', 'Designer de sobrancelhas', 'beauty', 50),
  ('estetica', 'Estética', 'beauty', 60),
  ('maquiagem', 'Maquiagem', 'beauty', 70),
  ('depilacao', 'Depilação', 'beauty', 80),
  ('massoterapia', 'Massoterapia', 'beauty', 90),
  ('trancas', 'Tranças', 'beauty', 100),
  ('micropigmentacao', 'Micropigmentação', 'beauty', 110),
  ('podologia', 'Podologia', 'beauty', 120),
  ('barbeiro', 'Barbeiro', 'barber', 10)
on conflict (id) do update set
  name = excluded.name, product_type = excluded.product_type,
  active = true, sort_order = excluded.sort_order, updated_at = now();

insert into public.specialty_service_suggestions
  (specialty_id, service_key, name, category, duration_minutes, price_cents, sort_order)
values
  ('cabeleireira','corte-feminino','Corte feminino','Cabelo',60,5000,10),
  ('cabeleireira','escova','Escova','Cabelo',60,4500,20),
  ('cabeleireira','hidratacao-capilar','Hidratação capilar','Cabelo',60,6000,30),
  ('cabeleireira','coloracao','Coloração','Cabelo',120,12000,40),
  ('manicure','manicure-tradicional','Manicure tradicional','Unhas',45,3000,10),
  ('manicure','pedicure-tradicional','Pedicure tradicional','Unhas',60,3500,20),
  ('nail-designer','alongamento-gel','Alongamento em gel','Unhas',150,15000,10),
  ('nail-designer','manutencao-alongamento','Manutenção de alongamento','Unhas',120,9000,20),
  ('lash-designer','extensao-cilios','Extensão de cílios','Cílios',120,13000,10),
  ('lash-designer','manutencao-cilios','Manutenção de cílios','Cílios',90,8000,20),
  ('designer-sobrancelhas','design-sobrancelhas','Design de sobrancelhas','Sobrancelhas',30,3500,10),
  ('designer-sobrancelhas','henna-sobrancelhas','Design com henna','Sobrancelhas',45,5000,20),
  ('estetica','limpeza-pele','Limpeza de pele','Estética',90,10000,10),
  ('estetica','drenagem-linfatica','Drenagem linfática','Estética',60,9000,20),
  ('maquiagem','maquiagem-social','Maquiagem social','Maquiagem',75,12000,10),
  ('maquiagem','maquiagem-noiva','Maquiagem para noiva','Maquiagem',120,25000,20),
  ('depilacao','depilacao-axilas','Depilação de axilas','Depilação',20,3000,10),
  ('depilacao','depilacao-pernas','Depilação de pernas','Depilação',45,6000,20),
  ('massoterapia','massagem-relaxante','Massagem relaxante','Massoterapia',60,10000,10),
  ('massoterapia','massagem-modeladora','Massagem modeladora','Massoterapia',60,11000,20),
  ('trancas','box-braids','Box braids','Tranças',300,30000,10),
  ('trancas','tranca-nago','Trança nagô','Tranças',180,18000,20),
  ('micropigmentacao','micro-sobrancelhas','Micropigmentação de sobrancelhas','Micropigmentação',150,40000,10),
  ('podologia','avaliacao-podologica','Avaliação podológica','Podologia',45,7000,10),
  ('podologia','tratamento-podologico','Tratamento podológico','Podologia',60,10000,20),
  ('barbeiro','corte-masculino','Corte masculino','Barbearia',45,3500,10),
  ('barbeiro','barba','Barba','Barbearia',30,2500,20),
  ('barbeiro','corte-barba','Corte e barba','Barbearia',60,5500,30),
  ('barbeiro','pezinho','Acabamento do corte','Barbearia',15,1500,40)
on conflict (specialty_id, service_key) do update set
  name = excluded.name, category = excluded.category,
  duration_minutes = excluded.duration_minutes, price_cents = excluded.price_cents,
  active = true, sort_order = excluded.sort_order;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-page-media', 'public-page-media', true, 5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members view own public media metadata"
on storage.objects for select to authenticated
using (
  bucket_id = 'public-page-media'
  and (storage.foldername(name))[1] = private.current_tenant_id()::text
);
create policy "managers upload own public media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'public-page-media'
  and (storage.foldername(name))[1] = private.current_tenant_id()::text
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers update own public media"
on storage.objects for update to authenticated
using (
  bucket_id = 'public-page-media'
  and (storage.foldername(name))[1] = private.current_tenant_id()::text
  and (select private.current_role()) in ('owner', 'admin')
)
with check (
  bucket_id = 'public-page-media'
  and (storage.foldername(name))[1] = private.current_tenant_id()::text
  and (select private.current_role()) in ('owner', 'admin')
);
create policy "managers delete own public media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'public-page-media'
  and (storage.foldername(name))[1] = private.current_tenant_id()::text
  and (select private.current_role()) in ('owner', 'admin')
);
