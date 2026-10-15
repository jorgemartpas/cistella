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

-- De temporada (otoño), para ver la portada con datos de ejemplo
update public.products set seasonal = true
  where shop_id is null and name in ('Kakis de la Ribera', 'Mandarinas clemenules', 'Uva moscatel',
    'Calabacín', 'Pimiento rojo', 'Alcachofas', 'Sepia', 'Boquerones', 'Dorada');

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
