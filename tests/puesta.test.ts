import { describe, expect, it } from "vitest";
import type { UltimaLectura } from "../src/pasarelas/almacen";
import { explicarOrden } from "../src/pasarelas/explicar";
import { pasarelaVacia, type Contacto, type Pasarela } from "../src/pasarelas/modelo";
import { NO_EXISTE, inexistentes, pasosPuesta, siguiente } from "../src/pasarelas/puesta";
import type { Orden } from "../src/pasarelas/ordenes";

const AHORA = 1_800_000_000_000;
const base = (cambios: Partial<Pasarela> = {}): Pasarela => ({ ...pasarelaVacia("Nave", "gxp_" + "a".repeat(43), AHORA - 1000, 30), id: "x", creada: AHORA, actualizada: AHORA, contacto: null, ...cambios });
const contacto = (estado: Partial<Contacto["estado"]> = {}, t = AHORA - 5000): Contacto => ({ t, programa: "0.4.1", plataforma: "darwin-arm64", estado: { plc: "conectado", detalle: "", leidas: 2, total: 2, ultima: AHORA, simulado: false, pendientes: 0, ordenes: false, ...estado } });
const lectura = (v: string, x: UltimaLectura["x"], c?: string): UltimaLectura => ({ v, t: AHORA, x, simulada: false, ...(c ? { c } : {}) });
const dos = [{ n: "A.t" }, { n: "A.b" }];

describe("puesta en marcha", () => {
  it("sin estrenar, lo primero es poner el token en el programa", () => {
    const pasos = pasosPuesta(base(), [], [], AHORA);
    expect(pasos.map((x) => x.id)).toEqual(["programa", "plc", "lista", "ordenes", "prueba"]);
    expect(siguiente(pasos)).toMatchObject({ id: "programa", donde: "programa", accion: "token" });
  });
  it("con el PLC simulado pide conectar el de verdad", () => {
    const pasos = pasosPuesta(base({ contacto: contacto({ simulado: true }) }), [], [], AHORA);
    expect(pasos[0].hecho).toBe(true);
    expect(siguiente(pasos)?.id).toBe("plc");
    expect(siguiente(pasos)?.detalle).toMatch(/PLC de verdad/);
  });
  it("un programa callado se avisa y no da por bueno el PLC", () => {
    const pasos = pasosPuesta(base({ contacto: contacto({}, AHORA - 20 * 60_000) }), [], [], AHORA);
    expect(pasos[0]).toMatchObject({ hecho: false, aviso: true });
    expect(pasos[0].detalle).toMatch(/wifi o datos/);
    expect(pasos[1].hecho).toBe(false);
  });
  it("una lista que no da nada en este PLC se señala y se puede limpiar", () => {
    const lecturas = [lectura("A.t", null, NO_EXISTE), lectura("A.b", null, NO_EXISTE)];
    const p = base({ variables: dos, contacto: contacto({ leidas: 0, total: 2 }) });
    const pasos = pasosPuesta(p, lecturas, [], AHORA);
    expect(siguiente(pasos)).toMatchObject({ id: "lista", aviso: true, accion: "quitar-inexistentes" });
    expect(inexistentes(p, lecturas)).toEqual(["A.t", "A.b"]);
  });
  it("leyendo, lo siguiente son las órdenes, con la llave que falta", () => {
    const p = base({ variables: dos, contacto: contacto(), escritura: { activa: true, variables: [{ n: "A.t", sino: false, min: 0, max: 5 }] } });
    const pasos = pasosPuesta(p, [lectura("A.t", 3), lectura("A.b", true)], [], AHORA);
    expect(pasos[2].hecho).toBe(true);
    expect(siguiente(pasos)).toMatchObject({ id: "ordenes", donde: "programa" });
    expect(siguiente(pasos)?.detalle).toMatch(/Permitir órdenes de Gradiox/);
  });
  it("con una orden hecha queda todo en marcha", () => {
    const orden: Orden = { id: "o", n: "A.t", valor: 4, estado: "hecha", pedida: AHORA, cambio: AHORA };
    const p = base({ variables: dos, contacto: contacto({ ordenes: true }), escritura: { activa: true, variables: [{ n: "A.t", sino: false, min: 0, max: 5 }] } });
    expect(siguiente(pasosPuesta(p, [], [orden], AHORA))).toBeNull();
  });
});

describe("por qué no se hizo una orden", () => {
  it("dice qué hacer en los casos de siempre", () => {
    expect(explicarOrden({ estado: "caducada", motivo: "El programa no la recogió a tiempo" }).hacer).toMatch(/Permitir órdenes/);
    expect(explicarOrden({ estado: "rechazada", motivo: "No está en la lista que lee este programa" }).que).toMatch(/no lee esa variable/);
    expect(explicarOrden({ estado: "rechazada", motivo: "El PLC no deja escribir esa variable" }).hacer).toMatch(/escritura/);
  });
});
