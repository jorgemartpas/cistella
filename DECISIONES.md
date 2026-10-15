# Decisiones de la v1

Estado de las decisiones pendientes de [SPEC.md](./SPEC.md) y de las que se han tomado al implementar.
Todo lo marcado como **provisional** se cambia desde el panel de admin, sin tocar código, salvo que se indique.

## Decisiones pendientes de la especificación

| Tema | Estado | Qué hace la app ahora | Dónde se cambia |
| --- | --- | --- | --- |
| Comisión por pedido | **Provisional** | 10 % por tienda | Admin → Tiendas → ficha (y Ajustes para tiendas nuevas) |
| Cómo se cobran los productos | **Decidido** (15/10/2026) | Aparte de la cuota, en cada pedido, con el peso real, a la tarjeta de la suscripción. Se cobra cuando el admin marca la entrega | — |
| Precio del catálogo unificado | **Provisional** (propuesta de la spec) | Lo fija el admin; las fruterías y pescaderías solo marcan disponibilidad. Las ventas de cada tienda se valoran al precio de Cistella | Admin → Catálogo |
| Días de reparto y hora límite | **Decidido** (15/10/2026) | Martes y viernes; la cesta se puede cambiar hasta las 20:00 de la víspera | Admin → Días → Calendario semanal |
| Planes y precios | **Decidido** (15/10/2026) | 2 veces por semana 25 €/mes (martes y viernes, una cesta para cada día); cada semana 20 €/mes; cada 2 semanas 16 €/mes; pago por envío sin cuota, 6 € por reparto pedido. Se quita «cada 4 semanas» (quien la tuviera pasa a cada 2 semanas) | Precios: Admin → Ajustes. Planes: `src/lib/domain/subscription.ts` |
| Qué 2 fruterías | **Pendiente** | En el seed son «Frutería A/B (por concretar)» | Admin → Tiendas (renombrar y crear su cuenta) |
| Verdura | **Decidido** (15/10/2026) | La sirven las fruterías | Código: `shopTypeForCategory` y `shop_type_for_category` |
| Zona de reparto | **Provisional** | Solo CP 46600 | Admin → Ajustes |
| Pedido mínimo | **Provisional** | Sin mínimo (0 €). Si se fija, las cestas por debajo no se preparan ese día y el cliente lo ve avisado | Admin → Ajustes |
| Cliente que no está en casa | **Provisional** | El reparto marca «No estaba» y no se cobra; el admin puede «Cobrar igualmente» después | — |

## Decisiones tomadas al implementar

- **Baja:** al darse de baja se sigue recibiendo reparto hasta el final del mes ya pagado (Stripe `cancel_at_period_end`). En pago por envío la baja es inmediata y se anulan los repartos pedidos que aún no han cerrado.
- **Pausa:** mientras está pausada no hay repartos ni se cobra la cuota (Stripe `pause_collection: void`). Al reanudar, el siguiente reparto es el próximo abierto.
- **Cambiar día o frecuencia:** el primer reparto con el plan nuevo es el siguiente abierto de ese día.
- **Pago por envío:** el cliente marca en su cesta qué repartos quiere (hasta la hora de cierre de cada uno) y solo esos días se le genera pedido. Los 6 € de envío se cobran junto con los productos al entregar; si no estaba en casa, no se cobra nada. La tarjeta se guarda al darse de alta (Stripe Checkout en modo `setup`).
- **2 veces por semana:** una cesta para cada día de reparto. Al pasar a este plan, las dos cestas empiezan como copia de la que tenía; al dejarlo, se queda la del primer día.
- **Cambiar de plan:** entre planes con cuota, Stripe prorratea la diferencia en la próxima factura. De pago por envío a un plan con cuota se pasa por el pago de Stripe. De un plan con cuota a pago por envío (**provisional**): el cambio es inmediato y la cuota deja de renovarse; lo que quede del mes pagado no se devuelve.
- **Precios en Stripe:** cada plan e importe tiene su precio en Stripe, que la app crea sola la primera vez (clave `cistella_<plan>_<céntimos>`). Si el admin cambia un precio en Ajustes, se aplica a las altas y cambios de plan nuevos; las suscripciones ya activas siguen con el suyo.
- **Cierre:** a la hora de cierre se toma una foto de la cesta. Entre el cierre y la generación de pedidos (minutos) la cesta no se puede tocar; después, los cambios van al reparto siguiente.
- **Disponibilidad:** si la tienda de turno no tiene un producto del catálogo unificado, ese producto no se sirve ese día y el cliente lo ve en su pedido («No incluido esta vez»). No se busca en la otra tienda.
- **Rotación:** alterna entre las tiendas activas de cada tipo según su «orden de rotación». El admin puede cambiar la tienda de turno de un día concreto.
- **Festivos:** el admin puede cancelar un día de reparto; nadie recibe pedido ese día.
- **Precios:** cada pedido guarda el precio del momento del cierre; cambiar un precio no altera pedidos ya generados.
- **Cantidades:** lo que va al kilo se pide en cuartos de kilo; unidades y bandejas, enteras. La tienda puede indicar cualquier cantidad real.
- **Comisión:** cuenta como vendido lo que el reparto ha recogido en la tienda, con la cantidad real, aunque luego el cliente no estuviera en casa.
- **Datos que ven las tiendas:** solo el nombre del cliente y lo que han de preparar; nunca dirección ni teléfono.
- **Stripe:** solo claves de test hasta el lanzamiento (la app rechaza claves live salvo `STRIPE_ALLOW_LIVE=true`).
