import { expect, test, type Page } from "@playwright/test";

const RUTAS = ["/", "/servicios", "/servicios/comparar", "/servicios/c1", "/servicios/c6", "/servicios/c7", "/servicios/c8", "/avisos", "/avisos/fallos", "/registro", "/luz", "/mantenimiento", "/mantenimiento/central", "/conexiones", "/sistema", "/notificaciones", "/naves", "/informe", "/turno", "/buscar", "/recepcion", "/pared"];

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
  await page.getByRole("button", { name: "Demostración" }).click();
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

test("la gráfica cambia de periodo", async ({ page }) => {
  await entrar(page);
  await page.goto("/servicios/c1");
  await expect(page.getByRole("heading", { name: "Últimas 24 horas" })).toBeVisible();
  for (const [boton, titulo] of [["1 h", "Última hora"], ["7 días", "Últimos 7 días"], ["30 días", "Últimos 30 días"]]) {
    await page.getByRole("button", { name: boton, exact: true }).click();
    await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
    await expect(page.locator(".gx-grafica")).toBeVisible();
    expect(await desborde(page)).toBeLessThanOrEqual(0);
  }
});

test("una alarma pasa de nueva a vista, en curso y resuelta", async ({ page }) => {
  // La alarma entra en la lista de avisos al cambiar el minuto.
  test.setTimeout(120_000);
  await entrar(page);
  await page.goto("/servicios/c1");
  await page.getByRole("button", { name: "Parar el compresor" }).click();
  await expect(page.locator(".gx-alerta")).toBeVisible();
  await page.goto("/avisos");
  const alarma = page.locator(".gx-suceso").first();
  await expect(alarma).toContainText("Nueva", { timeout: 75_000 });
  await alarma.getByRole("button", { name: "Marcar como vista" }).click();
  await expect(alarma).toContainText("Vista");
  await alarma.getByRole("combobox").selectOption("Técnico de guardia");
  await expect(alarma).toContainText("En curso");
  await alarma.getByPlaceholder("Qué era: la causa").fill("Saltó el térmico");
  await alarma.getByRole("button", { name: "Dar por resuelta" }).click();
  await expect(alarma).toContainText("Resuelta");
  await expect(alarma).toContainText("Saltó el térmico");
});

test("el muelle no enseña compresor ni deja pararlo", async ({ page }) => {
  await entrar(page);
  await page.goto("/servicios/c7");
  await expect(page.getByText("De la central", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Parar el compresor" })).toHaveCount(0);
});

test("sistema comprueba la cadena y señala un corte", async ({ page }) => {
  await entrar(page);
  await page.goto("/sistema");
  await expect(page.locator(".gx-compro").first()).toContainText("Pasarela de la nave · Bien");
  await expect(page.locator(".gx-cifras")).toContainText("ms");
  await page.getByRole("link", { name: "Esquema de conexiones" }).click();
  await page.getByRole("button", { name: "Probar un corte" }).first().click();
  await page.getByRole("link", { name: "Sistema" }).first().click();
  await expect(page.locator(".gx-compro").first()).toContainText("Pasarela de la nave · Falla");
  await page.getByRole("button", { name: /Solo lo que hay que mirar/ }).click();
  await expect(page.locator(".gx-compro").first()).not.toContainText("Origen de los datos");
});

test("luz dice si el precio es real y de dónde sale", async ({ page }) => {
  await entrar(page);
  await page.goto("/luz");
  await expect(page.locator(".gx-origen")).toContainText("De dónde sale");
  await expect(page.locator(".gx-vivo")).toContainText(/Precio (real, en vivo|simulado)/);
  await page.getByRole("button", { name: "Mañana", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Precio de mañana por horas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan de mañana" })).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
});

test("comparar servicios deja elegir hasta tres", async ({ page }) => {
  await entrar(page);
  await page.goto("/servicios");
  await page.getByRole("link", { name: "Comparar" }).click();
  await expect(page.locator(".gx-tabla tbody tr")).toHaveCount(2);
  await page.getByLabel("Cámara 4").check();
  await expect(page.locator(".gx-tabla tbody tr")).toHaveCount(3);
  await expect(page.getByLabel("Antecámara")).toBeDisabled();
  await page.getByRole("button", { name: "7 días", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Últimos 7 días" })).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
});

test("avisos se filtran por periodo y servicio y se exportan", async ({ page }) => {
  await entrar(page);
  await page.goto("/avisos");
  await page.getByRole("button", { name: "7 días", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Últimos 7 días" })).toBeVisible();
  await page.getByLabel("Servicio", { exact: true }).selectOption("c4");
  await expect(page.locator(".gx-lista").first()).not.toContainText("Cámara 1");
  const [archivo] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar" }).click()]);
  expect(archivo.suggestedFilename()).toBe("gradiox-avisos-7dias.csv");
  expect(await desborde(page)).toBeLessThanOrEqual(0);
});

test("el horario de silencio se activa y se recuerda", async ({ page }) => {
  await entrar(page);
  await page.goto("/notificaciones");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("switch", { name: /Horario de silencio/ }).check();
  await expect(page.getByLabel("Desde")).toHaveValue("22:00");
  await page.reload();
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByRole("switch", { name: /Horario de silencio/ })).toBeChecked();
});

test("una orden de trabajo se crea, sale en el calendario y al cerrarla pasa al libro", async ({ page }) => {
  await entrar(page);
  await page.goto("/mantenimiento");
  await page.getByRole("button", { name: "Nueva orden de trabajo" }).click();
  await page.getByLabel("Qué hay que hacer").fill("Cambiar la goma de la puerta");
  await page.getByLabel("Quién lo lleva").fill("Técnico de zona");
  await page.getByRole("button", { name: "Crear la orden" }).click();
  await expect(page.locator(".gx-ordenes")).toContainText("Cambiar la goma de la puerta");
  await page.getByRole("button", { name: "Ver en calendario" }).click();
  await expect(page.locator(".gx-mes")).toBeVisible();
  await expect(page.locator(".gx-mes button.hoy .puntos i.orden")).toHaveCount(1);
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Cerrar la orden" }).click();
  await page.getByRole("button", { name: "Cerrar y apuntar en el libro" }).click();
  await expect(page.locator(".gx-ordenes")).toHaveCount(0);
  await expect(page.getByText("Cambiar la goma de la puerta").first()).toBeVisible();
});

test("un corte restablecido queda en el histórico", async ({ page }) => {
  await entrar(page);
  await page.goto("/conexiones");
  await page.getByRole("button", { name: "Probar un corte" }).first().click();
  await page.getByRole("button", { name: "Restablecer" }).first().click();
  await expect(page.locator(".gx-cortes")).toContainText("Recuperado");
  expect(await desborde(page)).toBeLessThanOrEqual(0);
});

test("la portada sin sesión es la presentación y lleva a entrar", async ({ page }) => {
  const errores = vigilar(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/presentacion$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("El frío, bajo control");
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(errores).toEqual([]);
});

test("la ficha de un equipo se rellena y se recuerda", async ({ page }) => {
  await entrar(page);
  await page.goto("/mantenimiento/c1-comp");
  await expect(page.getByText("Sin datos todavía")).toBeVisible();
  await page.getByRole("button", { name: "Rellenar" }).click();
  await page.getByLabel("Marca").fill("Marca de prueba");
  await page.getByLabel("Refrigerante").fill("R-449A");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.reload();
  await expect(page.locator(".gx-datos")).toContainText("Marca de prueba");
  await expect(page.locator(".gx-datos")).toContainText("Sin apuntar");
});

test("una nota del servicio se apunta y se borra", async ({ page }) => {
  await entrar(page);
  await page.goto("/servicios/c2");
  await page.getByLabel("Nota nueva").fill("La puerta roza al cerrar");
  await page.getByRole("button", { name: "Apuntar" }).click();
  await expect(page.locator(".gx-notas")).toContainText("La puerta roza al cerrar");
  await page.getByRole("button", { name: /Borrar la nota/ }).click();
  await expect(page.locator(".gx-notas")).toHaveCount(0);
});

test("el relevo queda apuntado con quien entra", async ({ page }) => {
  await entrar(page);
  await page.goto("/turno");
  await expect(page.getByText("Aún no se ha dado ningún relevo")).toBeVisible();
  await page.getByLabel("Quién entra").fill("Marta");
  await page.getByRole("button", { name: "Enterado, entro yo" }).click();
  await expect(page.locator(".gx-relevos")).toContainText("Marta");
  await page.reload();
  await expect(page.locator(".gx-relevos")).toContainText("Marta");
  await expect(page.getByText(/Último relevo: Marta/)).toBeVisible();
});

test("la ronda se marca, admite una nota y se ve en Hoy", async ({ page }) => {
  await entrar(page);
  await page.goto("/turno");
  await page.getByRole("button", { name: "Bien: Gomas y cierres de las puertas" }).click();
  await page.getByRole("button", { name: "Hay que mirarlo: Hielo en los evaporadores" }).click();
  await page.getByLabel("Qué pasa en: Hielo en los evaporadores").fill("Mucho hielo en la cámara 2");
  await page.getByLabel("Qué pasa en: Hielo en los evaporadores").blur();
  await expect(page.locator("#ronda")).toContainText("2 de 6");
  await page.reload();
  await expect(page.locator("#ronda")).toContainText("Mucho hielo en la cámara 2");
  await page.getByRole("button", { name: "Cambiar los puntos" }).click();
  await page.getByLabel("Punto nuevo de la ronda").fill("Luces de emergencia");
  await page.getByRole("button", { name: "Añadir" }).click();
  await page.getByRole("button", { name: "Hecho" }).click();
  await expect(page.locator("#ronda")).toContainText("2 de 7");
});

test("el buscador encuentra servicios, equipos y pantallas", async ({ page }) => {
  await entrar(page);
  await page.goto("/buscar");
  await page.getByLabel("Qué buscas").fill("camara 2");
  await expect(page.locator(".gx-hallazgos").first()).toContainText("Cámara 2");
  await page.getByLabel("Qué buscas").fill("zzzz");
  await expect(page.getByText("Nada con «zzzz»")).toBeVisible();
  await page.getByLabel("Qué buscas").fill("precio");
  await page.getByRole("link", { name: /Luz/ }).first().click();
  await expect(page).toHaveURL(/\/luz$/);
});

test("una entrada de mercancía se apunta, se compara con el límite y sale en el relevo", async ({ page }) => {
  await entrar(page);
  await page.goto("/recepcion?servicio=c1");
  await expect(page.getByText("Aún no hay ninguna")).toBeVisible();
  await page.getByLabel("Qué llega").fill("Pescado congelado");
  await page.getByLabel("Temperatura medida (°C)").fill("frío");
  await page.getByRole("button", { name: "Apuntar la entrada" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Escribe la temperatura" })).toBeVisible();
  await page.getByLabel("Temperatura medida (°C)").fill("-9,5");
  await page.getByRole("button", { name: "Apuntar la entrada" }).click();
  await expect(page.locator(".gx-entradas")).toContainText("Pescado congelado");
  await expect(page.locator(".gx-entradas")).toContainText("Por encima del límite");
  await page.reload();
  await expect(page.locator(".gx-entradas")).toContainText("Pescado congelado");
  await page.goto("/turno");
  await expect(page.locator(".gx-relevo")).toContainText("1 entrada de mercancía en este turno");
  await expect(page.locator(".gx-relevo")).toContainText("por encima del límite: Pescado congelado");
  await page.goto("/servicios/c1");
  await expect(page.getByText("Pescado congelado")).toBeVisible();
});

test("la pantalla de pared enseña los servicios sin menús y cambia de panel", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page);
  await page.goto("/pared");
  await expect(page.locator(".gx-pared-rejilla li")).toHaveCount(8);
  await expect(page.locator(".gx-lado")).toHaveCount(0);
  await page.getByRole("button", { name: "Qué hay pendiente" }).click();
  await expect(page.getByRole("heading", { name: "Órdenes de trabajo abiertas" })).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: "Salir de la pantalla de pared" }).click();
  await expect(page).toHaveURL(/\/servicios$/);
  expect(errores).toEqual([]);
});
