-- Inventario de cada tienda (decisión del 15/10/2026): cuánto tiene disponible de cada producto,
-- en su unidad (kg, unidades o bandejas). Solo lo ven la tienda y el admin. Sirve para avisar si
-- lo pedido para el próximo reparto no llega (con un margen en kg, en Ajustes); no limita pedidos.
-- Al marcar una parte del pedido como preparada se resta lo servido (con el peso real).

create table public.shop_inventory (
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(10,3) not null check (quantity >= 0 and quantity <= 100000),
  updated_at timestamptz not null default now(),
  primary key (shop_id, product_id)
);
create index shop_inventory_product_idx on public.shop_inventory (product_id);
create trigger shop_inventory_touch before update on public.shop_inventory
  for each row execute function public.touch_updated_at();

alter table public.shop_inventory enable row level security;
create policy "inventario de su tienda" on public.shop_inventory for select
  using (public.is_admin() or shop_id = public.my_shop_id());
create policy "tienda o admin apuntan inventario" on public.shop_inventory for insert
  with check (public.is_admin() or shop_id = public.my_shop_id());
create policy "tienda o admin cambian inventario" on public.shop_inventory for update
  using (public.is_admin() or shop_id = public.my_shop_id())
  with check (public.is_admin() or shop_id = public.my_shop_id());
create policy "tienda o admin quitan inventario" on public.shop_inventory for delete
  using (public.is_admin() or shop_id = public.my_shop_id());
revoke all on public.shop_inventory from anon;

-- Margen: kilos por encima del inventario que se aceptan sin avisar en rojo (lo que va al peso)
alter table public.settings
  add column inventory_margin_kg numeric(6,2) not null default 5 check (inventory_margin_kg >= 0);

-- ─── Restar y devolver ──────────────────────────────────────────────────────
-- Suma `sign` × lo servido de una parte del pedido al inventario de su tienda (sin bajar de 0).
-- Solo cuenta en los productos de los que la tienda lleva inventario.
create function public.move_inventory(p_shop_order_id uuid, p_shop_id uuid, p_sign integer)
returns void
language sql security definer set search_path = '' as $$
  update public.shop_inventory inv
     set quantity = least(100000, greatest(0, inv.quantity + p_sign * i.qty))
    from (select product_id, sum(coalesce(quantity_actual, quantity_ordered)) as qty
            from public.order_items
           where shop_order_id = p_shop_order_id and product_id is not null
           group by product_id) i
   where inv.shop_id = p_shop_id and inv.product_id = i.product_id;
$$;
revoke all on function public.move_inventory(uuid, uuid, integer) from public, anon, authenticated;

-- Al preparar (o recoger sin preparar) se resta; al volver a pendiente o borrarse, se devuelve
create function public.inventory_on_shop_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'pendiente' then
      perform public.move_inventory(old.id, old.shop_id, 1);
    end if;
    return old;
  end if;
  if old.status = 'pendiente' and new.status <> 'pendiente' then
    perform public.move_inventory(new.id, new.shop_id, -1);
  elsif old.status <> 'pendiente' and new.status = 'pendiente' then
    perform public.move_inventory(new.id, new.shop_id, 1);
  end if;
  return new;
end $$;
create trigger shop_orders_inventory after update of status on public.shop_orders
  for each row execute function public.inventory_on_shop_order();
create trigger shop_orders_inventory_delete before delete on public.shop_orders
  for each row execute function public.inventory_on_shop_order();

-- Si se corrige la cantidad real de algo ya preparado, el inventario se ajusta con la diferencia
create function public.inventory_on_item_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  part public.shop_orders;
  diff numeric;
begin
  select * into part from public.shop_orders where id = new.shop_order_id;
  if not found or part.status = 'pendiente' or new.product_id is null then
    return new;
  end if;
  diff := coalesce(old.quantity_actual, old.quantity_ordered) - coalesce(new.quantity_actual, new.quantity_ordered);
  if diff <> 0 then
    update public.shop_inventory
       set quantity = least(100000, greatest(0, quantity + diff))
     where shop_id = part.shop_id and product_id = new.product_id;
  end if;
  return new;
end $$;
create trigger order_items_inventory after update of quantity_actual, quantity_ordered on public.order_items
  for each row execute function public.inventory_on_item_change();
