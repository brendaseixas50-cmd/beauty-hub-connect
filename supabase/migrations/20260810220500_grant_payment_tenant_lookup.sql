-- Checkout resolves the public company slug on the trusted backend before it
-- reads encrypted provider credentials. No tenant mutation is required here.
grant select (id, slug, status) on public.tenants to service_role;
