import { expect, test, type Page } from "@playwright/test";

const RUTAS = ["/", "/servicios", "/servicios/c1", "/avisos", "/avisos/fallos", "/registro", "/luz", "/mantenimiento", "/conexiones", "/notificaciones", "/naves", "/informe"];

async function entrar(page: Page) {
  await page.goto("/login");
  await page.locator("input").first().fill("prueba");
  await page.locator("input[type=password]").fill("clave-de-prueba-e2e");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("/");
}

/** Recoge los errores de consola y de página, salvo el del precio de la luz cuando no hay red. */
function vigilar(page: Page) {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("502")) errores.push(m.text());
  });
  return errores;
}

const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("sin sesión todo lleva a la entrada", async ({ page }) => {
  await page.goto("/servicios");
  await expect(page).toHaveURL(/\/login/);
});

for (const tema of ["light", "dark"] as const) {
  test(`cada pantalla carga sin errores ni desbordes, tema ${tema}`, async ({ page }) => {
    const errores = vigilar(page);
    await page.addInitScript((t) => window.localStorage.setItem("gradiox-tema", t), tema);
    await entrar(page);
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      expect(await desborde(page), `desborde en ${ruta}`).toBeLessThanOrEqual(0);
    }
    expect(errores).toEqual([]);
  });
}

test("un corte de conexión avisa en pantalla y queda en notificaciones", async ({ page }) => {
  await entrar(page);
  await page.goto("/conexiones");
  await page.getByRole("button", { name: "Probar un corte" }).first().click();
  await expect(page.locator(".gx-emergente")).toContainText("sin conexión");
  await page.getByRole("button", { name: "Ver en lista" }).click();
  await expect(page.locator(".gx-red")).toContainText("Sin conexión");
  await page.goto("/notificaciones");
  await expect(page.locator(".gx-notis")).toContainText("sin conexión");
});

test("la demostración guiada recorre la avería y la arregla", async ({ page }) => {
  await entrar(page);
  await page.getByRole("button", { name: "Ver una demostración" }).click();
  await expect(page).toHaveURL(/\/servicios\/c1/);
  await expect(page.locator(".gx-alerta")).toBeVisible();
  for (const ruta of [/\/notificaciones/, /\/avisos/, /\/mantenimiento/, /\/servicios\/c1/]) {
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(ruta);
  }
  await expect(page.locator(".gx-alerta")).toHaveCount(0);
  await page.getByRole("button", { name: "Terminar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".gx-hoy")).toContainText("Todo en orden");
});

test("enviar la orden de un fallo típico rearma el compresor", async ({ page }) => {
  await entrar(page);
  await page.goto("/servicios/c1");
  await page.getByRole("button", { name: "Parar el compresor" }).click();
  await page.getByRole("button", { name: "Enviar la orden" }).click();
  await expect(page.getByText("El compresor vuelve a marchar.")).toBeVisible();
  await expect(page.locator(".gx-alerta")).toHaveCount(0);
});

test("el tema se cambia y se recuerda", async ({ page, viewport }) => {
  await page.addInitScript(() => window.localStorage.getItem("gradiox-tema") ?? window.localStorage.setItem("gradiox-tema", "light"));
  await entrar(page);
  const boton = (viewport?.width ?? 0) > 860 ? page.getByRole("button", { name: "Tema oscuro" }) : page.getByRole("button", { name: "Cambiar a tema oscuro" });
  await boton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
