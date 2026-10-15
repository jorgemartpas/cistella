-- Productos de temporada (decisión del 15/10/2026): el admin marca qué productos de fruta, verdura
-- y pescado son de temporada; la portada de la tienda los muestra separados por categoría.
-- Las políticas de products no cambian: solo el admin edita el catálogo unificado.

alter table public.products add column seasonal boolean not null default false;
