create index if not exists tenant_specialties_specialty_id_idx
  on public.tenant_specialties (specialty_id);

do $$
declare
  function_body text;
  validation_start integer;
  validation_end integer;
  start_marker constant text := '    or (normalized_email is not null and ';
  end_marker constant text := E'\n    or char_length(coalesce(p_notes, '''')) > 500';
begin
  select procedure.prosrc
  into function_body
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_public_booking'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_slug text, p_service_id uuid, p_professional_id uuid, p_starts_at timestamp with time zone, p_customer_name text, p_customer_phone text, p_customer_email text, p_notes text, p_request_id uuid, p_fingerprint text, p_honeypot text';

  if function_body is null then
    raise exception 'create_public_booking function was not found';
  end if;

  validation_start := strpos(function_body, start_marker);
  validation_end := strpos(function_body, end_marker);
  if validation_start = 0 or validation_end <= validation_start then
    raise exception 'email validation block was not found';
  end if;

  function_body :=
    left(function_body, validation_start - 1)
    || '    or (normalized_email is not null and ('
    || 'position(''@'' in normalized_email) <= 1 '
    || 'or position(''.'' in split_part(normalized_email, ''@'', 2)) <= 1))'
    || substring(function_body from validation_end);

  execute
    'create or replace function public.create_public_booking('
    || 'p_slug text, p_service_id uuid, p_professional_id uuid, p_starts_at timestamptz, '
    || 'p_customer_name text, p_customer_phone text, p_customer_email text, p_notes text, '
    || 'p_request_id uuid, p_fingerprint text, p_honeypot text default '''') '
    || 'returns jsonb language plpgsql security definer set search_path = '''' as '
    || quote_literal(function_body);
end;
$$;

revoke all on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, text, text, text, uuid, text, text
) from public;
grant execute on function public.create_public_booking(
  text, uuid, uuid, timestamptz, text, text, text, text, uuid, text, text
) to anon, authenticated;
