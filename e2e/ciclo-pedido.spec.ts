import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = process.env.SEED_PASSWORD ?? "cistella-demo";

// Next mantiene montadas (ocultas) las páginas anteriores: se trabaja siempre con el <main> visible
const main = (page: Page) => page.locator("main:visible");

async function login(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/entrar");
  await main(page).getByLabel("Email", { exact: true }).fill(email);
  await main(page).getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await main(page).getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  return page;
}

test("ciclo completo: el visitante llena la cesta, crea la cuenta al confirmar, cierre, preparación, reparto y entrega", async ({
  page,
  browser,
}) => {
  const email = `e2e-${Date.now()}@cistella.test`;
  const name = `Cliente E2E ${Date.now() % 10000}`;

  // 1. Sin cuenta: ve la tienda y llena la cesta (fruta del catálogo unificado y carne de una carnicería)
  await page.goto("/");
  await expect(main(page).getByRole("heading", { name: "Productos de temporada" })).toBeVisible();
  await page.goto("/categorias/fruta");
  await main(page).getByRole("button", { name: "Añadir Naranjas de zumo" }).click();
  await expect(main(page).getByRole("group", { name: "Cantidad de Naranjas de zumo" })).toBeVisible();
  await page.goto("/buscar?q=lomo");
  await main(page).getByRole("button", { name: "Añadir Lomo de cerdo" }).click();
  await expect(main(page).getByRole("group", { name: "Cantidad de Lomo de cerdo" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Mi cesta: 2 productos/ })).toBeVisible();

  // 2. Al confirmar el pedido: crea la cuenta, pone sus datos y elige el plan
  await page.goto("/cesta");
  await main(page).getByRole("link", { name: "Confirmar pedido" }).click();
  await page.waitForURL("**/registro**");
  await main(page).getByLabel("Nombre y apellidos").fill(name);
  await main(page).getByLabel("Email", { exact: true }).fill(email);
  await main(page).getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await main(page).getByRole("checkbox").check();
  await main(page).getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/bienvenida?confirmar=1");

  await main(page).getByLabel("Teléfono").fill("611222333");
  await main(page).getByLabel("Dirección de entrega").fill("Carrer Major 10, 3º");
  await main(page).getByLabel("Código postal").fill("46600");
  await main(page).getByRole("button", { name: "Continuar" }).click();

  await expect(main(page).getByRole("heading", { name: "Elige tu plan" })).toBeVisible();
  await main(page).getByRole("radio", { name: /^Cada semana/ }).check();
  await main(page).getByRole("radio", { name: /^Martes/ }).check();
  await main(page).getByRole("button", { name: /Activar plan|Continuar al pago/ }).click();

  // Vuelve a su cesta (la que llenó sin cuenta) y el pedido queda confirmado solo
  await page.waitForURL("**/cesta?confirmar=1");
  const confirmed = main(page).getByText(/Pedido confirmado para el martes/);
  await expect(confirmed).toBeVisible();
  const deliveryDay = (await confirmed.textContent())!.replace(/^.*Pedido confirmado para el /, "").trim();
  expect(deliveryDay).toMatch(/^martes/i);
  await expect(page.getByRole("link", { name: /^Mi cesta: 2 productos/ })).toBeVisible();

  // 3. El admin cierra ese reparto y se generan los pedidos por tienda
  const admin = await login(browser, "admin@cistella.test");
  admin.on("dialog", (dialog) => dialog.accept());
  await admin.goto("/admin/dias");
  await main(admin).getByRole("link", { name: new RegExp(deliveryDay, "i") }).first().click();
  await main(admin).getByRole("button", { name: "Cerrar ahora y generar pedidos" }).click();
  await expect(main(admin).getByText(/generados el/)).toBeVisible();
  const dayUrl = admin.url();
  const dayId = dayUrl.split("/").pop()!;

  // 4. La carnicería prepara su parte con el peso real
  const butcher = await login(browser, "reino@cistella.test");
  await butcher.goto(`/tienda?dia=${dayId}`);
  const part = main(butcher).locator("li").filter({ hasText: name });
  await part.getByLabel(/Cantidad real de Lomo de cerdo/).fill("0,55");
  await part.getByRole("button", { name: "Marcar preparado" }).click();
  await expect(part.getByText("Preparado")).toBeVisible();

  // 5. Reparto: recoger en las tiendas y entregar
  await admin.goto(`/admin/reparto?dia=${dayId}`);
  const pickups = main(admin).getByRole("button", { name: "Recogido en la tienda" });
  for (let remaining = await pickups.count(); remaining > 0; remaining--) {
    await pickups.first().click();
    await expect(pickups).toHaveCount(remaining - 1);
  }
  const delivery = main(admin).locator("li").filter({ hasText: name });
  await delivery.getByRole("button", { name: "Entregado" }).click();
  await expect(delivery.getByText("Entregado", { exact: true })).toBeVisible();

  // 6. El cliente ve su pedido entregado con el peso real
  await page.goto("/pedidos");
  await main(page).getByRole("link", { name: new RegExp(deliveryDay, "i") }).click();
  await expect(main(page).getByText("Entregado").first()).toBeVisible();
  await expect(main(page).getByText(/0,55 kg reales/)).toBeVisible();
});

test("envío automático: el reparto se prepara sin confirmar y la cesta vuelve a ser la guardada", async ({ browser }) => {
  const basketName = `Semana normal ${Date.now() % 100000}`;
  const lucia = await login(browser, "lucia@cistella.test");
  lucia.on("dialog", (dialog) => dialog.accept());

  // Parte de una cesta sin gambas (las añadirá después solo para un reparto)
  await lucia.goto("/buscar?q=gambas");
  const exact = main(lucia).getByRole("button", { name: /Escribir la cantidad exacta de Gambas/ });
  if (await exact.count()) {
    await exact.click();
    await main(lucia).getByLabel("Cantidad exacta de Gambas").fill("0");
    await lucia.keyboard.press("Enter");
    await expect(main(lucia).getByRole("button", { name: "Añadir Gambas" })).toBeVisible();
  }

  // Guarda su cesta y activa el envío automático con ella
  await lucia.goto("/cesta");
  await main(lucia).getByLabel("Nombre de la cesta").fill(basketName);
  await main(lucia).getByRole("button", { name: "Crear cesta", exact: true }).click();
  await expect(main(lucia).getByText(/creada\. La tienes en Cestas/)).toBeVisible();
  await lucia.goto("/cestas-guardadas");
  await main(lucia).getByRole("link", { name: new RegExp(basketName) }).click();
  await main(lucia).getByRole("button", { name: "Activar envío automático con esta cesta" }).click();
  await expect(main(lucia).getByText(/Envío automático activado/)).toBeVisible();

  // En la cesta ya no hay que confirmar; se puede saltar y recuperar el reparto
  await lucia.goto("/cesta");
  const auto = main(lucia).getByText(/Envío automático: tu pedido del martes/);
  await expect(auto).toBeVisible();
  const deliveryDay = (await auto.textContent())!.replace(/^.*tu pedido del /, "").replace(/ se prepara solo$/, "").trim();
  await main(lucia).getByRole("button", { name: "Saltar este reparto" }).click();
  await expect(main(lucia).getByText(/Has saltado el reparto/)).toBeVisible();
  await main(lucia).getByRole("button", { name: "Recuperar este reparto" }).click();
  await expect(auto).toBeVisible();

  // Solo para este reparto, añade gambas
  await lucia.goto("/buscar?q=gambas");
  await main(lucia).getByRole("button", { name: "Añadir Gambas" }).click();
  await expect(main(lucia).getByRole("group", { name: "Cantidad de Gambas" })).toBeVisible();

  // El admin cierra el reparto: Lucía tiene pedido sin haberlo confirmado, con las gambas
  const admin = await login(browser, "admin@cistella.test");
  admin.on("dialog", (dialog) => dialog.accept());
  await admin.goto("/admin/dias");
  await main(admin).getByRole("link", { name: new RegExp(deliveryDay, "i") }).first().click();
  await expect(main(admin).getByText(/con envío automático: \d+/)).toBeVisible();
  await main(admin).getByRole("button", { name: "Cerrar ahora y generar pedidos" }).click();
  await expect(main(admin).getByText(/generados el/)).toBeVisible();
  const dayId = admin.url().split("/").pop()!;
  await admin.goto(`/admin/reparto?dia=${dayId}`);
  const order = main(admin).locator("li").filter({ hasText: "Lucía Martí" });
  await expect(order.first()).toBeVisible();

  // Después del reparto, su cesta vuelve a ser la guardada (sin las gambas)
  await lucia.goto("/buscar?q=gambas");
  await expect(main(lucia).getByRole("button", { name: "Añadir Gambas" })).toBeVisible();

  // Deja a Lucía como estaba
  await lucia.goto("/cestas-guardadas");
  await main(lucia).getByRole("link", { name: new RegExp(basketName) }).click();
  await main(lucia).getByRole("button", { name: "Quitar el envío automático" }).click();
  await expect(main(lucia).getByText(/Envío automático desactivado/)).toBeVisible();
});

test("vaciar la cesta: quita todos los productos de una vez", async ({ page }) => {
  // Visitante sin cuenta (la cesta va en una cookie): así no toca la cesta de los clientes de ejemplo
  await page.goto("/categorias/fruta");
  await main(page).getByRole("button", { name: "Añadir Naranjas de zumo" }).click();
  await expect(main(page).getByRole("group", { name: "Cantidad de Naranjas de zumo" })).toBeVisible();
  await main(page).getByRole("button", { name: "Añadir Manzana fuji" }).click();
  await expect(page.getByRole("link", { name: /^Mi cesta: 2 productos/ })).toBeVisible();

  await page.goto("/cesta");
  page.once("dialog", (dialog) => dialog.accept());
  await main(page).getByRole("button", { name: "Vaciar la cesta" }).click();
  await expect(main(page).getByText("Tu cesta está vacía")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Mi cesta: 0 productos/ })).toBeVisible();
});
