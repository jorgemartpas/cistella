// Tests de permisos (Row Level Security) contra un Supabase de pruebas con el seed cargado
// (supabase/seed.sql + npm run seed:users). Uso: npm run test:rls
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = process.env.SEED_PASSWORD ?? "cistella-demo";

const SHOP = {
  oskinez: "11111111-1111-4111-8111-000000000001",
  reino: "11111111-1111-4111-8111-000000000002",
  ferrer: "11111111-1111-4111-8111-000000000003",
  fruteriaA: "11111111-1111-4111-8111-000000000005",
  fruteriaB: "11111111-1111-4111-8111-000000000006",
};
const TEST_DATE = "2030-01-01";
const OPEN_DATE = "2030-01-04";

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`No puedo entrar como ${email}: ${error.message}. ¿Has ejecutado npm run seed:users?`);
  return client;
}

let lucia: SupabaseClient;
let pau: SupabaseClient;
let oskinez: SupabaseClient;
let fruteriaA: SupabaseClient;
let admin: SupabaseClient;
let luciaId: string;
let pauId: string;
let dayId: string;
let luciaOrderId: string;
let pauOrderId: string;
let openDayId: string;

beforeAll(async () => {
  [lucia, pau, oskinez, fruteriaA, admin] = await Promise.all(
    ["lucia", "pau", "oskinez", "fruteria-a", "admin"].map((u) => signIn(`${u}@cistella.test`)),
  );
  const { data: profiles } = await service.from("profiles").select("id, email").in("email", ["lucia@cistella.test", "pau@cistella.test"]);
  luciaId = profiles!.find((p) => p.email === "lucia@cistella.test")!.id;
  pauId = profiles!.find((p) => p.email === "pau@cistella.test")!.id;

  // Un día de reparto de prueba con un pedido para cada cliente
  await service.from("delivery_days").delete().in("date", [TEST_DATE, OPEN_DATE]);
  const { data: openDay } = await service
    .from("delivery_days")
    .insert({ date: OPEN_DATE, cutoff_at: "2030-01-03T19:00:00Z" })
    .select("id")
    .single();
  openDayId = openDay!.id;
  const { data: day, error } = await service
    .from("delivery_days")
    .insert({ date: TEST_DATE, cutoff_at: "2029-12-31T19:00:00Z", fruteria_id: SHOP.fruteriaA, pescaderia_id: SHOP.ferrer })
    .select("id")
    .single();
  if (error) throw error;
  dayId = day.id;
  const { data: products } = await service.from("products").select("id, name, unit, price_cents").in("name", ["Lomo de cerdo", "Longaniza fresca", "Naranjas de zumo"]);
  const p = (name: string) => products!.find((x) => x.name === name)!;
  const item = (name: string, quantity: number) => ({
    product_id: p(name).id,
    product_name: name,
    unit: p(name).unit,
    quantity,
    unit_price_cents: p(name).price_cents,
  });
  const order = (customerId: string, name: string) => ({
    customer_id: customerId,
    customer_name: name,
    phone: "600000000",
    address: "Calle de prueba 1",
    postal_code: "46600",
    estimated_total_cents: 1000,
    skipped_items: [],
    shops: [
      { shop_id: SHOP.oskinez, items: [item("Longaniza fresca", 0.5)] },
      { shop_id: SHOP.fruteriaA, items: [item("Naranjas de zumo", 2)] },
    ],
  });
  const { error: rpcError } = await service.rpc("create_orders_for_day", {
    p_day_id: dayId,
    p_orders: [order(luciaId, "Lucía"), order(pauId, "Pau")],
    p_report: { orders: 2, skippedCustomers: [] },
  });
  if (rpcError) throw rpcError;
  const { data: orders } = await service.from("orders").select("id, customer_id").eq("delivery_day_id", dayId);
  luciaOrderId = orders!.find((o) => o.customer_id === luciaId)!.id;
  pauOrderId = orders!.find((o) => o.customer_id === pauId)!.id;
});

afterAll(async () => {
  if (dayId) {
    await service.from("orders").delete().eq("delivery_day_id", dayId);
    await service.from("delivery_days").delete().eq("id", dayId);
  }
  if (openDayId) await service.from("delivery_days").delete().eq("id", openDayId);
  await service.from("profiles").update({ phone: "600111222" }).eq("id", luciaId);
});

describe("visitante sin sesión", () => {
  it("ve el catálogo y las tiendas", async () => {
    const { data: products } = await anon.from("products").select("id");
    const { data: shops } = await anon.from("shops").select("id");
    expect(products!.length).toBeGreaterThan(0);
    expect(shops!.length).toBe(6);
  });

  it("no ve perfiles, pedidos, suscripciones ni disponibilidad", async () => {
    for (const table of ["profiles", "orders", "subscriptions", "shop_availability", "basket_items"]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });
});

describe("cliente", () => {
  it("solo ve su perfil y sus pedidos", async () => {
    const { data: profiles } = await lucia.from("profiles").select("id");
    expect(profiles!.map((p) => p.id)).toEqual([luciaId]);
    const { data: orders } = await lucia.from("orders").select("id").eq("delivery_day_id", dayId);
    expect(orders!.map((o) => o.id)).toEqual([luciaOrderId]);
    const { data: other } = await lucia.from("orders").select("id").eq("id", pauOrderId);
    expect(other).toEqual([]);
  });

  it("otro cliente tampoco ve los pedidos de los demás", async () => {
    const { data } = await pau.from("orders").select("id").eq("delivery_day_id", dayId);
    expect(data!.map((o) => o.id)).toEqual([pauOrderId]);
    const { data: items } = await pau.from("order_items").select("id, shop_orders!inner(order_id)").eq("shop_orders.order_id", luciaOrderId);
    expect(items).toEqual([]);
  });

  it("ve el detalle de su pedido por tienda", async () => {
    const { data: parts } = await lucia.from("shop_orders").select("id, order_items(id)").eq("order_id", luciaOrderId);
    expect(parts).toHaveLength(2);
    const { data: others } = await lucia.from("shop_orders").select("id").eq("order_id", pauOrderId);
    expect(others).toEqual([]);
  });

  it("puede cambiar su teléfono pero no su rol ni su tienda", async () => {
    const { error: okError } = await lucia.from("profiles").update({ phone: "600999888" }).eq("id", luciaId);
    expect(okError).toBeNull();
    const { error } = await lucia.from("profiles").update({ role: "admin" }).eq("id", luciaId);
    expect(error?.code).toBe("42501");
    const { data } = await service.from("profiles").select("role").eq("id", luciaId).single();
    expect(data!.role).toBe("cliente");
  });

  it("no puede poner una dirección fuera de la zona de reparto", async () => {
    const { error } = await lucia.from("profiles").update({ postal_code: "46001" }).eq("id", luciaId);
    expect(error?.message).toMatch(/solo repartimos en Alzira/);
  });

  it("cambia frecuencia y día, pero no el estado de la suscripción", async () => {
    const { data: sub } = await lucia.from("subscriptions").select("frequency").single();
    const { error: okError } = await lucia.from("subscriptions").update({ frequency: sub!.frequency }).eq("customer_id", luciaId);
    expect(okError).toBeNull();
    const { error } = await lucia.from("subscriptions").update({ status: "activa", cancel_at_period_end: true }).eq("customer_id", luciaId);
    expect(error?.message).toMatch(/No puedes cambiar/);
  });

  it("no puede cambiarse de plan por su cuenta (cada plan tiene su precio)", async () => {
    const { error } = await lucia.from("subscriptions").update({ frequency: "dos_por_semana" }).eq("customer_id", luciaId);
    expect(error?.message).toMatch(/No puedes cambiar/);
  });

  it("no puede tocar las fechas de su prueba gratis (ni alargarla ni borrar que la usó)", async () => {
    const extend = await lucia
      .from("subscriptions")
      .update({ trial_ends_at: "2099-01-01T00:00:00Z" })
      .eq("customer_id", luciaId);
    expect(extend.error?.message).toMatch(/No puedes cambiar/);
    const started = await lucia
      .from("subscriptions")
      .update({ trial_started_at: "2026-10-01T00:00:00Z" })
      .eq("customer_id", luciaId);
    expect(started.error?.message).toMatch(/No puedes cambiar/);
  });

  it("pide y anula repartos sueltos abiertos, solo suyos", async () => {
    const ask = await lucia.from("delivery_requests").insert({ customer_id: luciaId, delivery_day_id: openDayId });
    expect(ask.error).toBeNull();
    const { data: others } = await pau.from("delivery_requests").select("customer_id").eq("delivery_day_id", openDayId);
    expect(others).toEqual([]);
    const forOther = await pau.from("delivery_requests").insert({ customer_id: luciaId, delivery_day_id: openDayId });
    expect(forOther.error?.code).toBe("42501");
    const cancel = await lucia.from("delivery_requests").delete().eq("delivery_day_id", openDayId).select("delivery_day_id");
    expect(cancel.data).toHaveLength(1);
  });

  it("no puede pedir un reparto ya cerrado", async () => {
    const { error } = await lucia.from("delivery_requests").insert({ customer_id: luciaId, delivery_day_id: dayId });
    expect(error?.code).toBe("42501");
  });

  it("no crea pedidos ni toca la cesta de otro", async () => {
    const { error } = await lucia.from("orders").insert({ delivery_day_id: dayId, customer_name: "x", address: "x", estimated_total_cents: 0 });
    expect(error).not.toBeNull();
    const { error: rpcError } = await lucia.rpc("create_orders_for_day", { p_day_id: dayId, p_orders: [], p_report: {} });
    expect(rpcError).not.toBeNull();
    const { data: products } = await lucia.from("products").select("id").limit(1);
    const { error: basketError } = await lucia.from("basket_items").insert({ customer_id: pauId, product_id: products![0].id, quantity: 1 });
    expect(basketError?.code).toBe("42501");
  });

  it("guarda sus listas y cestas, y nadie más las ve ni las toca", async () => {
    const { data: products } = await lucia.from("products").select("id").limit(2);
    const { data: list, error } = await lucia.from("saved_lists").insert({ kind: "cesta", name: "Cesta de prueba" }).select("id, customer_id").single();
    expect(error).toBeNull();
    expect(list!.customer_id).toBe(luciaId);
    const add = await lucia.from("saved_list_items").insert({ list_id: list!.id, product_id: products![0].id, quantity: 0.75 });
    expect(add.error).toBeNull();

    // Otro cliente: ni la ve, ni añade, ni borra
    const { data: seen } = await pau.from("saved_lists").select("id").eq("id", list!.id);
    expect(seen).toEqual([]);
    const { data: seenItems } = await pau.from("saved_list_items").select("product_id").eq("list_id", list!.id);
    expect(seenItems).toEqual([]);
    const intrude = await pau.from("saved_list_items").insert({ list_id: list!.id, product_id: products![1].id });
    expect(intrude.error?.code).toBe("42501");
    const forOther = await pau.from("saved_lists").insert({ customer_id: luciaId, kind: "lista", name: "Intrusa" });
    expect(forOther.error?.code).toBe("42501");
    const removed = await pau.from("saved_lists").delete().eq("id", list!.id).select("id");
    expect(removed.data).toEqual([]);
    const { data: anonSeen, error: anonError } = await anon.from("saved_lists").select("id");
    expect(anonError ?? anonSeen).toBeTruthy();
    expect(anonSeen ?? []).toEqual([]);

    const own = await lucia.from("saved_lists").delete().eq("id", list!.id).select("id");
    expect(own.data).toHaveLength(1);
    const { data: orphan } = await service.from("saved_list_items").select("product_id").eq("list_id", list!.id);
    expect(orphan).toEqual([]);
  });

  it("salta repartos abiertos, solo suyos; una sola cesta automática; el admin las ve", async () => {
    const skip = await lucia.from("delivery_skips").insert({ customer_id: luciaId, delivery_day_id: openDayId });
    expect(skip.error).toBeNull();
    const forOther = await pau.from("delivery_skips").insert({ customer_id: luciaId, delivery_day_id: openDayId });
    expect(forOther.error?.code).toBe("42501");
    const closed = await lucia.from("delivery_skips").insert({ customer_id: luciaId, delivery_day_id: dayId });
    expect(closed.error?.code).toBe("42501");
    const { data: seenByPau } = await pau.from("delivery_skips").select("customer_id").eq("delivery_day_id", openDayId);
    expect(seenByPau).toEqual([]);
    const { data: seenByAdmin } = await admin.from("delivery_skips").select("customer_id").eq("delivery_day_id", openDayId);
    expect(seenByAdmin).toHaveLength(1);
    const undo = await lucia.from("delivery_skips").delete().eq("delivery_day_id", openDayId).select("customer_id");
    expect(undo.data).toHaveLength(1);

    await lucia.from("saved_lists").update({ auto_delivery: false }).eq("customer_id", luciaId);
    const { data: auto } = await lucia
      .from("saved_lists")
      .insert({ kind: "cesta", name: "Automática", auto_delivery: true })
      .select("id")
      .single();
    const second = await lucia.from("saved_lists").insert({ kind: "cesta", name: "Otra", auto_delivery: true });
    expect(second.error?.code).toBe("23505");
    const { data: adminSees } = await admin.from("saved_lists").select("id").eq("id", auto!.id);
    expect(adminSees).toHaveLength(1);
    const { data: pauSees } = await pau.from("saved_lists").select("id").eq("id", auto!.id);
    expect(pauSees).toEqual([]);
    await lucia.from("saved_lists").delete().eq("id", auto!.id);
  });

  it("no puede marcar su pedido como entregado", async () => {
    await lucia.from("orders").update({ status: "entregado" }).eq("id", luciaOrderId);
    const { data } = await service.from("orders").select("status").eq("id", luciaOrderId).single();
    expect(data!.status).toBe("pendiente");
  });
});

describe("tienda", () => {
  it("solo ve su parte de los pedidos, sin dirección ni teléfono", async () => {
    const { data: parts } = await oskinez.from("shop_orders").select("shop_id, customer_label").eq("delivery_day_id", dayId);
    expect(parts!.length).toBe(2);
    expect(parts!.every((p) => p.shop_id === SHOP.oskinez)).toBe(true);
    const { data: orders } = await oskinez.from("orders").select("address, phone").eq("delivery_day_id", dayId);
    expect(orders).toEqual([]);
    const { data: profiles } = await oskinez.from("profiles").select("id");
    expect(profiles).toHaveLength(1);
  });

  it("marca su parte como preparada e indica el peso real", async () => {
    const { data: part } = await oskinez.from("shop_orders").select("id, order_items(id)").eq("order_id", luciaOrderId).single();
    const itemId = part!.order_items[0].id;
    expect((await oskinez.from("order_items").update({ quantity_actual: 0.53 }).eq("id", itemId)).error).toBeNull();
    expect((await oskinez.from("shop_orders").update({ status: "preparado" }).eq("id", part!.id)).error).toBeNull();
    const { data } = await service.from("shop_orders").select("status, prepared_at").eq("id", part!.id).single();
    expect(data!.status).toBe("preparado");
    expect(data!.prepared_at).not.toBeNull();
  });

  it("no cambia precios ni marca como recogido", async () => {
    const { data: part } = await oskinez.from("shop_orders").select("id, order_items(id)").eq("order_id", pauOrderId).single();
    const { error: priceError } = await oskinez.from("order_items").update({ unit_price_cents: 1 }).eq("id", part!.order_items[0].id);
    expect(priceError?.message).toMatch(/Solo puedes indicar la cantidad real/);
    const { error } = await oskinez.from("shop_orders").update({ status: "recogido" }).eq("id", part!.id);
    expect(error?.message).toMatch(/recogido/);
  });

  it("no toca los pedidos de otra tienda", async () => {
    const { data: fruPart } = await service.from("shop_orders").select("id").eq("order_id", pauOrderId).eq("shop_id", SHOP.fruteriaA).single();
    await oskinez.from("shop_orders").update({ status: "preparado" }).eq("id", fruPart!.id);
    const { data } = await service.from("shop_orders").select("status").eq("id", fruPart!.id).single();
    expect(data!.status).toBe("pendiente");
  });

  it("la carnicería gestiona sus productos y no los de otra", async () => {
    const { data: created, error } = await oskinez
      .from("products")
      .insert({ shop_id: SHOP.oskinez, category: "carne", name: "Producto de prueba RLS", price_cents: 100, unit: "kg" })
      .select("id")
      .single();
    expect(error).toBeNull();
    await service.from("products").delete().eq("id", created!.id);

    const { error: otherShop } = await oskinez
      .from("products")
      .insert({ shop_id: SHOP.reino, category: "carne", name: "Intruso", price_cents: 100, unit: "kg" });
    expect(otherShop?.code).toBe("42501");
    const { data: reinoProduct } = await service.from("products").select("id, price_cents").eq("shop_id", SHOP.reino).limit(1).single();
    await oskinez.from("products").update({ price_cents: 1 }).eq("id", reinoProduct!.id);
    const { data: after } = await service.from("products").select("price_cents").eq("id", reinoProduct!.id).single();
    expect(after!.price_cents).toBe(reinoProduct!.price_cents);
  });

  it("la frutería no crea productos y solo marca su propia disponibilidad", async () => {
    const { error } = await fruteriaA.from("products").insert({ category: "fruta", name: "Intrusa", price_cents: 100, unit: "kg" });
    expect(error?.code).toBe("42501");
    const { data: naranjas } = await service.from("products").select("id").eq("name", "Naranjas de zumo").single();
    const own = await fruteriaA
      .from("shop_availability")
      .upsert({ shop_id: SHOP.fruteriaA, product_id: naranjas!.id, available: true }, { onConflict: "shop_id,product_id" });
    expect(own.error).toBeNull();
    const other = await fruteriaA
      .from("shop_availability")
      .upsert({ shop_id: SHOP.fruteriaB, product_id: naranjas!.id, available: false }, { onConflict: "shop_id,product_id" });
    expect(other.error?.code).toBe("42501");
    const { data: visible } = await fruteriaA.from("shop_availability").select("shop_id");
    expect(new Set(visible!.map((v) => v.shop_id))).toEqual(new Set([SHOP.fruteriaA]));
  });
});

describe("admin", () => {
  it("ve todos los pedidos y gestiona el reparto", async () => {
    const { data: orders } = await admin.from("orders").select("id").eq("delivery_day_id", dayId);
    expect(orders).toHaveLength(2);
    const { data: part } = await admin.from("shop_orders").select("id").eq("order_id", luciaOrderId).eq("shop_id", SHOP.oskinez).single();
    expect((await admin.from("shop_orders").update({ status: "recogido" }).eq("id", part!.id)).error).toBeNull();
  });

  it("la tienda ve sus ventas recogidas y no las de otras", async () => {
    const { data: sales } = await oskinez.from("shop_sales").select("shop_id, total_cents").eq("delivery_date", TEST_DATE);
    // 0,53 kg de longaniza a 9,90 €/kg → 5,25 €
    expect(sales).toEqual([{ shop_id: SHOP.oskinez, total_cents: 525 }]);
    const { data: fruSales } = await fruteriaA.from("shop_sales").select("shop_id").eq("delivery_date", TEST_DATE);
    expect(fruSales).toEqual([]);
  });
});
