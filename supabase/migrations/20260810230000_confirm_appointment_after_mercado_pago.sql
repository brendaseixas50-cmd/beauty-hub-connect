create or replace function private.confirm_appointment_after_mercado_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'mercado_pago'
    and new.entity_type = 'appointment'
    and new.status = 'approved'
    and old.status is distinct from 'approved'
  then
    update public.appointments
    set status = 'confirmed', updated_at = now()
    where id = new.entity_id
      and tenant_id = new.tenant_id
      and status = 'scheduled';
  end if;
  return new;
end;
$$;

drop trigger if exists confirm_appointment_after_mercado_pago
on public.payment_provider_transactions;

create trigger confirm_appointment_after_mercado_pago
after update of status on public.payment_provider_transactions
for each row execute function private.confirm_appointment_after_mercado_pago();

comment on function private.confirm_appointment_after_mercado_pago() is
  'Confirms the tenant appointment once its Mercado Pago charge is approved.';
