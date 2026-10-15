-- Planes y precios (decisión del 15/10/2026):
--   · 2 veces por semana: 25 €/mes, con una cesta distinta para cada día de reparto
--   · Cada semana: 20 €/mes
--   · Cada 2 semanas: 16 €/mes
--   · Pago por envío: sin cuota; el cliente pide los repartos sueltos que quiere y paga 6 € por cada uno
-- «Cada 4 semanas» deja de ofrecerse.
-- Nota: los valores nuevos del enum no se usan en este archivo, para que pueda ejecutarse en una sola transacción.

alter type public.delivery_frequency add value if not exists 'dos_por_semana';
alter type public.delivery_frequency add value if not exists 'por_envio';

update public.subscriptions set frequency = 'quincenal' where frequency = 'mensual';

-- ─── Precios por plan y gastos de envío ─────────────────────────────────────
alter table public.settings
  add column price_dos_por_semana_cents integer not null default 2500 check (price_dos_por_semana_cents >= 0),
  add column price_semanal_cents integer not null default 2000 check (price_semanal_cents >= 0),
  add column price_quincenal_cents integer not null default 1600 check (price_quincenal_cents >= 0),
  add column delivery_fee_cents integer not null default 600 check (delivery_fee_cents >= 0);
alter table public.settings drop column subscription_price_cents;

-- ─── Cesta por día ──────────────────────────────────────────────────────────
-- slot 0 = la cesta única; 1–7 = la cesta de ese día de la semana (plan de 2 veces por semana)
alter table public.basket_items add column slot smallint not null default 0 check (slot between 0 and 7);
alter table public.basket_items drop constraint basket_items_pkey;
alter table public.basket_items add primary key (customer_id, slot, product_id);

-- ─── Gastos de envío en el pedido ───────────────────────────────────────────
alter table public.orders add column delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0);

-- ─── Repartos sueltos pedidos (plan de pago por envío) ──────────────────────
create table public.delivery_requests (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  delivery_day_id uuid not null references public.delivery_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, delivery_day_id)
);
create index delivery_requests_day_idx on public.delivery_requests (delivery_day_id);

alter table public.delivery_requests enable row level security;

create function public.delivery_day_is_open(p_day_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.delivery_days
     where id = p_day_id and status = 'abierto' and cutoff_at > now()
  )
$$;

create policy "cliente ve sus repartos pedidos" on public.delivery_requests for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "cliente pide un reparto abierto" on public.delivery_requests for insert
  with check (customer_id = auth.uid() and public.delivery_day_is_open(delivery_day_id));
create policy "cliente anula un reparto abierto" on public.delivery_requests for delete
  using (customer_id = auth.uid() and public.delivery_day_is_open(delivery_day_id));

revoke all on public.delivery_requests from anon;
revoke update on public.delivery_requests from authenticated;

-- ─── El plan solo lo cambia el servidor (cada plan tiene su precio) ─────────
-- El cliente puede cambiar por su cuenta el día de reparto, pero no la frecuencia.
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
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end then
    raise exception 'No puedes cambiar ese dato de la suscripción' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- ─── Generación de pedidos con gastos de envío ──────────────────────────────
create or replace function public.create_orders_for_day(p_day_id uuid, p_orders jsonb, p_report jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  day_row public.delivery_days;
  o jsonb;
  s jsonb;
  i jsonb;
  new_order_id uuid;
  new_shop_order_id uuid;
  created integer := 0;
begin
  select * into day_row from public.delivery_days where id = p_day_id for update;
  if not found then
    raise exception 'No existe el día de reparto %', p_day_id;
  end if;
  if day_row.orders_generated_at is not null or day_row.status <> 'abierto' then
    return 0;
  end if;

  for o in select * from jsonb_array_elements(p_orders) loop
    insert into public.orders (
      customer_id, delivery_day_id, customer_name, phone, address, postal_code,
      estimated_total_cents, delivery_fee_cents, skipped_items
    ) values (
      (o ->> 'customer_id')::uuid, p_day_id, o ->> 'customer_name', o ->> 'phone',
      o ->> 'address', o ->> 'postal_code', (o ->> 'estimated_total_cents')::integer,
      coalesce((o ->> 'delivery_fee_cents')::integer, 0),
      coalesce(o -> 'skipped_items', '[]'::jsonb)
    ) returning id into new_order_id;

    for s in select * from jsonb_array_elements(o -> 'shops') loop
      insert into public.shop_orders (order_id, shop_id, delivery_day_id, customer_label)
      values (new_order_id, (s ->> 'shop_id')::uuid, p_day_id, o ->> 'customer_name')
      returning id into new_shop_order_id;

      for i in select * from jsonb_array_elements(s -> 'items') loop
        insert into public.order_items (
          shop_order_id, product_id, product_name, unit, quantity_ordered, unit_price_cents
        ) values (
          new_shop_order_id, (i ->> 'product_id')::uuid, i ->> 'product_name',
          (i ->> 'unit')::public.product_unit, (i ->> 'quantity')::numeric,
          (i ->> 'unit_price_cents')::integer
        );
      end loop;
    end loop;
    created := created + 1;
  end loop;

  update public.delivery_days
     set status = 'cerrado', orders_generated_at = now(), generation_report = p_report
   where id = p_day_id;
  return created;
end $$;
revoke execute on function public.create_orders_for_day(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_orders_for_day(uuid, jsonb, jsonb) to service_role;
