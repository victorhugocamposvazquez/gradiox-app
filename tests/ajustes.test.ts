import { beforeAll, describe, expect, it } from "vitest";
import { accesosEnMemoria, type AlmacenAccesos } from "../src/accesos/almacen";
import { huellaClave } from "../src/accesos/modelo";
import { ajustesEnMemoria, datosEquipo, type AlmacenAjustes } from "../src/ajustes/almacen";
import { clientesEnMemoria, type AlmacenClientes } from "../src/clientes/almacen";
import { clienteVacio } from "../src/clientes/modelo";
import { GALLETA, crearSesion, crearSesionCliente } from "../src/lib/sesion";
import { POST as guardarDatos } from "../src/app/api/sesion/datos/route";
import { GET as quienSoy } from "../src/app/api/sesion/route";

const C = { usuario: "equipo", clave: "clave-del-equipo-de-prueba" };
const g = globalThis as { __gradioxAccesos?: AlmacenAccesos; __gradioxClientes?: AlmacenClientes; __gradioxAjustes?: AlmacenAjustes };

beforeAll(() => {
  process.env.GRADIOX_USUARIO = C.usuario;
  process.env.GRADIOX_CLAVE = C.clave;
  g.__gradioxAccesos = accesosEnMemoria();
  g.__gradioxClientes = clientesEnMemoria();
  g.__gradioxAjustes = ajustesEnMemoria();
});

const con = (galleta: string, cuerpo?: object) =>
  new Request("https://gradiox.com/api/sesion/datos", {
    method: cuerpo ? "POST" : "GET",
    headers: { cookie: `${GALLETA}=${encodeURIComponent(galleta)}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

describe("mis datos", () => {
  it("el equipo empieza como Gradiox y guarda su nombre y empresa", async () => {
    expect(await datosEquipo(ajustesEnMemoria())).toEqual({ nombre: "Equipo de Gradiox", empresa: "Gradiox" });
    const galleta = await crearSesion(C);
    expect(await (await quienSoy(con(galleta))).json()).toMatchObject({ tipo: "equipo", empresa: "Gradiox" });
    const r = await guardarDatos(con(galleta, { nombre: "  Hugo   Campos ", empresa: "Gradiox S.L." }));
    expect(r.status).toBe(200);
    expect(await (await quienSoy(con(galleta))).json()).toMatchObject({ tipo: "equipo", nombre: "Hugo Campos", empresa: "Gradiox S.L." });
    expect((await guardarDatos(con(galleta, { nombre: "Hugo", empresa: " " }))).status).toBe(400);
  });

  it("el usuario de un cliente cambia su nombre y el de su empresa, con apunte en la ficha", async () => {
    const ficha = await g.__gradioxClientes!.crear({ ...clienteVacio(), nombre: "RGV" });
    const id = crypto.randomUUID();
    await g.__gradioxAccesos!.crear({ id, cliente: ficha.id, usuario: "antonio.rgv", nombre: "Antonio", huella: await huellaClave("una-clave-larga"), demo: true, activo: true, version: 1, creado: 1, ultimo: null, pideClave: null });
    const galleta = await crearSesionCliente(C, id, 1);
    expect(await (await quienSoy(con(galleta))).json()).toMatchObject({ tipo: "cliente", nombre: "Antonio", empresa: "RGV" });
    expect((await guardarDatos(con(galleta, { nombre: "Antonio Franco", empresa: "RGV Refrigeración" }))).status).toBe(200);
    expect(await (await quienSoy(con(galleta))).json()).toMatchObject({ nombre: "Antonio Franco", empresa: "RGV Refrigeración" });
    const guardada = await g.__gradioxClientes!.leer(ficha.id);
    expect(guardada?.nombre).toBe("RGV Refrigeración");
    expect(guardada?.historial.at(-1)?.texto).toContain("«RGV» a «RGV Refrigeración»");
  });

  it("sin sesión no deja", async () => {
    expect((await guardarDatos(new Request("https://gradiox.com/api/sesion/datos", { method: "POST", body: "{}" }))).status).toBe(401);
  });
});

// Con un Postgres de pruebas (GRADIOX_PRUEBA_BASE_URL, nunca uno real), el mismo contrato en base de datos.
const urlPrueba = process.env.GRADIOX_PRUEBA_BASE_URL;
(urlPrueba ? describe : describe.skip)("ajustes en base de datos", () => {
  it("guarda y vuelve a guardar encima", async () => {
    const { ajustesPostgres } = await import("../src/ajustes/almacen");
    const a = ajustesPostgres(urlPrueba!);
    const clave = `prueba-${crypto.randomUUID()}`;
    try {
      expect(await a.leer(clave)).toBeNull();
      await a.guardar(clave, { nombre: "Uno", empresa: "A" });
      await a.guardar(clave, { nombre: "Dos", empresa: "B" });
      expect(await a.leer(clave)).toEqual({ nombre: "Dos", empresa: "B" });
    } finally {
      await a.cerrar();
    }
  });
});
