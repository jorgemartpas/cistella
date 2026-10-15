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
