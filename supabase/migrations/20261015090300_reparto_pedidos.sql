-- Fase 4 · Días de reparto, rotación de tiendas y pedidos.

create type public.delivery_day_status as enum ('abierto', 'cerrado', 'cancelado');
create type public.order_status as enum ('pendiente', 'preparado', 'en_reparto', 'entregado', 'no_entregado', 'cancelado');
create type public.shop_order_status as enum ('pendiente', 'preparado', 'recogido');
create type public.payment_status as enum ('pendiente', 'pagado', 'fallido', 'sin_cobro');

-- ─── Calendario semanal de reparto (lo configura el admin) ──────────────────
create table public.delivery_schedule (
  weekday smallint primary key check (weekday between 1 and 7),
  active boolean not null default true,
  -- El cierre es N días antes del reparto a esta hora (hora de Madrid)
  cutoff_days_before smallint not null default 1 check (cutoff_days_before between 0 and 6),
  cutoff_time time not null default '20:00'
);

-- ─── Días de reparto concretos, con la tienda de turno de cada tipo ─────────
create table public.delivery_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  cutoff_at timestamptz not null,
  fruteria_id uuid references public.shops(id) on delete set null,
  pescaderia_id uuid references public.shops(id) on delete set null,
  status public.delivery_day_status not null default 'abierto',
  orders_generated_at timestamptz,
  generation_report jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create function public.validate_delivery_day() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.fruteria_id is not null and not exists (
    select 1 from public.shops where id = new.fruteria_id and type = 'fruteria'
  ) then
    raise exception 'La tienda de turno de fruta tiene que ser una frutería' using errcode = 'check_violation';
  end if;
  if new.pescaderia_id is not null and not exists (
    select 1 from public.shops where id = new.pescaderia_id and type = 'pescaderia'
  ) then
    raise exception 'La tienda de turno de pescado tiene que ser una pescadería' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger delivery_days_validate before insert or update on public.delivery_days
  for each row execute function public.validate_delivery_day();

-- ─── Pedidos ────────────────────────────────────────────────────────────────
-- Un pedido por cliente y reparto. Guarda una copia de los datos de entrega para
-- que el historial no cambie si el cliente edita su perfil.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  delivery_day_id uuid not null references public.delivery_days(id),
  status public.order_status not null default 'pendiente',
  customer_name text not null,
  phone text,
  address text not null,
  postal_code text,
  estimated_total_cents integer not null check (estimated_total_cents >= 0),
  final_total_cents integer check (final_total_cents >= 0),
  payment_status public.payment_status not null default 'pendiente',
  stripe_payment_intent_id text,
  payment_error text,
  skipped_items jsonb not null default '[]',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, delivery_day_id)
);
create index orders_day_idx on public.orders (delivery_day_id);

-- La parte del pedido que prepara cada tienda. La tienda solo ve el nombre del
-- cliente, nunca su dirección ni su teléfono.
create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id),
  delivery_day_id uuid not null references public.delivery_days(id),
  customer_label text not null,
  status public.shop_order_status not null default 'pendiente',
  prepared_at timestamptz,
  picked_up_at timestamptz,
  unique (order_id, shop_id)
);
create index shop_orders_shop_day_idx on public.shop_orders (shop_id, delivery_day_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  shop_order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit public.product_unit not null,
  quantity_ordered numeric(8,3) not null check (quantity_ordered > 0),
  quantity_actual numeric(8,3) check (quantity_actual >= 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);
create index order_items_shop_order_idx on public.order_items (shop_order_id);

-- La tienda solo puede pasar su parte entre pendiente y preparado; recoger es cosa del reparto.
create function public.guard_shop_order_update() returns trigger
language plpgsql as $$
begin
  if not public.is_privileged() then
    if new.order_id is distinct from old.order_id
       or new.shop_id is distinct from old.shop_id
       or new.delivery_day_id is distinct from old.delivery_day_id
       or new.customer_label is distinct from old.customer_label
       or new.picked_up_at is distinct from old.picked_up_at then
      raise exception 'Solo puedes cambiar el estado del pedido' using errcode = 'insufficient_privilege';
    end if;
    if old.status = 'recogido' or new.status = 'recogido' then
      raise exception 'Este pedido ya lo ha recogido el reparto' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.status is distinct from old.status then
    new.prepared_at := case
      when new.status = 'pendiente' then null
      else coalesce(old.prepared_at, now())
    end;
    new.picked_up_at := case when new.status = 'recogido' then coalesce(old.picked_up_at, now()) end;
  end if;
  return new;
end $$;
create trigger shop_orders_guard before update on public.shop_orders
  for each row execute function public.guard_shop_order_update();

-- La tienda solo indica la cantidad real, y solo antes de que se recoja.
create function public.guard_order_item_update() returns trigger
language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.shop_order_id is distinct from old.shop_order_id
     or new.product_id is distinct from old.product_id
     or new.product_name is distinct from old.product_name
     or new.unit is distinct from old.unit
     or new.quantity_ordered is distinct from old.quantity_ordered
     or new.unit_price_cents is distinct from old.unit_price_cents then
    raise exception 'Solo puedes indicar la cantidad real' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.shop_orders where id = new.shop_order_id and status = 'recogido') then
    raise exception 'Este pedido ya lo ha recogido el reparto' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger order_items_guard before update on public.order_items
  for each row execute function public.guard_order_item_update();

-- El estado del pedido del cliente sigue al de sus partes por tienda
create function public.sync_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
  prepared integer;
  picked integer;
begin
  select count(*),
         count(*) filter (where status in ('preparado', 'recogido')),
         count(*) filter (where status = 'recogido')
    into total, prepared, picked
    from public.shop_orders
   where order_id = new.order_id;

  update public.orders
     set status = case
       when picked = total then 'en_reparto'::public.order_status
       when prepared = total then 'preparado'::public.order_status
       else 'pendiente'::public.order_status
     end
   where id = new.order_id
     and status in ('pendiente', 'preparado', 'en_reparto');
  return null;
end $$;
create trigger shop_orders_sync_order after update of status on public.shop_orders
  for each row execute function public.sync_order_status();

-- ─── Generación atómica de pedidos ──────────────────────────────────────────
-- El reparto lo planifica el servidor (src/lib/domain/orders.ts, con tests) y esta
-- función lo guarda todo en una transacción. Es idempotente: si el día ya tiene
-- pedidos generados no hace nada.
create function public.create_orders_for_day(p_day_id uuid, p_orders jsonb, p_report jsonb)
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
      estimated_total_cents, skipped_items
    ) values (
      (o ->> 'customer_id')::uuid, p_day_id, o ->> 'customer_name', o ->> 'phone',
      o ->> 'address', o ->> 'postal_code', (o ->> 'estimated_total_cents')::integer,
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

-- Productos del catálogo unificado que la tienda de turno de ese día no tiene.
-- Los clientes no pueden leer shop_availability; esto solo expone los ids.
create function public.unavailable_on_day(p_day_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
    from public.products p
    join public.delivery_days d on d.id = p_day_id
   where p.shop_id is null
     and p.active
     and not exists (
       select 1 from public.shop_availability a
        where a.product_id = p.id
          and a.available
          and a.shop_id = case when p.category = 'pescado' then d.pescaderia_id else d.fruteria_id end
     )
$$;
revoke execute on function public.unavailable_on_day(uuid) from public, anon;
grant execute on function public.unavailable_on_day(uuid) to authenticated, service_role;

-- ─── Ventas por tienda (para la comisión) ───────────────────────────────────
-- Cuenta como vendido lo que el reparto ha recogido en la tienda, con la cantidad real.
create view public.shop_sales with (security_invoker = true) as
select so.shop_id,
       so.id as shop_order_id,
       dd.date as delivery_date,
       sum(round(coalesce(oi.quantity_actual, oi.quantity_ordered) * oi.unit_price_cents))::bigint as total_cents
  from public.shop_orders so
  join public.delivery_days dd on dd.id = so.delivery_day_id
  join public.order_items oi on oi.shop_order_id = so.id
 where so.status = 'recogido'
 group by so.shop_id, so.id, dd.date;

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.delivery_schedule enable row level security;
alter table public.delivery_days enable row level security;
alter table public.orders enable row level security;
alter table public.shop_orders enable row level security;
alter table public.order_items enable row level security;

create policy "calendario visible" on public.delivery_schedule for select using (true);
create policy "admin gestiona calendario" on public.delivery_schedule for all
  using (public.is_admin()) with check (public.is_admin());

create policy "dias visibles" on public.delivery_days for select to authenticated using (true);
create policy "admin gestiona dias" on public.delivery_days for all
  using (public.is_admin()) with check (public.is_admin());

create policy "cliente ve sus pedidos" on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "admin gestiona pedidos" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

create policy "ver partes de pedido" on public.shop_orders for select
  using (
    public.is_admin()
    or shop_id = public.my_shop_id()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );
create policy "tienda prepara su parte" on public.shop_orders for update
  using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());
create policy "admin gestiona partes" on public.shop_orders for update
  using (public.is_admin()) with check (public.is_admin());

create policy "ver lineas de pedido" on public.order_items for select
  using (
    exists (
      select 1 from public.shop_orders so
      where so.id = shop_order_id
        and (
          public.is_admin()
          or so.shop_id = public.my_shop_id()
          or exists (select 1 from public.orders o where o.id = so.order_id and o.customer_id = auth.uid())
        )
    )
  );
create policy "tienda indica cantidad real" on public.order_items for update
  using (exists (select 1 from public.shop_orders so where so.id = shop_order_id and so.shop_id = public.my_shop_id()));
create policy "admin gestiona lineas" on public.order_items for update
  using (public.is_admin()) with check (public.is_admin());

-- Los pedidos solo se crean con create_orders_for_day
revoke insert, delete on public.orders, public.shop_orders, public.order_items from anon, authenticated;
revoke all on public.orders, public.shop_orders, public.order_items, public.delivery_days from anon;
revoke insert, update, delete on public.delivery_schedule from anon;
revoke all on public.shop_sales from anon;
