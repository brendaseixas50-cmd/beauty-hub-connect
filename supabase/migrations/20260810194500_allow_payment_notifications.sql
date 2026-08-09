alter table public.notification_outbox
  drop constraint if exists notification_outbox_event_type_check;

alter table public.notification_outbox
  add constraint notification_outbox_event_type_check
  check (event_type in (
    'booking_created',
    'booking_confirmed',
    'booking_cancelled',
    'marketing_message',
    'store_order_created',
    'payment_approved'
  ));
