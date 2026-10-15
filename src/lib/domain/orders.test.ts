import { describe, expect, it } from "vitest";
import { finalTotalCents, planOrdersForDay, type PlanCustomer, type PlanInput, type PlanProduct } from "./orders";

const SHOPS = {
  oskinez: "shop-carn-oskinez",
  reino: "shop-carn-reino",
  fruA: "shop-fru-a",
  fruB: "shop-fru-b",
  pesFerrer: "shop-pes-ferrer",
  pesTomas: "shop-pes-tomas",
};

const product = (p: Partial<PlanProduct> & Pick<PlanProduct, "id" | "category">): PlanProduct => ({
  name: p.id,
  shopId: null,
  unit: "kg",
  priceCents: 100,
  active: true,
  ...p,
});

const products: PlanProduct[] = [
  product({ id: "hamburguesas", category: "carne", shopId: SHOPS.oskinez, unit: "bandeja", priceCents: 650 }),
  product({ id: "lomo", category: "carne", shopId: SHOPS.reino, priceCents: 950 }),
  product({ id: "naranjas", category: "fruta", priceCents: 160 }),
  product({ id: "uva", category: "fruta", priceCents: 320 }),
  product({ id: "tomate", category: "verdura", priceCents: 340 }),
  product({ id: "merluza", category: "pescado", priceCents: 1490 }),
  product({ id: "gambas", category: "pescado", priceCents: 2290 }),
];

// Disponibilidad: la frutería B no tiene uva; la pescadería Ferrer no tiene gambas
const availability: PlanInput["availability"] = [
  ...["naranjas", "uva", "tomate"].map((productId) => ({ shopId: SHOPS.fruA, productId, available: true })),
  ...["naranjas", "tomate"].map((productId) => ({ shopId: SHOPS.fruB, productId, available: true })),
  { shopId: SHOPS.fruB, productId: "uva", available: false },
  { shopId: SHOPS.pesFerrer, productId: "merluza", available: true },
  { shopId: SHOPS.pesTomas, productId: "merluza", available: true },
  { shopId: SHOPS.pesTomas, productId: "gambas", available: true },
];

const customer = (id: string, overrides: Partial<PlanCustomer> = {}): PlanCustomer => ({
  customerId: id,
  name: `Cliente ${id}`,
  phone: "600000000",
  address: "Carrer Major 1, Alzira",
  postalCode: "46600",
  subscription: { status: "activa", frequency: "semanal", deliveryWeekday: 2, anchorDate: "2026-10-20" },
  confirmed: true,
  ...overrides,
});

// Martes 27 de octubre: fruta a la frutería A, pescado a Pescados Tomás
const baseInput = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  day: { id: "day-1", date: "2026-10-27", fruteriaId: SHOPS.fruA, pescaderiaId: SHOPS.pesTomas },
  customers: [customer("c1")],
  basket: [],
  products,
  availability,
  activeShopIds: Object.values(SHOPS),
  minOrderCents: 0,
  ...overrides,
});

describe("generación de pedidos por tienda", () => {
  it("divide la cesta en un pedido por tienda", () => {
    const plan = planOrdersForDay(
      baseInput({
        basket: [
          { customerId: "c1", productId: "hamburguesas", quantity: 2 },
          { customerId: "c1", productId: "lomo", quantity: 0.5 },
          { customerId: "c1", productId: "naranjas", quantity: 3 },
          { customerId: "c1", productId: "tomate", quantity: 1 },
          { customerId: "c1", productId: "merluza", quantity: 0.75 },
        ],
      }),
    );

    expect(plan.orders).toHaveLength(1);
    const order = plan.orders[0];
    const shops = Object.fromEntries(order.shops.map((s) => [s.shopId, s.items.map((i) => i.productId)]));
    expect(shops).toEqual({
      [SHOPS.oskinez]: ["hamburguesas"],
      [SHOPS.reino]: ["lomo"],
      // Fruta y verdura van juntas a la frutería de turno
      [SHOPS.fruA]: ["naranjas", "tomate"],
      [SHOPS.pesTomas]: ["merluza"],
    });
    expect(order.skippedItems).toEqual([]);
  });

  it("calcula el importe estimado con IVA incluido y redondeo al céntimo", () => {
    const plan = planOrdersForDay(
      baseInput({
        basket: [
          { customerId: "c1", productId: "hamburguesas", quantity: 2 }, // 13,00
          { customerId: "c1", productId: "naranjas", quantity: 1.5 }, // 2,40
          { customerId: "c1", productId: "merluza", quantity: 0.75 }, // 11,175 → 11,18
        ],
      }),
    );
    expect(plan.orders[0].estimatedTotalCents).toBe(1300 + 240 + 1118);
  });

  it("guarda el precio del momento en cada línea", () => {
    const plan = planOrdersForDay(baseInput({ basket: [{ customerId: "c1", productId: "lomo", quantity: 1 }] }));
    expect(plan.orders[0].shops[0].items[0]).toMatchObject({ unitPriceCents: 950, unit: "kg", quantity: 1 });
  });

  it("usa la tienda de turno del día y su disponibilidad", () => {
    const basket = [
      { customerId: "c1", productId: "uva", quantity: 1 },
      { customerId: "c1", productId: "gambas", quantity: 0.5 },
    ];
    // Día con frutería B (sin uva) y Pescados Ferrer (sin gambas)
    const plan = planOrdersForDay(
      baseInput({
        day: { id: "day-2", date: "2026-10-27", fruteriaId: SHOPS.fruB, pescaderiaId: SHOPS.pesFerrer },
        basket: [...basket, { customerId: "c1", productId: "naranjas", quantity: 2 }],
      }),
    );
    expect(plan.orders[0].shops.map((s) => s.shopId)).toEqual([SHOPS.fruB]);
    expect(plan.orders[0].skippedItems).toEqual([
      { productId: "uva", productName: "uva", reason: "no_disponible" },
      { productId: "gambas", productName: "gambas", reason: "no_disponible" },
    ]);

    // El mismo pedido otro día, con las tiendas que sí los tienen
    const otherDay = planOrdersForDay(baseInput({ basket }));
    expect(otherDay.orders[0].skippedItems).toEqual([]);
    expect(otherDay.orders[0].shops.map((s) => s.shopId).sort()).toEqual([SHOPS.fruA, SHOPS.pesTomas].sort());
  });

  it("trata como no disponible un producto sin fila de disponibilidad", () => {
    const plan = planOrdersForDay(
      baseInput({
        availability: availability.filter((a) => !(a.shopId === SHOPS.fruA && a.productId === "tomate")),
        basket: [
          { customerId: "c1", productId: "tomate", quantity: 1 },
          { customerId: "c1", productId: "naranjas", quantity: 1 },
        ],
      }),
    );
    expect(plan.orders[0].skippedItems.map((s) => s.reason)).toEqual(["no_disponible"]);
  });

  it("salta los productos retirados del catálogo y las carnicerías inactivas", () => {
    const plan = planOrdersForDay(
      baseInput({
        products: products.map((p) => (p.id === "naranjas" ? { ...p, active: false } : p)),
        activeShopIds: Object.values(SHOPS).filter((id) => id !== SHOPS.reino),
        basket: [
          { customerId: "c1", productId: "naranjas", quantity: 1 },
          { customerId: "c1", productId: "lomo", quantity: 1 },
          { customerId: "c1", productId: "hamburguesas", quantity: 1 },
        ],
      }),
    );
    expect(plan.orders[0].shops.map((s) => s.shopId)).toEqual([SHOPS.oskinez]);
    expect(plan.orders[0].skippedItems.map((s) => [s.productId, s.reason])).toEqual([
      ["naranjas", "producto_retirado"],
      ["lomo", "sin_tienda"],
    ]);
  });

  it("salta el pescado si ese día no hay pescadería de turno", () => {
    const plan = planOrdersForDay(
      baseInput({
        day: { id: "day-3", date: "2026-10-27", fruteriaId: SHOPS.fruA, pescaderiaId: null },
        basket: [
          { customerId: "c1", productId: "merluza", quantity: 1 },
          { customerId: "c1", productId: "naranjas", quantity: 1 },
        ],
      }),
    );
    expect(plan.orders[0].skippedItems).toEqual([{ productId: "merluza", productName: "merluza", reason: "sin_tienda" }]);
  });

  it("solo genera pedidos para los clientes a los que les toca ese día", () => {
    const plan = planOrdersForDay(
      baseInput({
        customers: [
          customer("semanal"),
          customer("quincenal", {
            subscription: { status: "activa", frequency: "quincenal", deliveryWeekday: 2, anchorDate: "2026-10-20" },
          }),
          customer("viernes", {
            subscription: { status: "activa", frequency: "semanal", deliveryWeekday: 5, anchorDate: "2026-10-23" },
          }),
          customer("pausada", {
            subscription: { status: "pausada", frequency: "semanal", deliveryWeekday: 2, anchorDate: "2026-10-20" },
          }),
        ],
        basket: ["semanal", "quincenal", "viernes", "pausada"].map((customerId) => ({
          customerId,
          productId: "naranjas",
          quantity: 1,
        })),
      }),
    );
    expect(plan.orders.map((o) => o.customerId)).toEqual(["semanal"]);
    expect(plan.skippedCustomers).toEqual([]);
  });

  it("informa de los clientes que se quedan sin pedido", () => {
    const plan = planOrdersForDay(
      baseInput({
        customers: [customer("vacia"), customer("sin-stock"), customer("sin-dir", { address: "  " }), customer("ok")],
        basket: [
          { customerId: "sin-stock", productId: "gambas", quantity: 1 },
          { customerId: "sin-dir", productId: "naranjas", quantity: 1 },
          { customerId: "ok", productId: "naranjas", quantity: 1 },
        ],
        day: { id: "day-4", date: "2026-10-27", fruteriaId: SHOPS.fruA, pescaderiaId: SHOPS.pesFerrer },
      }),
    );
    expect(plan.orders.map((o) => o.customerId)).toEqual(["ok"]);
    expect(plan.skippedCustomers).toEqual([
      { customerId: "sin-dir", reason: "sin_direccion" },
      { customerId: "sin-stock", reason: "sin_productos" },
      { customerId: "vacia", reason: "cesta_vacia" },
    ]);
  });

  it("solo prepara los repartos que el cliente ha confirmado", () => {
    const plan = planOrdersForDay(
      baseInput({
        customers: [
          customer("confirmado"),
          customer("sin-confirmar", { confirmed: false }),
          // Confirmó un día que no le toca: no cuenta
          customer("viernes", {
            subscription: { status: "activa", frequency: "semanal", deliveryWeekday: 5, anchorDate: "2026-10-23" },
          }),
        ],
        basket: ["confirmado", "sin-confirmar", "viernes"].map((customerId) => ({
          customerId,
          productId: "naranjas",
          quantity: 1,
        })),
      }),
    );
    expect(plan.orders.map((o) => o.customerId)).toEqual(["confirmado"]);
    expect(plan.skippedCustomers).toEqual([{ customerId: "sin-confirmar", reason: "sin_confirmar" }]);
  });

  it("2 veces por semana: cada día se confirma por separado", () => {
    const plan = planOrdersForDay(
      baseInput({
        customers: [
          customer("doble", {
            subscription: { status: "activa", frequency: "dos_por_semana", deliveryWeekday: 2, anchorDate: "2026-10-20" },
            confirmed: false,
          }),
        ],
        basket: [{ customerId: "doble", productId: "naranjas", quantity: 1, slot: 2 }],
      }),
    );
    expect(plan.orders).toEqual([]);
    expect(plan.skippedCustomers).toEqual([{ customerId: "doble", reason: "sin_confirmar" }]);
  });

  it("aplica el pedido mínimo", () => {
    const input = baseInput({ basket: [{ customerId: "c1", productId: "naranjas", quantity: 2 }] }); // 3,20 €
    expect(planOrdersForDay({ ...input, minOrderCents: 320 }).orders).toHaveLength(1);
    const plan = planOrdersForDay({ ...input, minOrderCents: 1500 });
    expect(plan.orders).toHaveLength(0);
    expect(plan.skippedCustomers).toEqual([{ customerId: "c1", reason: "pedido_minimo", totalCents: 320 }]);
  });

  it("copia los datos de entrega del cliente", () => {
    const plan = planOrdersForDay(
      baseInput({
        customers: [customer("c1", { name: "Lucía", address: "  Avinguda Luis Suñer 5  " })],
        basket: [{ customerId: "c1", productId: "naranjas", quantity: 1 }],
      }),
    );
    expect(plan.orders[0]).toMatchObject({
      customerName: "Lucía",
      address: "Avinguda Luis Suñer 5",
      postalCode: "46600",
      phone: "600000000",
    });
  });
});

describe("planes de 2 veces por semana y de pago por envío", () => {
  const twiceWeekly = customer("doble", {
    subscription: { status: "activa", frequency: "dos_por_semana", deliveryWeekday: 2, anchorDate: "2026-10-20" },
  });
  const perDelivery = (requested: boolean) =>
    customer("suelto", {
      subscription: { status: "activa", frequency: "por_envio", deliveryWeekday: 2, anchorDate: "2026-10-20" },
      confirmed: requested,
    });

  it("2 veces por semana: el martes va la cesta del martes y el viernes la del viernes", () => {
    const basket = [
      { customerId: "doble", productId: "naranjas", quantity: 1, slot: 2 },
      { customerId: "doble", productId: "merluza", quantity: 1, slot: 5 },
      { customerId: "doble", productId: "lomo", quantity: 1, slot: 0 },
    ];
    const tuesday = planOrdersForDay(baseInput({ customers: [twiceWeekly], basket }));
    expect(tuesday.orders[0].shops.flatMap((s) => s.items.map((i) => i.productId))).toEqual(["naranjas"]);

    const friday = planOrdersForDay(
      baseInput({
        customers: [twiceWeekly],
        basket,
        day: { id: "day-fri", date: "2026-10-23", fruteriaId: SHOPS.fruA, pescaderiaId: SHOPS.pesTomas },
      }),
    );
    expect(friday.orders[0].shops.flatMap((s) => s.items.map((i) => i.productId))).toEqual(["merluza"]);
    expect(friday.orders[0].deliveryFeeCents).toBe(0);
  });

  it("2 veces por semana: si la cesta de ese día está vacía, no hay pedido", () => {
    const plan = planOrdersForDay(
      baseInput({ customers: [twiceWeekly], basket: [{ customerId: "doble", productId: "naranjas", quantity: 1, slot: 5 }] }),
    );
    expect(plan.orders).toEqual([]);
    expect(plan.skippedCustomers).toEqual([{ customerId: "doble", reason: "cesta_vacia" }]);
  });

  it("pago por envío: solo hay pedido si lo ha pedido, y lleva los gastos de envío", () => {
    const basket = [{ customerId: "suelto", productId: "naranjas", quantity: 2 }];
    const notRequested = planOrdersForDay(baseInput({ customers: [perDelivery(false)], basket, deliveryFeeCents: 600 }));
    expect(notRequested.orders).toEqual([]);
    expect(notRequested.skippedCustomers).toEqual([]);

    const requested = planOrdersForDay(baseInput({ customers: [perDelivery(true)], basket, deliveryFeeCents: 600 }));
    expect(requested.orders).toHaveLength(1);
    expect(requested.orders[0]).toMatchObject({ estimatedTotalCents: 320, deliveryFeeCents: 600 });
  });

  it("pago por envío: el pedido mínimo cuenta solo los productos", () => {
    const basket = [{ customerId: "suelto", productId: "naranjas", quantity: 2 }]; // 3,20 €
    const plan = planOrdersForDay(
      baseInput({ customers: [perDelivery(true)], basket, deliveryFeeCents: 600, minOrderCents: 500 }),
    );
    expect(plan.skippedCustomers).toEqual([{ customerId: "suelto", reason: "pedido_minimo", totalCents: 320 }]);
  });

  it("los planes con cuota no pagan envío", () => {
    const plan = planOrdersForDay(
      baseInput({ basket: [{ customerId: "c1", productId: "naranjas", quantity: 1 }], deliveryFeeCents: 600 }),
    );
    expect(plan.orders[0].deliveryFeeCents).toBe(0);
  });

  it("un pago por envío pausado o cancelado no recibe nada aunque lo pidiera", () => {
    const cancelled = customer("suelto", {
      subscription: { status: "cancelada", frequency: "por_envio", deliveryWeekday: 2, anchorDate: "2026-10-20" },
      confirmed: true,
    });
    const plan = planOrdersForDay(
      baseInput({ customers: [cancelled], basket: [{ customerId: "suelto", productId: "naranjas", quantity: 1 }] }),
    );
    expect(plan.orders).toEqual([]);
  });
});

describe("importe final con el peso real", () => {
  it("usa la cantidad real cuando la tienda la indica", () => {
    expect(
      finalTotalCents([
        { quantityOrdered: 1, quantityActual: 1.12, unitPriceCents: 1490 }, // 16,688 → 16,69
        { quantityOrdered: 2, quantityActual: null, unitPriceCents: 650 }, // 13,00
      ]),
    ).toBe(1669 + 1300);
  });

  it("una cantidad real de cero no se cobra", () => {
    expect(finalTotalCents([{ quantityOrdered: 1, quantityActual: 0, unitPriceCents: 1490 }])).toBe(0);
  });
});
