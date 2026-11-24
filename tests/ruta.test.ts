import { describe, expect, it } from "vitest";
import { ajustesEnMemoria } from "../src/ajustes/almacen";
import { BLOQUEO_MS, MAX_FALLOS, apuntarFallo, frenadoHasta, olvidarFallos } from "../src/accesos/intentos";
import { accesosEnMemoria } from "../src/accesos/almacen";
import { quienEs } from "../src/accesos/quien";
import { clienteVacio, instalacionVacia, type Cliente } from "../src/clientes/modelo";
import { rutaDe, versionMenor } from "../src/clientes/ruta";
import { apuntarVisita, visitasSoporte } from "../src/clientes/soporte";
import { GALLETA, crearSesionSoporte, leerSesion } from "../src/lib/sesion";
import { nuevoToken, pasarelaVacia, type Pasarela } from "../src/pasarelas/modelo";
import type { Acceso } from "../src/accesos/modelo";

const AHORA = Date.UTC(2026, 10, 19, 12, 0, 0);
const ID = "5a63ac32-0ce1-4e9a-a665-e1842970140a";
const cliente = (o: Partial<Cliente> = {}): Cliente => ({ ...clienteVacio(), nombre: "RGV", id: ID, creado: 1, actualizado: 1, ...o });
const pasarela = (o: Partial<Pasarela> = {}): Pasarela => ({
  ...pasarelaVacia("Nave de Alvedro", nuevoToken(), AHORA, 365),
  id: "p1",
  creada: 1,
  actualizada: 1,
  cliente: ID,
  contacto: { t: AHORA - 10_000, programa: "0.4.1", plataforma: "windows-amd64", estado: { plc: "conectado", detalle: "", leidas: 120, total: 121, ultima: AHORA, simulado: false, pendientes: 0, ordenes: false } },
  ...o,
});
const acceso = (o: Partial<Acceso> = {}): Acceso => ({ id: "a1", cliente: ID, usuario: "antonio.rgv", nombre: "Antonio", demo: true, activo: true, version: 1, creado: 1, ultimo: null, pideClave: null, ...o });

describe("hoja de ruta de un cliente", () => {
  it("recién dado de alta, lo primero son sus datos", () => {
    const r = rutaDe(cliente(), [], [], AHORA);
    expect(r.hechos).toBe(0);
    expect(r.siguiente?.id).toBe("empresa");
    expect(r.seguimiento).toEqual([]);
    expect(r.enMarcha).toBe(false);
  });

  it("los pasos se dan por hechos con lo que hay de verdad", () => {
    const inst = { ...instalacionVacia("Nave de Alvedro"), fase: "leyendo" as const, puntos: [{ id: "1", nombre: "Cámara 1", guarda: "", temperatura: "", controlador: "", notas: "" }] };
    inst.tecnica = { ...inst.tecnica, via: "opcua", permiso: "leer" };
    const c = cliente({ contacto: { nombre: "Antonio Franco", cargo: "", telefono: "600", correo: "" }, instalaciones: [inst], proximo: { texto: "Revisar a la semana", fecha: "2026-11-26" } });
    const p = pasarela({ ubicacion: inst.id, variables: [{ n: "Datos_C1_1_REAL.TT1" }] });
    const r = rutaDe(c, [p], [acceso({ ultimo: AHORA - 3_600_000 })], AHORA, { "windows-amd64": "0.4.1" });
    expect(r.hechos).toBe(r.alta.length);
    expect(r.siguiente).toBeNull();
    expect(r.seguimiento.every((x) => x.nivel === "bien")).toBe(true);
  });

  it("con la nave ya conectada, el paso que toca es poner el programa a leer aunque falten cámaras", () => {
    const inst = instalacionVacia("Nave de Alvedro");
    const c = cliente({ contacto: { nombre: "Antonio Franco", cargo: "", telefono: "600", correo: "" }, instalaciones: [inst] });
    const p = pasarela({ ubicacion: inst.id, contacto: null });
    const r = rutaDe(c, [p], [], AHORA);
    expect(r.alta.find((x) => x.id === "visita")?.hecho).toBe(false);
    expect(r.siguiente?.id).toBe("leyendo");
    expect(r.siguiente?.accion).toBe("Poner el programa a leer");
  });

  it("el seguimiento dice lo que falla, lo peor primero", () => {
    const callada = pasarela({ id: "p2", nombre: "Otra", contacto: { ...pasarela().contacto!, t: AHORA - 3_600_000 } });
    const sinPlc = pasarela({ contacto: { ...pasarela().contacto!, estado: { ...pasarela().contacto!.estado, plc: "sin conexión", detalle: "no responde" } }, caduca: AHORA + 3 * 86_400_000 });
    const r = rutaDe(cliente(), [sinPlc, callada], [acceso({ pideClave: AHORA })], AHORA, { "windows-amd64": "0.5.0" });
    expect(r.seguimiento[0].nivel).toBe("mal");
    const ids = r.seguimiento.map((x) => x.id);
    expect(ids).toContain("plc-p1");
    expect(ids).toContain("entrega-p2");
    expect(ids).toContain("token-p1");
    expect(ids).toContain("claves");
    expect(r.seguimiento.find((x) => x.id === "programa-p1")?.nivel).toBe("mirar");
    expect(r.seguimiento.find((x) => x.id === "uso")?.nivel).toBe("mirar");
  });

  it("compara versiones por números", () => {
    expect(versionMenor("0.4.1", "0.10.0")).toBe(true);
    expect(versionMenor("0.4.1", "0.4.1")).toBe(false);
    expect(versionMenor("1.0.0", "0.9.9")).toBe(false);
  });
});

describe("visita de soporte", () => {
  const C = { usuario: "equipo", clave: "clave-del-equipo-de-prueba" };
  it("deja ver la app como ese cliente una hora, y no se puede falsificar", async () => {
    process.env.GRADIOX_USUARIO = C.usuario;
    process.env.GRADIOX_CLAVE = C.clave;
    const g = await crearSesionSoporte(C, ID, AHORA);
    expect(await leerSesion(g, C, AHORA + 60_000)).toMatchObject({ tipo: "soporte", cliente: ID });
    expect(await leerSesion(g, C, AHORA + 3_600_001)).toBeNull();
    expect(await leerSesion(g.replace(ID, "5a63ac32-0ce1-4e9a-a665-e1842970140b"), C, AHORA)).toBeNull();
    const q = await quienEs(new Request("https://gradiox.com/", { headers: { cookie: `${GALLETA}=${g}` } }), accesosEnMemoria(), AHORA);
    expect(q).toMatchObject({ tipo: "cliente", acceso: { cliente: ID, usuario: "soporte", demo: false } });
    expect(q && "soporte" in q && q.soporte).toBeGreaterThan(AHORA);
  });

  it("cada visita queda apuntada, la última primero", async () => {
    const a = ajustesEnMemoria();
    await apuntarVisita(ID, { t: 1, motivo: "uno" }, a);
    await apuntarVisita(ID, { t: 2, motivo: "dos" }, a);
    expect(await visitasSoporte(ID, a)).toEqual([{ t: 2, motivo: "dos" }, { t: 1, motivo: "uno" }]);
    expect(await visitasSoporte("otro", a)).toEqual([]);
  });
});

describe("freno a quien prueba contraseñas", () => {
  it("cierra el usuario tras varios fallos y lo abre al pasar el rato", async () => {
    const a = ajustesEnMemoria();
    for (let i = 0; i < MAX_FALLOS - 1; i++) expect(await apuntarFallo("app", "antonio.rgv", AHORA + i, a)).toBe(0);
    expect(await frenadoHasta("app", "antonio.rgv", AHORA, a)).toBe(0);
    const hasta = await apuntarFallo("app", "Antonio.RGV", AHORA + 100, a);
    expect(hasta).toBe(AHORA + 100 + BLOQUEO_MS);
    expect(await frenadoHasta("app", "antonio.rgv", AHORA + 200, a)).toBe(hasta);
    expect(await frenadoHasta("ops", "antonio.rgv", AHORA + 200, a)).toBe(0);
    expect(await frenadoHasta("app", "antonio.rgv", hasta + 1, a)).toBe(0);
  });

  it("entrar bien borra la cuenta", async () => {
    const a = ajustesEnMemoria();
    for (let i = 0; i < MAX_FALLOS - 1; i++) await apuntarFallo("app", "ana", AHORA, a);
    await olvidarFallos("app", "ana", a);
    expect(await apuntarFallo("app", "ana", AHORA, a)).toBe(0);
  });
});
