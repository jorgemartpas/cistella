-- Cestas guardadas y envío automático (decisión del 15/10/2026):
--   · Las listas y las cestas pasan a ser lo mismo: «cestas guardadas»
--   · Envío automático: con una cesta guardada marcada, cada reparto del plan se prepara solo,
--     sin confirmar, y después la cesta vuelve a ser la guardada
--   · El cliente puede saltar un reparto concreto

update public.saved_lists set kind = 'cesta' where kind = 'lista';

alter table public.saved_lists add column auto_delivery boolean not null default false;
-- Como mucho una cesta con envío automático por cliente
create unique index saved_lists_one_auto_idx on public.saved_lists (customer_id) where auto_delivery;

-- El admin ve las cestas guardadas (para saber quién tiene envío automático)
create policy "admin ve las cestas guardadas" on public.saved_lists for select using (public.is_admin());

-- ─── Repartos saltados (con envío automático) ───────────────────────────────
create table public.delivery_skips (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  delivery_day_id uuid not null references public.delivery_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, delivery_day_id)
);
create index delivery_skips_day_idx on public.delivery_skips (delivery_day_id);

alter table public.delivery_skips enable row level security;

create policy "cliente ve sus repartos saltados" on public.delivery_skips for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "cliente salta un reparto abierto" on public.delivery_skips for insert
  with check (customer_id = auth.uid() and public.delivery_day_is_open(delivery_day_id));
create policy "cliente recupera un reparto abierto" on public.delivery_skips for delete
  using (customer_id = auth.uid() and public.delivery_day_is_open(delivery_day_id));

revoke all on public.delivery_skips from anon;
revoke update on public.delivery_skips from authenticated;
