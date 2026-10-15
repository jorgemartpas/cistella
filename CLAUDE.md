@AGENTS.md

# LaCistella: notas para trabajar en el proyecto

- Interfaz en castellano, precios en euros con IVA incluido, mobile-first. Fechas de reparto como `YYYY-MM-DD` y horas en `Europe/Madrid` (`src/lib/domain/dates.ts`).
- Las reglas de negocio van en `src/lib/domain/` como funciones puras, con tests (`npm test`). La spec pide tests para la generación de pedidos y la rotación.
- Cache Components está activo: toda lectura de sesión o datos va dentro de `<Suspense>` (patrón: página estática + componente async). `createClient()` llama a `connection()`.
- Next memoiza los GET idénticos durante el render: para releer algo escrito en la misma petición, usa `createClient({ fresh: true })`.
- Permisos: RLS en la base de datos (migraciones) y `requireRole()` / `requireShop()` en cada página y Server Action. Si cambias políticas, amplía `tests/rls.test.ts`.
- Migraciones nuevas: archivo nuevo en `supabase/migrations/`, nunca editar una ya desplegada.
- Formularios: `ActionForm` + Server Action que devuelve `{ error }` o `{ ok }`.
- En tests de navegador, Next mantiene montadas (ocultas) las rutas anteriores: usa `main:visible`.
- Stripe solo en modo test hasta el lanzamiento. Commits pequeños, uno por funcionalidad.
- Antes de decidir una regla de negocio no especificada, revisa `DECISIONES.md` y pregunta.
