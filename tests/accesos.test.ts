import { beforeAll, describe, expect, it } from "vitest";
import { accesosEnMemoria } from "../src/accesos/almacen";
import { claveCorrecta, huellaClave, leerAccion, nuevaClave, type AccesoGuardado } from "../src/accesos/modelo";
import { puedeVer, quienEs, veDemo } from "../src/accesos/quien";
import { GALLETA, crearSesion, crearSesionCliente, leerSesion } from "../src/lib/sesion";
import { ubicarCon } from "../src/vivo/consulta";
import { porUbicacion, type InstalacionViva } from "../src/vivo/modelo";

const C = { usuario: "equipo", clave: "clave-del-equipo-de-prueba" };
const CLIENTE = "5a63ac32-0ce1-4e9a-a665-e1842970140a";
const ID = "11111111-2222-4333-8444-555555555555";

beforeAll(() => {
  process.env.GRADIOX_USUARIO = C.usuario;
  process.env.GRADIOX_CLAVE = C.clave;
});

const acceso = async (o: Partial<AccesoGuardado> = {}): Promise<AccesoGuardado> => ({ id: ID, cliente: CLIENTE, usuario: "antonio.rgv", nombre: "Antonio", demo: true, activo: true, version: 1, creado: 1, ultimo: null, pideClave: null, huella: await huellaClave("una-clave-larga"), ...o });
const peticion = (galleta: string) => new Request("https://gradiox.com/api/instalaciones", { headers: { cookie: `otra=1; ${GALLETA}=${encodeURIComponent(galleta)}` } });

describe("contraseñas", () => {
  it("guarda la huella y no la contraseña", async () => {
    const h = await huellaClave("una-clave-larga");
    expect(h).not.toContain("una-clave-larga");
    expect(await claveCorrecta("una-clave-larga", h)).toBe(true);
    expect(await claveCorrecta("otra", h)).toBe(false);
    expect(nuevaClave()).toMatch(/^[A-Za-z2-9]{5}-[A-Za-z2-9]{5}-[A-Za-z2-9]{4}$/);
  });
});

describe("sesiones", () => {
  it("distingue al equipo del usuario de un cliente y no deja falsificar la galleta", async () => {
    expect(await leerSesion(await crearSesion(C), C)).toEqual({ tipo: "equipo" });
    const g = await crearSesionCliente(C, ID, 3);
    expect(await leerSesion(g, C)).toEqual({ tipo: "cliente", id: ID, version: 3 });
    expect(await leerSesion(g.replace(".3.", ".4."), C)).toBeNull();
    expect(await leerSesion(g, { ...C, clave: "otra-clave" })).toBeNull();
    expect(await leerSesion(await crearSesionCliente(C, ID, 1, Date.now() - 8 * 86_400_000), C)).toBeNull();
  });

  it("deja de valer al cambiar la contraseña o desactivarlo", async () => {
    const a = accesosEnMemoria();
    await a.crear(await acceso());
    const g = await crearSesionCliente(C, ID, 1);
    const q = await quienEs(peticion(g), a);
    expect(q?.tipo).toBe("cliente");
    expect(q && "acceso" in q && "huella" in q.acceso).toBe(false);
    await a.cambiar(ID, { huella: await huellaClave("otra-clave-larga"), subirVersion: true });
    expect(await quienEs(peticion(g), a)).toBeNull();
    const g2 = await crearSesionCliente(C, ID, 2);
    expect((await quienEs(peticion(g2), a))?.tipo).toBe("cliente");
    await a.cambiar(ID, { activo: false });
    expect(await quienEs(peticion(g2), a)).toBeNull();
  });
});

describe("qué ve cada uno", () => {
  it("el cliente solo sus instalaciones; el equipo todas", async () => {
    const q = { tipo: "cliente" as const, acceso: { ...(await acceso()), huella: undefined } as never };
    expect(puedeVer(q, { cliente: CLIENTE })).toBe(true);
    expect(puedeVer(q, { cliente: "otro" })).toBe(false);
    expect(puedeVer(q, {})).toBe(false);
    expect(puedeVer({ tipo: "equipo" }, {})).toBe(true);
    expect(veDemo({ tipo: "equipo" })).toBe(true);
  });
});

describe("almacén de accesos", () => {
  it("no repite usuarios y apunta quién pide contraseña", async () => {
    const a = accesosEnMemoria();
    expect(await a.crear(await acceso())).not.toBeNull();
    expect(await a.crear(await acceso({ id: "99999999-2222-4333-8444-555555555555" }))).toBeNull();
    expect(await a.pedirClave("nadie", 5)).toBe(false);
    expect(await a.pedirClave("antonio.rgv", 5)).toBe(true);
    expect((await a.pendientes()).map((x) => x.usuario)).toEqual(["antonio.rgv"]);
    await a.cambiar(ID, { huella: await huellaClave("nueva-clave-larga"), subirVersion: true });
    expect(await a.pendientes()).toEqual([]);
  });

  it("entiende lo que pide el panel", () => {
    expect(leerAccion({ accion: "crear", usuario: " Antonio.RGV ", nombre: "Antonio" })).toEqual({ accion: "crear", usuario: "antonio.rgv", nombre: "Antonio", demo: true });
    expect(leerAccion({ accion: "crear", usuario: "a b" })).toHaveProperty("error");
    expect(leerAccion({ accion: "ubicacion", pasarela: "p1", ubicacion: "u1" })).toEqual({ accion: "ubicacion", pasarela: "p1", ubicacion: "u1" });
  });
});

describe("ubicaciones", () => {
  const inst = (id: string, extra: Partial<InstalacionViva> = {}): InstalacionViva => ({ id, nombre: id, cliente: null, ubicacion: { id, nombre: id }, simulada: false, entrega: 10, conectada: true, servicios: [], compresores: [], ...extra });
  it("junta las instalaciones de una misma ubicación del cliente", () => {
    const ubicar = ubicarCon([{ id: CLIENTE, nombre: "RGV Refrigeración", instalaciones: [{ id: "alvedro", nombre: "Nave de Alvedro" }] }]);
    const a = { ...inst("p1"), ...ubicar({ id: "p1", nombre: "p1", cliente: CLIENTE, ubicacion: "alvedro" } as never) };
    const b = { ...inst("p2", { conectada: false, entrega: 20 }), ...ubicar({ id: "p2", nombre: "p2", cliente: CLIENTE, ubicacion: "alvedro" } as never) };
    const c = { ...inst("p3"), ...ubicar({ id: "p3", nombre: "p3" } as never) };
    const ubs = porUbicacion([a, b, c]);
    expect(ubs.map((u) => u.nombre)).toEqual(["Nave de Alvedro", "p3"]);
    expect(ubs[0]).toMatchObject({ cliente: { nombre: "RGV Refrigeración" }, conectada: false, entrega: 20 });
    expect(ubs[0].instalaciones.map((i) => i.id)).toEqual(["p1", "p2"]);
  });
});

// Con un Postgres de pruebas (GRADIOX_PRUEBA_BASE_URL, nunca uno real), el mismo contrato en base de datos.
const urlPrueba = process.env.GRADIOX_PRUEBA_BASE_URL;
(urlPrueba ? describe : describe.skip)("accesos en base de datos", () => {
  it("crea, cambia, apunta peticiones y borra", async () => {
    const { accesosPostgres } = await import("../src/accesos/almacen");
    const a = accesosPostgres(urlPrueba!);
    const id = crypto.randomUUID();
    const usuario = `prueba.${id.slice(0, 8)}`;
    try {
      const creado = await a.crear({ ...(await acceso()), id, usuario });
      expect(creado).toMatchObject({ id, usuario, version: 1, pideClave: null });
      expect(await a.crear({ ...(await acceso()), id: crypto.randomUUID(), usuario })).toBeNull();
      expect(await a.pedirClave(usuario, 123)).toBe(true);
      expect((await a.pendientes()).some((x) => x.id === id && x.pideClave === 123)).toBe(true);
      const sinClave = await a.cambiar(id, { demo: false });
      expect(sinClave).toMatchObject({ demo: false, version: 1, pideClave: 123 });
      const cambiado = await a.cambiar(id, { huella: await huellaClave("otra-clave-larga"), subirVersion: true });
      expect(cambiado).toMatchObject({ version: 2, pideClave: null, demo: false });
      await a.entro(id, 999);
      expect((await a.porUsuario(usuario))?.ultimo).toBe(999);
      expect((await a.deCliente(CLIENTE)).some((x) => x.id === id)).toBe(true);
      expect(await a.borrar(id)).toBe(true);
      expect(await a.leer(id)).toBeNull();
    } finally {
      await a.cerrar();
    }
  });
});
