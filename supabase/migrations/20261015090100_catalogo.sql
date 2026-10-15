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
