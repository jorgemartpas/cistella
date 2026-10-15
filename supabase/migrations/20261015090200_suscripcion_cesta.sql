-- Fase 3 · Suscripción (Stripe Billing) y cesta recurrente.

create type public.subscription_status as enum ('incompleta', 'activa', 'pausada', 'impagada', 'cancelada');
create type public.delivery_frequency as enum ('semanal', 'quincenal', 'mensual');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'incompleta',
  frequency public.delivery_frequency not null default 'semanal',
  -- Día de la semana ISO (1 = lunes … 7 = domingo)
  delivery_weekday smallint not null check (delivery_weekday between 1 and 7),
  -- Primer reparto de la cadencia: quincenal y mensual cuentan semanas desde aquí
  anchor_date date not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_payment_method_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anchor_matches_weekday check (extract(isodow from anchor_date) = delivery_weekday)
);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- El cliente solo cambia frecuencia y día; el estado y Stripe los gestiona el servidor.
create function public.guard_subscription_update() returns trigger
language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.customer_id is distinct from old.customer_id
     or new.status is distinct from old.status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.stripe_payment_method_id is distinct from old.stripe_payment_method_id
     or new.current_period_end is distinct from old.current_period_end
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end then
    raise exception 'No puedes cambiar ese dato de la suscripción' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger subscriptions_guard before update on public.subscriptions
  for each row execute function public.guard_subscription_update();

create table public.basket_items (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(8,3) not null check (quantity > 0 and quantity <= 100),
  updated_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);
create index basket_items_product_idx on public.basket_items (product_id);
create trigger basket_items_touch before update on public.basket_items
  for each row execute function public.touch_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;
alter table public.basket_items enable row level security;

create policy "cliente ve su suscripción" on public.subscriptions for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "cliente cambia frecuencia y día" on public.subscriptions for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "cliente ve su cesta" on public.basket_items for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "cliente añade a su cesta" on public.basket_items for insert
  with check (customer_id = auth.uid());
create policy "cliente cambia su cesta" on public.basket_items for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "cliente quita de su cesta" on public.basket_items for delete
  using (customer_id = auth.uid());

-- Altas y bajas de suscripción solo desde el servidor (checkout y webhook de Stripe)
revoke insert, delete on public.subscriptions from anon, authenticated;
revoke all on public.subscriptions, public.basket_items from anon;
