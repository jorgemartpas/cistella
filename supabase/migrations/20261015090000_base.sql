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
