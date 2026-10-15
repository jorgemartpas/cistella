-- Revisión de cambios de las tiendas (decisión del 15/10/2026): los cambios importantes de un
-- producto (crearlo, nombre, descripción, unidad, precio, foto o eliminarlo) los propone la tienda
-- y solo se aplican cuando el admin los acepta. «Disponible/Agotado» y el inventario siguen al momento.
--   · Carnicerías: sus propios productos
--   · Fruterías y pescaderías: el catálogo común de su tipo (afecta a todas las tiendas de ese tipo)

create type public.product_change_kind as enum ('crear', 'editar', 'eliminar');
create type public.product_change_status as enum ('pendiente', 'aprobado', 'rechazado');

create table public.product_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  requested_by uuid default auth.uid() references public.profiles(id) on delete set null,
  kind public.product_change_kind not null,
  -- Producto que se cambia o elimina; al crear, el que se crea al aceptarlo
  product_id uuid references public.products(id) on delete set null,
  category public.product_category not null,
  -- Cómo quedaría (crear y editar). image_url null al editar = sin foto nueva
  name text check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 200),
  unit public.product_unit,
  price_cents integer check (price_cents > 0 and price_cents <= 100000),
  image_url text,
  -- Cómo estaba al pedirlo (para enseñar el antes y el después)
  previous jsonb,
  status public.product_change_status not null default 'pendiente',
  review_note text check (char_length(review_note) <= 300),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'eliminar' or (name is not null and unit is not null and price_cents is not null))
);
create index product_changes_status_idx on public.product_changes (status, created_at);
create index product_changes_shop_idx on public.product_changes (shop_id, created_at desc);
-- Como mucho un cambio pendiente por tienda y producto (uno nuevo sustituye al anterior)
create unique index product_changes_one_pending_idx on public.product_changes (shop_id, product_id)
  where status = 'pendiente' and product_id is not null;

-- ¿Puede la tienda con sesión proponer cambios en esa categoría (y en ese producto)?
create function public.shop_can_propose(p_category public.product_category, p_product_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shops s
     where s.id = public.my_shop_id()
       and public.shop_type_for_category(p_category) = s.type
       and (p_product_id is null or exists (
         select 1 from public.products p
          where p.id = p_product_id
            and p.category = p_category
            and (p.shop_id = s.id or (p.shop_id is null and s.type <> 'carniceria'))
       ))
  )
$$;

alter table public.product_changes enable row level security;
create policy "tienda y admin ven los cambios" on public.product_changes for select
  using (public.is_admin() or shop_id = public.my_shop_id());
create policy "tienda propone cambios" on public.product_changes for insert
  with check (
    shop_id = public.my_shop_id()
    and requested_by = auth.uid()
    and status = 'pendiente'
    and reviewed_by is null and reviewed_at is null and review_note is null
    and (kind = 'crear') = (product_id is null)
    and public.shop_can_propose(category, product_id)
  );
create policy "tienda retira sus cambios pendientes" on public.product_changes for delete
  using (shop_id = public.my_shop_id() and status = 'pendiente');
revoke all on public.product_changes from anon;
revoke update on public.product_changes from authenticated;

-- ─── Las tiendas ya no cambian productos directamente ───────────────────────
drop policy "carniceria crea sus productos" on public.products;
drop policy "carniceria borra sus productos" on public.products;

-- Siguen pudiendo marcar sus productos como disponibles o agotados (solo esa columna)
create function public.guard_shop_product_update() returns trigger
language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.unit is distinct from old.unit
     or new.price_cents is distinct from old.price_cents
     or new.image_url is distinct from old.image_url
     or new.shop_id is distinct from old.shop_id then
    raise exception 'Los cambios en los productos los revisa el equipo de LaCistella' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger products_guard_shop_update before update on public.products
  for each row execute function public.guard_shop_product_update();

-- ─── Revisión (solo el admin) ───────────────────────────────────────────────
-- Acepta (y aplica) o rechaza un cambio pendiente. Devuelve el producto afectado.
create function public.review_product_change(p_change_id uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.product_changes;
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo de LaCistella revisa los cambios' using errcode = 'insufficient_privilege';
  end if;
  select * into c from public.product_changes where id = p_change_id for update;
  if not found then
    raise exception 'Ese cambio ya no existe';
  end if;
  if c.status <> 'pendiente' then
    raise exception 'Ese cambio ya está revisado';
  end if;
  target := c.product_id;

  if p_approve then
    if c.kind = 'crear' then
      insert into public.products (shop_id, category, name, description, unit, price_cents, image_url, active)
      values (case when c.category = 'carne' then c.shop_id end, c.category, c.name, c.description, c.unit,
              c.price_cents, c.image_url, true)
      returning id into target;
      -- En el catálogo común, la tienda que lo propone lo tiene; las demás lo marcarán si lo tienen
      if c.category <> 'carne' then
        insert into public.shop_availability (shop_id, product_id, available)
        values (c.shop_id, target, true)
        on conflict (shop_id, product_id) do update set available = true;
      end if;
    elsif c.kind = 'editar' then
      if target is null then
        raise exception 'El producto ya no existe';
      end if;
      update public.products
         set name = c.name, description = c.description, unit = c.unit, price_cents = c.price_cents,
             image_url = coalesce(c.image_url, image_url)
       where id = target;
    else
      if target is not null then
        delete from public.products where id = target;
      end if;
    end if;
  end if;

  update public.product_changes
     set status = case when p_approve then 'aprobado' else 'rechazado' end::public.product_change_status,
         review_note = nullif(trim(p_note), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         product_id = case when c.kind = 'eliminar' and p_approve then null else target end
   where id = c.id;
  return target;
end $$;
revoke all on function public.review_product_change(uuid, boolean, text) from public, anon;
grant execute on function public.review_product_change(uuid, boolean, text) to authenticated;
