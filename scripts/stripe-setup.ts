// Crea en Stripe (modo test) el producto y el precio de la suscripción de 20 €/mes.
// Uso: npm run stripe:setup   → copia el STRIPE_PRICE_ID que imprime a .env.local
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Falta STRIPE_SECRET_KEY en .env.local");
  process.exit(1);
}
if (!/^(sk|rk)_test_/.test(key)) {
  console.error("Usa una clave de test (sk_test_…). Cistella va en modo test hasta el lanzamiento.");
  process.exit(1);
}

const stripe = new Stripe(key);
const LOOKUP_KEY = "cistella_suscripcion_mensual";

async function main() {
  const existing = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true });
  if (existing.data[0]) {
    console.log(`Ya existe el precio: STRIPE_PRICE_ID=${existing.data[0].id}`);
    return;
  }
  const product = await stripe.products.create({
    name: "Cistella · Suscripción mensual",
    description: "Reparto periódico de la compra del comercio de Alzira",
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: 2000,
    tax_behavior: "inclusive",
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
  });
  console.log(`Precio creado. Añade a .env.local:\nSTRIPE_PRICE_ID=${price.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
