-- Cistella: instalación completa de la base de datos (proyecto de Supabase nuevo).
-- Archivo generado con `npm run sql:instalacion`; no lo edites a mano.
-- Pégalo entero en Supabase → SQL Editor y pulsa Run. Solo se ejecuta una vez.

-- ════════ supabase/migrations/20261015090000_base.sql ════════

-- Fase 1 · Base: perfiles enlazados a Supabase Auth, roles, tiendas y ajustes generales.

create type public.user_role as enum ('cliente', 'tienda', 'admin');
create type public.shop_type as enum ('carniceria', 'pescaderia', 'fruteria');

-- Utilidad: mantener updated_at al día
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Ajustes generales (una sola fila) ──────────────────────────────────────
create table public.settings (
  id boolean primary key default true check (id),
  subscription_price_cents integer not null default 2000 check (subscription_price_cents >= 0),
  allowed_postal_codes text[] not null default '{46600}',
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  default_commission_pct numeric(5,2) not null default 10 check (default_commission_pct between 0 and 100),
  weeks_ahead smallint not null default 4 check (weeks_ahead between 1 and 12),
  updated_at timestamptz not null default now()
);
insert into public.settings default values;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ─── Tiendas ────────────────────────────────────────────────────────────────
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type public.shop_type not null,
  active boolean not null default true,
  commission_pct numeric(5,2) not null default 10 check (commission_pct between 0 and 100),
  rotation_order integer not null default 0,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();

-- ─── Perfiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'cliente',
  email text,
  full_name text not null default '',
  phone text,
  address text,
  postal_code text,
  shop_id uuid unique references public.shops(id) on delete set null,
  accepted_privacy_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_shop_matches_role check ((role = 'tienda') = (shop_id is not null))
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Funciones de rol para las políticas RLS. Son security definer para poder leer
-- profiles sin entrar en recursión con sus propias políticas.
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_shop_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select shop_id from public.profiles where id = auth.uid() and role = 'tienda'
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- Llamadas del sistema (service role, cron, webhooks) o de un admin
create function public.is_privileged() returns boolean
language sql stable as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin') or public.is_admin()
$$;

-- El CP del cliente tiene que estar en la zona de reparto
create function public.validate_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  allowed text[];
begin
  if new.role = 'cliente' and new.postal_code is not null then
    select allowed_postal_codes into allowed from public.settings;
    if not (trim(new.postal_code) = any(allowed)) then
      raise exception 'De momento solo repartimos en Alzira (CP %).', array_to_string(allowed, ', ')
        using errcode = 'check_violation';
    end if;
    new.postal_code := trim(new.postal_code);
  end if;
  return new;
end $$;
create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.validate_profile();

-- Cada usuario nuevo de Auth recibe un perfil de cliente. Las cuentas de tienda y
-- admin se promocionan después desde el servidor (nunca desde los metadatos).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, phone, accepted_privacy_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when (new.raw_user_meta_data ->> 'accepted_privacy') = 'true' then now() end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.settings enable row level security;
alter table public.shops enable row level security;
alter table public.profiles enable row level security;

create policy "ajustes visibles" on public.settings for select using (true);
create policy "admin edita ajustes" on public.settings for update
  using (public.is_admin()) with check (public.is_admin());

-- Las tiendas son información pública (el catálogo de carne muestra su nombre)
create policy "tiendas visibles" on public.shops for select using (true);
create policy "admin crea tiendas" on public.shops for insert with check (public.is_admin());
create policy "admin edita tiendas" on public.shops for update
  using (public.is_admin()) with check (public.is_admin());

create policy "cada uno ve su perfil" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "cada uno edita su perfil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- El usuario solo puede tocar sus datos de contacto; rol, tienda y email no.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, address, postal_code, accepted_privacy_at) on public.profiles to authenticated;
revoke insert, update, delete on public.settings from anon;
revoke insert, update, delete on public.shops from anon;
revoke delete on public.shops, public.settings from authenticated;

-- ════════ supabase/migrations/20261015090100_catalogo.sql ════════

-- Fase 2 · Catálogo: productos de carnicería, catálogo unificado y disponibilidad por tienda.

create type public.product_category as enum ('carne', 'fruta', 'verdura', 'pescado');
create type public.product_unit as enum ('kg', 'unidad', 'bandeja');

-- Qué tipo de tienda sirve cada categoría. La verdura la sirven las fruterías.
create function public.shop_type_for_category(c public.product_category) returns public.shop_type
language sql immutable as $$
  select case c
    when 'carne' then 'carniceria'::public.shop_type
    when 'pescado' then 'pescaderia'::public.shop_type
    else 'fruteria'::public.shop_type
  end
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  category public.product_category not null,
  name text not null check (length(trim(name)) > 0),
  description text,
  image_url text,
  price_cents integer not null check (price_cents > 0),
  unit public.product_unit not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- La carne pertenece a una carnicería; fruta, verdura y pescado van sin tienda
  constraint product_shop_by_category check ((category = 'carne') = (shop_id is not null))
);
create index products_shop_idx on public.products (shop_id);
create index products_category_idx on public.products (category) where active;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Un producto de carne solo puede pertenecer a una carnicería
create function public.validate_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.shop_id is not null and not exists (
    select 1 from public.shops where id = new.shop_id and type = 'carniceria'
  ) then
    raise exception 'Los productos con tienda tienen que ser de una carnicería'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger products_validate before insert or update on public.products
  for each row execute function public.validate_product();

-- Disponibilidad del catálogo unificado: si no hay fila, la tienda no lo tiene.
create table public.shop_availability (
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (shop_id, product_id)
);
create index shop_availability_product_idx on public.shop_availability (product_id);
create trigger shop_availability_touch before update on public.shop_availability
  for each row execute function public.touch_updated_at();

create function public.validate_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.products p
    join public.shops s on s.id = new.shop_id
    where p.id = new.product_id
      and p.shop_id is null
      and s.type = public.shop_type_for_category(p.category)
  ) then
    raise exception 'Esta tienda no sirve ese producto'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger shop_availability_validate before insert or update on public.shop_availability
  for each row execute function public.validate_availability();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.products enable row level security;
alter table public.shop_availability enable row level security;

-- Catálogo público: productos activos. La tienda ve también los suyos inactivos.
create policy "catalogo visible" on public.products for select
  using (active or public.is_admin() or (shop_id is not null and shop_id = public.my_shop_id()));

create policy "admin gestiona productos" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy "carniceria crea sus productos" on public.products for insert
  with check (shop_id = public.my_shop_id() and category = 'carne');
create policy "carniceria edita sus productos" on public.products for update
  using (shop_id = public.my_shop_id())
  with check (shop_id = public.my_shop_id() and category = 'carne');
create policy "carniceria borra sus productos" on public.products for delete
  using (shop_id = public.my_shop_id());

create policy "disponibilidad visible para su tienda" on public.shop_availability for select
  using (public.is_admin() or shop_id = public.my_shop_id());
create policy "admin gestiona disponibilidad" on public.shop_availability for all
  using (public.is_admin()) with check (public.is_admin());
create policy "tienda marca su disponibilidad" on public.shop_availability for insert
  with check (shop_id = public.my_shop_id());
create policy "tienda cambia su disponibilidad" on public.shop_availability for update
  using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());

revoke insert, update, delete on public.products, public.shop_availability from anon;
revoke select on public.shop_availability from anon;

-- ─── Fotos de producto ──────────────────────────────────────────────────────
-- Bucket público de lectura; las subidas se hacen desde el servidor tras comprobar el rol.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ════════ supabase/migrations/20261015090200_suscripcion_cesta.sql ════════

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

-- ════════ supabase/migrations/20261015090300_reparto_pedidos.sql ════════

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

-- ════════ supabase/migrations/20261015090400_cobros.sql ════════

-- Fase 5 · Cobro de cada pedido con el peso real al entregarlo.
-- 'procesando' bloquea el pedido mientras se cobra, para que dos clics no cobren dos veces.
alter type public.payment_status add value if not exists 'procesando' after 'pendiente';

alter table public.orders add column payment_attempts integer not null default 0;

-- ════════ supabase/migrations/20261015090500_planes.sql ════════

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

-- ════════ supabase/migrations/20261015090600_listas_guardadas.sql ════════

-- Listas y cestas guardadas del cliente (decisión del 15/10/2026):
--   · lista: productos que quiere tener a mano para añadirlos a su cesta cuando quiera
--   · cesta: una cesta completa, con sus cantidades, para volver a usarla de golpe
create table public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lista', 'cesta')),
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_lists_customer_idx on public.saved_lists (customer_id, kind);

-- En las listas la cantidad es opcional; en las cestas guardadas va siempre
create table public.saved_list_items (
  list_id uuid not null references public.saved_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(8,3) check (quantity is null or (quantity > 0 and quantity <= 100)),
  created_at timestamptz not null default now(),
  primary key (list_id, product_id)
);

alter table public.saved_lists enable row level security;
alter table public.saved_list_items enable row level security;

create policy "cliente gestiona sus listas" on public.saved_lists for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "cliente gestiona lo que hay en sus listas" on public.saved_list_items for all
  using (exists (select 1 from public.saved_lists l where l.id = list_id and l.customer_id = auth.uid()))
  with check (exists (select 1 from public.saved_lists l where l.id = list_id and l.customer_id = auth.uid()));

revoke all on public.saved_lists, public.saved_list_items from anon;

-- ════════ supabase/seed.sql ════════

-- Datos de ejemplo del piloto: 6 tiendas (2 de cada tipo), catálogo y calendario.
-- Precios orientativos con IVA incluido. Los usuarios de prueba se crean con
-- `npm run seed:users` porque necesitan pasar por Supabase Auth.

-- Calendario por defecto: martes y viernes, cierre a las 20:00 del día anterior
insert into public.delivery_schedule (weekday, active, cutoff_days_before, cutoff_time) values
  (2, true, 1, '20:00'),
  (5, true, 1, '20:00')
on conflict (weekday) do update set active = excluded.active,
  cutoff_days_before = excluded.cutoff_days_before, cutoff_time = excluded.cutoff_time;

insert into public.shops (id, name, type, rotation_order, commission_pct, phone, address) values
  ('11111111-1111-4111-8111-000000000001', 'Oskiñez', 'carniceria', 1, 10, null, 'Alzira'),
  ('11111111-1111-4111-8111-000000000002', 'Carnicería Reino', 'carniceria', 2, 10, null, 'Alzira'),
  ('11111111-1111-4111-8111-000000000003', 'Pescados Miguel Ferrer', 'pescaderia', 1, 10, null, 'Alzira'),
  ('11111111-1111-4111-8111-000000000004', 'Pescados Tomás', 'pescaderia', 2, 10, null, 'Alzira'),
  ('11111111-1111-4111-8111-000000000005', 'Frutería A (por concretar)', 'fruteria', 1, 10, null, 'Alzira'),
  ('11111111-1111-4111-8111-000000000006', 'Frutería B (por concretar)', 'fruteria', 2, 10, null, 'Alzira')
on conflict (id) do nothing;

-- ─── Carne: cada producto es de su carnicería ───────────────────────────────
insert into public.products (shop_id, category, name, description, price_cents, unit) values
  ('11111111-1111-4111-8111-000000000001', 'carne', 'Hamburguesas de ternera caseras', 'Bandeja de 4 unidades', 650, 'bandeja'),
  ('11111111-1111-4111-8111-000000000001', 'carne', 'Longaniza fresca', null, 990, 'kg'),
  ('11111111-1111-4111-8111-000000000001', 'carne', 'Pechuga de pollo fileteada', null, 895, 'kg'),
  ('11111111-1111-4111-8111-000000000001', 'carne', 'Chuletas de cordero', null, 1850, 'kg'),
  ('11111111-1111-4111-8111-000000000001', 'carne', 'Chorizo casero', 'Embutido de la casa', 1490, 'kg'),
  ('11111111-1111-4111-8111-000000000002', 'carne', 'Hamburguesas de pollo y queso', 'Bandeja de 4 unidades', 590, 'bandeja'),
  ('11111111-1111-4111-8111-000000000002', 'carne', 'Lomo de cerdo', null, 950, 'kg'),
  ('11111111-1111-4111-8111-000000000002', 'carne', 'Entrecot de ternera', null, 2690, 'kg'),
  ('11111111-1111-4111-8111-000000000002', 'carne', 'Conejo troceado', null, 1090, 'kg'),
  ('11111111-1111-4111-8111-000000000002', 'carne', 'Butifarra', 'Embutido de la casa', 920, 'kg');

-- ─── Catálogo unificado (sin tienda) ────────────────────────────────────────
insert into public.products (category, name, description, price_cents, unit) values
  ('fruta', 'Naranjas de zumo', 'De la Ribera', 160, 'kg'),
  ('fruta', 'Mandarinas clemenules', null, 220, 'kg'),
  ('fruta', 'Kakis de la Ribera', null, 250, 'kg'),
  ('fruta', 'Manzana fuji', null, 260, 'kg'),
  ('fruta', 'Plátano de Canarias', null, 290, 'kg'),
  ('fruta', 'Pera conferencia', null, 240, 'kg'),
  ('fruta', 'Uva moscatel', null, 320, 'kg'),
  ('verdura', 'Tomate valenciano', null, 340, 'kg'),
  ('verdura', 'Lechuga romana', null, 110, 'unidad'),
  ('verdura', 'Cebolla', null, 150, 'kg'),
  ('verdura', 'Patata', null, 140, 'kg'),
  ('verdura', 'Pimiento rojo', null, 290, 'kg'),
  ('verdura', 'Calabacín', null, 210, 'kg'),
  ('verdura', 'Alcachofas', null, 350, 'kg'),
  ('verdura', 'Ajos tiernos', 'Manojo', 180, 'unidad'),
  ('pescado', 'Merluza', 'Limpia, en rodajas', 1490, 'kg'),
  ('pescado', 'Dorada', null, 1150, 'kg'),
  ('pescado', 'Lubina', null, 1290, 'kg'),
  ('pescado', 'Sepia', null, 1390, 'kg'),
  ('pescado', 'Boquerones', null, 890, 'kg'),
  ('pescado', 'Salmón', 'Lomos', 1690, 'kg'),
  ('pescado', 'Mejillones', null, 450, 'kg'),
  ('pescado', 'Gambas', null, 2290, 'kg');

-- Disponibilidad: cada tienda tiene casi todo; algunas excepciones para ver la regla
insert into public.shop_availability (shop_id, product_id, available)
select s.id, p.id,
       not (
         (s.id = '11111111-1111-4111-8111-000000000006' and p.name = 'Uva moscatel')
         or (s.id = '11111111-1111-4111-8111-000000000003' and p.name = 'Gambas')
       )
  from public.shops s
  join public.products p
    on p.shop_id is null and s.type = public.shop_type_for_category(p.category)
on conflict do nothing;
