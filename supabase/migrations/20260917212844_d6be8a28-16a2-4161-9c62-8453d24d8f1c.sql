create or replace function public.professional_is_free(
  p_tenant_id uuid, p_professional_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  zone text;
  schedule jsonb;
  day jsonb;
  local_start timestamp;
  local_end timestamp;
  weekday_number text;
  weekday_name text;
  company_hours text;
  company_start time;
  company_end time;
begin
  if p_professional_id is null then return false; end if;

  select tenant.timezone into zone
  from public.tenants tenant
  where tenant.id = p_tenant_id;
  if zone is null then return false; end if;

  if exists (
    select 1 from public.professional_unavailability block
    where block.tenant_id = p_tenant_id
      and block.professional_id = p_professional_id
      and tstzrange(block.starts_at, block.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then return false; end if;

  if exists (
    select 1 from public.appointments appointment
    where appointment.tenant_id = p_tenant_id
      and appointment.professional_id = p_professional_id
      and appointment.status in ('scheduled', 'confirmed')
      and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then return false; end if;

  local_start := p_starts_at at time zone zone;
  local_end := p_ends_at at time zone zone;
  weekday_number := extract(dow from local_start)::integer::text;
  weekday_name := case extract(dow from local_start)::integer
    when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
    when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday'
    else 'saturday' end;

  select coalesce(professional.working_hours, '{}'::jsonb) into schedule
  from public.professionals professional
  where professional.id = p_professional_id
    and professional.tenant_id = p_tenant_id
    and professional.active;
  if not found then return false; end if;

  if schedule = '{}'::jsonb or coalesce((schedule ->> 'followCompany')::boolean, false) then
    select tenant.business_hours ->> weekday_name into company_hours
    from public.tenants tenant where tenant.id = p_tenant_id;
    if coalesce(company_hours, 'closed') = 'closed'
       or company_hours !~ '^([0-2][0-9]):[0-5][0-9]-([0-2][0-9]):[0-5][0-9]$' then
      return false;
    end if;
    company_start := split_part(company_hours, '-', 1)::time;
    company_end := split_part(company_hours, '-', 2)::time;
    return local_end::date = local_start::date
      and local_start::time >= company_start
      and local_end::time <= company_end;
  end if;

  day := coalesce(schedule -> weekday_number, schedule -> weekday_name);
  if day is null or coalesce((day ->> 'dayOff')::boolean, false) then return false; end if;
  if local_start::time < coalesce((day ->> 'startsAt')::time, time '00:00')
     or local_end::time > coalesce((day ->> 'endsAt')::time, time '23:59')
     or local_end::date <> local_start::date then return false; end if;
  if (day ->> 'breakStartsAt') is not null and (day ->> 'breakEndsAt') is not null
     and local_start::time < (day ->> 'breakEndsAt')::time
     and local_end::time > (day ->> 'breakStartsAt')::time then return false; end if;

  return true;
end;
$$;

revoke all on function public.professional_is_free(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.professional_is_free(uuid, uuid, timestamptz, timestamptz) to anon, authenticated, service_role;