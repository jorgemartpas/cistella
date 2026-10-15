// Crea usuarios de prueba: admin, una cuenta por tienda del piloto y dos clientes con cesta.
// Uso: npm run seed:users   (lee .env.local; para un proyecto remoto añade --yes)
import { createClient } from "@supabase/supabase-js";
import { nextOpenDateForWeekday, type ScheduleRule } from "../src/lib/domain/schedule";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const isLocal = /127\.0\.0\.1|localhost/.test(url);
if (!isLocal && !process.argv.includes("--yes")) {
  console.error(`Vas a crear usuarios de prueba en ${url}. Repite con --yes si es un proyecto de pruebas.`);
  process.exit(1);
}

const PASSWORD = process.env.SEED_PASSWORD ?? "cistella-demo";
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const SHOP_ACCOUNTS = [
  { email: "oskinez@cistella.test", name: "Oskiñez", shopId: "11111111-1111-4111-8111-000000000001" },
  { email: "reino@cistella.test", name: "Carnicería Reino", shopId: "11111111-1111-4111-8111-000000000002" },
  { email: "ferrer@cistella.test", name: "Pescados Miguel Ferrer", shopId: "11111111-1111-4111-8111-000000000003" },
  { email: "tomas@cistella.test", name: "Pescados Tomás", shopId: "11111111-1111-4111-8111-000000000004" },
  { email: "fruteria-a@cistella.test", name: "Frutería A", shopId: "11111111-1111-4111-8111-000000000005" },
  { email: "fruteria-b@cistella.test", name: "Frutería B", shopId: "11111111-1111-4111-8111-000000000006" },
];

const CUSTOMERS = [
  {
    email: "lucia@cistella.test",
    name: "Lucía Martí",
    phone: "600111222",
    address: "Carrer Major de Santa Caterina 12, 2º",
    frequency: "semanal" as const,
    weekday: 2,
    basket: [
      ["Naranjas de zumo", 3],
      ["Tomate valenciano", 1],
      ["Lechuga romana", 2],
      ["Merluza", 0.75],
      ["Hamburguesas de ternera caseras", 1],
      ["Lomo de cerdo", 0.5],
    ] as [string, number][],
  },
  {
    email: "pau@cistella.test",
    name: "Pau Ferrando",
    phone: "600333444",
    address: "Avinguda Luis Suñer 5, 4ºB",
    frequency: "quincenal" as const,
    weekday: 5,
    basket: [
      ["Kakis de la Ribera", 2],
      ["Uva moscatel", 1],
      ["Patata", 2],
      ["Gambas", 0.5],
      ["Chorizo casero", 0.25],
    ] as [string, number][],
  },
];

async function ensureUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, accepted_privacy: "true" },
  });
  if (data.user) return data.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).single();
  if (!existing) throw new Error(`No encuentro el usuario ${email}`);
  return existing.id;
}

async function check<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, what: string) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  const adminId = await ensureUser("admin@cistella.test", "Equipo Cistella");
  await check(supabase.from("profiles").update({ role: "admin" }).eq("id", adminId), "admin");
  console.log("✓ admin@cistella.test");

  for (const shop of SHOP_ACCOUNTS) {
    const id = await ensureUser(shop.email, shop.name);
    await check(supabase.from("profiles").update({ role: "tienda", shop_id: shop.shopId }).eq("id", id), shop.email);
    console.log(`✓ ${shop.email} → ${shop.name}`);
  }

  const schedule = await check(supabase.from("delivery_schedule").select("*"), "calendario");
  const rules: ScheduleRule[] = (schedule ?? []).map((r) => ({
    weekday: r.weekday,
    active: r.active,
    cutoffDaysBefore: r.cutoff_days_before,
    cutoffTime: r.cutoff_time,
  }));
  const products = await check(supabase.from("products").select("id, name"), "productos");
  const productId = new Map((products ?? []).map((p) => [p.name, p.id]));

  for (const c of CUSTOMERS) {
    const id = await ensureUser(c.email, c.name);
    await check(
      supabase.from("profiles").update({ full_name: c.name, phone: c.phone, address: c.address, postal_code: "46600" }).eq("id", id),
      c.email,
    );
    const anchor = nextOpenDateForWeekday(rules, c.weekday, new Date());
    if (!anchor) throw new Error(`No hay reparto los días ${c.weekday}; revisa delivery_schedule`);
    await check(
      supabase.from("subscriptions").upsert(
        {
          customer_id: id,
          status: "activa",
          frequency: c.frequency,
          delivery_weekday: c.weekday,
          anchor_date: anchor.date,
        },
        { onConflict: "customer_id" },
      ),
      `suscripción ${c.email}`,
    );
    await check(supabase.from("basket_items").delete().eq("customer_id", id), "vaciar cesta");
    await check(
      supabase.from("basket_items").insert(
        c.basket.map(([name, quantity]) => {
          const pid = productId.get(name);
          if (!pid) throw new Error(`Producto no encontrado en el seed: ${name}`);
          return { customer_id: id, product_id: pid, quantity };
        }),
      ),
      `cesta ${c.email}`,
    );
    console.log(`✓ ${c.email} (${c.frequency}, primer reparto ${anchor.date})`);
  }

  console.log(`\nContraseña de todas las cuentas de prueba: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
