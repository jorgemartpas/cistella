# Cistella

Web app de suscripción que lleva a casa la compra de las carnicerías, pescaderías y fruterías de Alzira.
Piloto v1 con 6 tiendas. Especificación en [SPEC.md](./SPEC.md); decisiones tomadas y pendientes en
[DECISIONES.md](./DECISIONES.md).

- **Cliente:** se suscribe (20 €/mes), elige día y frecuencia, monta una cesta que se repite sola y ve sus pedidos.
- **Tienda:** las carnicerías gestionan sus productos; fruterías y pescaderías marcan qué tienen. Todas preparan sus pedidos, indican el peso real y ven sus ventas y comisión.
- **Admin:** tiendas, catálogo unificado, días de reparto y rotación, reparto del día (recogidas y entregas), clientes, ventas y ajustes.

Stack: Next.js 16 (App Router, Cache Components) + TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, Storage, RLS), Stripe Billing, Vercel. Instalable como PWA.

## Puesta en marcha en local

Requisitos: Node 20 o superior, Docker (para Supabase local) y, opcionalmente, la [CLI de Stripe](https://docs.stripe.com/stripe-cli).

```bash
npm install
cp .env.example .env.local

# Supabase local: arranca Postgres, Auth y Storage, aplica las migraciones y el seed
npx supabase start
npx supabase db reset
# Copia la URL y las claves que imprime `npx supabase status` a .env.local

# Usuarios de prueba (admin, una cuenta por tienda y dos clientes con cesta)
npm run seed:users

npm run dev   # http://localhost:3000
```

### Pagos en local

- **Sin Stripe:** pon `PAYMENTS_DEMO_MODE=true` en `.env.local`. El alta se activa sin cobrar y los pedidos quedan «cobro pendiente». Nunca en producción.
- **Con Stripe (modo test):** pon `STRIPE_SECRET_KEY=sk_test_…`, ejecuta `npm run stripe:setup` y copia el `STRIPE_PRICE_ID`. Para recibir webhooks:
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` y copia el `whsec_…` a `STRIPE_WEBHOOK_SECRET`.
  Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVC.

### Cuentas de prueba

Contraseña de todas: `cistella-demo`.

| Rol | Email |
| --- | --- |
| Admin | `admin@cistella.test` |
| Tiendas | `oskinez@`, `reino@`, `ferrer@`, `tomas@`, `fruteria-a@`, `fruteria-b@` + `cistella.test` |
| Clientes | `lucia@cistella.test` (semanal, martes), `pau@cistella.test` (quincenal, viernes) |

## Tests

```bash
npm test            # Lógica de dominio: calendario, rotación, cadencia, generación de pedidos, importes
npm run test:rls    # Permisos por rol contra Supabase (necesita la base con el seed y los usuarios de prueba)
npm run test:e2e    # Ciclo completo en el navegador (necesita Supabase con seed y PAYMENTS_DEMO_MODE=true)
npm run lint
```

## Despliegue

1. **Supabase:** crea el proyecto (región UE), y desde aquí:
   `npx supabase link --project-ref <ref>` y `npx supabase db push`.
   Carga `supabase/seed.sql` en el SQL Editor si quieres las tiendas y el catálogo de ejemplo.
   En *Authentication → URL Configuration*: Site URL = tu dominio y añade `https://<dominio>/auth/confirm` a Redirect URLs.
   Conviene dejar activada la confirmación de email.
2. **Stripe (modo test):** crea el precio con `npm run stripe:setup`. Añade un webhook a `https://<dominio>/api/stripe/webhook` con los eventos
   `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`,
   `payment_intent.succeeded` y `payment_intent.payment_failed`. Activa el *Customer Portal* en la configuración de Billing (para cambiar tarjeta).
3. **Vercel:** importa el repositorio y define las variables de `.env.example`
   (`NEXT_PUBLIC_SITE_URL` con el dominio y un `CRON_SECRET` largo y aleatorio).
4. **Cron:** `vercel.json` llama a `/api/cron/cierre` cada día a las 19:15 UTC, después de las 20:00 de Alzira en verano y en invierno.
   Crea los días de reparto de las próximas semanas y genera los pedidos de los repartos ya cerrados.
   Además, los paneles de admin y de tienda generan los pedidos pendientes al abrirse, así que no se pierde nada si el cron se retrasa.
   Si cambias la hora de cierre, ajusta el horario del cron (en el plan Hobby de Vercel solo puede ser diario; con Pro puedes ponerlo cada hora, `0 * * * *`).

## Cómo funciona

```
Cliente ajusta su cesta ──► Cierre a la hora límite ──► Se divide por tienda
                                                         ├─ Carne → su carnicería
                                                         └─ Fruta, verdura y pescado → tienda de turno (si lo tiene)
Cada tienda prepara (peso real) ──► El reparto recoge ──► Entrega ──► Cobro con el peso real
```

- **Lógica de negocio** en `src/lib/domain/` (TypeScript puro, con tests): fechas en hora de Madrid, calendario y cierres,
  rotación de tiendas, frecuencias de la suscripción y reparto de cada cesta en pedidos por tienda.
- **Generación de pedidos:** `src/lib/delivery.ts` planifica con el dominio y guarda todo en una transacción con la función SQL
  `create_orders_for_day`, que es idempotente (repetirla no duplica pedidos).
- **Permisos:** RLS en todas las tablas (`supabase/migrations/`). Cada página comprueba además el rol con `requireRole()`.
  Las tiendas solo ven su parte de cada pedido y el nombre del cliente. La clave de servicio solo se usa en el cron, los webhooks, el alta de cuentas de tienda y los cobros.
- **Cobros:** `src/lib/payments.ts`. Al marcar la entrega, el pedido pasa a «procesando» (evita cobrar dos veces) y se cobra off-session a la tarjeta guardada en el alta.

### Estructura

```
src/app/(auth)/        entrar, registro, recuperar contraseña
src/app/(cliente)/     bienvenida (alta), cesta, pedidos, cuenta
src/app/tienda/        pedidos por preparar, productos/disponibilidad, ventas
src/app/admin/         inicio, reparto, días, catálogo, tiendas, clientes, ventas, ajustes
src/app/api/           cron de cierre y webhook de Stripe
src/lib/domain/        reglas de negocio puras + tests
src/lib/               acceso a datos, Stripe, cobros, formatos
supabase/migrations/   esquema, RLS y funciones
supabase/seed.sql      6 tiendas del piloto, catálogo y calendario
tests/                 tests de permisos (RLS)
e2e/                   prueba de punta a punta (Playwright)
```

## Operación diaria (admin)

1. **Antes del cierre:** revisa en *Días* la tienda de turno del próximo reparto y cancela los festivos.
2. **Tras el cierre:** las tiendas ven sus pedidos en su panel y los marcan como preparados.
3. **Día de reparto:** en *Reparto*, marca la recogida en cada tienda y cada entrega. Al marcar «Entregado» se cobra el pedido.
   Si un cobro falla, aparece en el inicio del admin para reintentarlo.
4. **A final de mes:** en *Ventas*, descarga el CSV de comisiones para facturar a cada tienda.
