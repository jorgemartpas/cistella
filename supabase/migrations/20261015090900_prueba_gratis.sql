-- Prueba gratis (decisión del 15/10/2026): en los planes con cuota, no se cobra la cuota durante
-- las 2 primeras semanas o hasta que se preparan los 2 primeros pedidos (lo que llegue antes).
-- Después se cobra sola cada mes. Una sola prueba por cliente; el pago por envío no tiene prueba.

alter table public.subscriptions
  add column trial_started_at timestamptz,
  add column trial_ends_at timestamptz;

-- La prueba la gestiona el servidor (con Stripe): el cliente no puede cambiar sus fechas
create or replace function public.guard_subscription_update() returns trigger
language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.customer_id is distinct from old.customer_id
     or new.status is distinct from old.status
     or new.frequency is distinct from old.frequency
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.stripe_payment_method_id is distinct from old.stripe_payment_method_id
     or new.current_period_end is distinct from old.current_period_end
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end
     or new.trial_started_at is distinct from old.trial_started_at
     or new.trial_ends_at is distinct from old.trial_ends_at then
    raise exception 'No puedes cambiar ese dato de la suscripción' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
