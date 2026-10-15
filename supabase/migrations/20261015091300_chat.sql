-- Chat entre las tiendas y el equipo de LaCistella (decisión del 15/10/2026): una conversación por
-- tienda con todo el equipo (cualquier admin responde). Solo texto. Cada lado sabe hasta dónde ha leído.

create type public.chat_side as enum ('tienda', 'admin');

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sender_id uuid default auth.uid() references public.profiles(id) on delete set null,
  sender_side public.chat_side not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_messages_shop_idx on public.chat_messages (shop_id, created_at desc);

-- Hasta cuándo ha leído cada lado la conversación de cada tienda
create table public.chat_threads (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  shop_read_at timestamptz,
  admin_read_at timestamptz
);

alter table public.chat_messages enable row level security;
alter table public.chat_threads enable row level security;

create policy "tienda y admin ven su conversación" on public.chat_messages for select
  using (public.is_admin() or shop_id = public.my_shop_id());
create policy "tienda y admin escriben como quienes son" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      (sender_side = 'admin' and public.is_admin())
      or (sender_side = 'tienda' and shop_id = public.my_shop_id())
    )
  );
create policy "tienda y admin ven lo leído" on public.chat_threads for select
  using (public.is_admin() or shop_id = public.my_shop_id());
revoke all on public.chat_messages, public.chat_threads from anon;
revoke update, delete on public.chat_messages from authenticated;
revoke insert, update, delete on public.chat_threads from authenticated;

-- Marca la conversación como leída por el lado de quien la abre (la tienda o el equipo)
create function public.mark_chat_read(p_shop_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    insert into public.chat_threads (shop_id, admin_read_at) values (p_shop_id, now())
    on conflict (shop_id) do update set admin_read_at = now();
  elsif p_shop_id = public.my_shop_id() then
    insert into public.chat_threads (shop_id, shop_read_at) values (p_shop_id, now())
    on conflict (shop_id) do update set shop_read_at = now();
  else
    raise exception 'Esta conversación no es tuya' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Mensajes sin leer de quien pregunta: el admin, los de todas las tiendas; una tienda, los del equipo
create function public.chat_unread_count() returns integer
language sql stable security definer set search_path = '' as $$
  select case
    when public.is_admin() then (
      select count(*)::integer from public.chat_messages m
        left join public.chat_threads t on t.shop_id = m.shop_id
       where m.sender_side = 'tienda' and m.created_at > coalesce(t.admin_read_at, '-infinity'::timestamptz))
    when public.my_shop_id() is not null then (
      select count(*)::integer from public.chat_messages m
        left join public.chat_threads t on t.shop_id = m.shop_id
       where m.shop_id = public.my_shop_id() and m.sender_side = 'admin'
         and m.created_at > coalesce(t.shop_read_at, '-infinity'::timestamptz))
    else 0
  end
$$;

-- Bandeja del admin: cada tienda con su último mensaje y cuántos no ha leído el equipo
create function public.chat_inbox()
returns table (shop_id uuid, shop_name text, shop_type public.shop_type, last_body text,
               last_at timestamptz, last_side public.chat_side, unread integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo de LaCistella' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, s.name, s.type, lm.body, lm.created_at, lm.sender_side,
         (select count(*)::integer from public.chat_messages m
           where m.shop_id = s.id and m.sender_side = 'tienda'
             and m.created_at > coalesce(t.admin_read_at, '-infinity'::timestamptz))
    from public.shops s
    left join public.chat_threads t on t.shop_id = s.id
    left join lateral (
      select m.body, m.created_at, m.sender_side from public.chat_messages m
       where m.shop_id = s.id order by m.created_at desc limit 1
    ) lm on true
   order by lm.created_at desc nulls last, s.name;
end $$;

revoke all on function public.mark_chat_read(uuid), public.chat_unread_count(), public.chat_inbox() from public, anon;
grant execute on function public.mark_chat_read(uuid), public.chat_unread_count(), public.chat_inbox() to authenticated;
