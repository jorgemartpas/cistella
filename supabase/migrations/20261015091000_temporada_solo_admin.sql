-- Productos de temporada (15/10/2026): también la carne, y solo los marca el admin.
-- Las carnicerías editan sus productos, pero no pueden ponerlos «de temporada» (salen en la portada).

create function public.guard_product_seasonal() returns trigger
language plpgsql as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.seasonal)
     or (tg_op = 'UPDATE' and new.seasonal is distinct from old.seasonal) then
    raise exception 'Solo el equipo de Cistella marca los productos de temporada' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger products_guard_seasonal before insert or update on public.products
  for each row execute function public.guard_product_seasonal();
