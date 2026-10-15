// Crea usuarios de prueba: admin, una cuenta por tienda del piloto y un cliente de cada plan con cesta
// y su primer reparto ya confirmado (si ese día de reparto ya existe).
// Uso: npm run seed:users   (lee .env.local; para un proyecto remoto añade --yes)
import { createClient } from "@supabase/supabase-js";
import { isoWeekday } from "../src/lib/domain/dates";
import { nextOpenDate, nextOpenDateForWeekday, type ScheduleRule } from "../src/lib/domain/schedule";
import type { DeliveryFrequency } from "../src/lib/domain/subscription";

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

type SeedCustomer = {
  email: string;
  name: string;
  phone: string;
  address: string;
  plan: DeliveryFrequency;
  weekday?: number;
  /** Cesta por slot: 0 = cesta única; 2 y 5 = cestas del martes y del viernes */
  baskets: Record<number, [string, number][]>;
};

const CUSTOMERS: SeedCustomer[] = [
  {
    email: "lucia@cistella.test",
    name: "Lucía Martí",
    phone: "600111222",
    address: "Carrer Major de Santa Caterina 12, 2º",
    plan: "semanal",
    weekday: 2,
    baskets: {
      0: [
        ["Naranjas de zumo", 3],
        ["Tomate valenciano", 1],
        ["Lechuga romana", 2],
        ["Merluza", 0.75],
        ["Hamburguesas de ternera caseras", 1],
        ["Lomo de cerdo", 0.5],
      ],
    },
  },
  {
    email: "pau@cistella.test",
    name: "Pau Ferrando",
    phone: "600333444",
    address: "Avinguda Luis Suñer 5, 4ºB",
    plan: "quincenal",
    weekday: 5,
    baskets: {
      0: [
        ["Kakis de la Ribera", 2],
        ["Uva moscatel", 1],
        ["Patata", 2],
        ["Gambas", 0.5],
        ["Chorizo casero", 0.25],
      ],
    },
  },
  {
    email: "marta@cistella.test",
    name: "Marta Soler",
    phone: "600555666",
    address: "Carrer de la Sang 3, 1º",
    plan: "dos_por_semana",
    baskets: {
      2: [
        ["Mandarinas clemenules", 2],
        ["Pechuga de pollo fileteada", 1],
        ["Calabacín", 1],
      ],
      5: [
        ["Dorada", 1],
        ["Alcachofas", 1],
        ["Plátano de Canarias", 1],
      ],
    },
  },
  {
    email: "toni@cistella.test",
    name: "Toni Puig",
    phone: "600777888",
    address: "Plaça Major 8, 3º",
    plan: "por_envio",
    baskets: {
      0: [
        ["Entrecot de ternera", 0.5],
        ["Pimiento rojo", 1],
      ],
    },
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
  const adminId = await ensureUser("admin@cistella.test", "Equipo LaCistella");
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
    const anchor = c.weekday ? nextOpenDateForWeekday(rules, c.weekday, new Date()) : nextOpenDate(rules, new Date());
    if (!anchor) throw new Error(`No hay reparto para ${c.email}; revisa delivery_schedule`);
    await check(
      supabase.from("subscriptions").upsert(
        {
          customer_id: id,
          status: "activa",
          frequency: c.plan,
          delivery_weekday: isoWeekday(anchor.date),
          anchor_date: anchor.date,
        },
        { onConflict: "customer_id" },
      ),
      `suscripción ${c.email}`,
    );
    await check(supabase.from("basket_items").delete().eq("customer_id", id), "vaciar cesta");
    await check(
      supabase.from("basket_items").insert(
        Object.entries(c.baskets).flatMap(([slot, lines]) =>
          lines.map(([name, quantity]) => {
            const pid = productId.get(name);
            if (!pid) throw new Error(`Producto no encontrado en el seed: ${name}`);
            return { customer_id: id, product_id: pid, quantity, slot: Number(slot) };
          }),
        ),
      ),
      `cesta ${c.email}`,
    );
    const { data: day } = await supabase.from("delivery_days").select("id").eq("date", anchor.date).maybeSingle();
    if (day) {
      await check(
        supabase
          .from("delivery_requests")
          .upsert({ customer_id: id, delivery_day_id: day.id }, { onConflict: "customer_id,delivery_day_id" }),
        `confirmación ${c.email}`,
      );
    }
    console.log(`✓ ${c.email} (${c.plan}, primer reparto ${anchor.date}${day ? ", confirmado" : ""})`);
  }

  console.log(`\nContraseña de todas las cuentas de prueba: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
