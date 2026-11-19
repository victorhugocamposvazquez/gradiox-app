import { describe, expect, it } from "vitest";
import { AGUANTE_MS, HORA, horaPeninsula, medir, mirarTecho, type Actuacion } from "../src/actua/actuacion";
import { detectarCamaras, fichaValida, montar } from "../src/actua/camaras";
import { TARIFA_PARTIDA, dentro, proponer, simularDia } from "../src/actua/optimiza";
import { aplicar, conEscribibles, deshacer, estadoActua, guardarActua, tarifaValida, vigilar } from "../src/actua/servicio";
import { lineasEscribibles } from "../src/actua/actuacion";
import type { Tramo } from "../src/historicos/modelo";
import { pasarelasEnMemoria } from "../src/pasarelas/almacen";
import { recibirLecturas } from "../src/pasarelas/entrada";
import { aplicarCambios, huellaToken, nuevoToken, pasarelaVacia, type LecturaOpc, type Pasarela } from "../src/pasarelas/modelo";

// Miércoles 18 de noviembre de 2026, 09:00 en la península.
const AHORA = Date.UTC(2026, 10, 18, 8, 0, 0);
const C = "Datos_C6_1";
const LISTA = ["REAL.TT9", "REAL.Hora_punta_ac", "REAL.Hora_llana_ac", "REAL.Hora_valle_ac", "BOOL.Refrigeracion", "REAL.P_consigna_ac", "REAL.P_consigna_de", "REAL.T_muy_alta_ac", "REAL.T_muy_baja_ac"].map((f) => `Cámara 6\t${C}_${f}`).join("\n");
const lecturas = (t: number, consignas = [-20, -20, -20], aire = -20.5): LecturaOpc[] => [
  { v: `${C}_REAL.TT9`, t, x: aire },
  { v: `${C}_REAL.Hora_punta_ac`, t, x: consignas[0] },
  { v: `${C}_REAL.Hora_llana_ac`, t, x: consignas[1] },
  { v: `${C}_REAL.Hora_valle_ac`, t, x: consignas[2] },
  { v: `${C}_REAL.P_consigna_ac`, t, x: -20 },
  { v: `${C}_REAL.P_consigna_de`, t, x: -21.5 },
  { v: `${C}_REAL.T_muy_alta_ac`, t, x: -15 },
  { v: `${C}_REAL.T_muy_baja_ac`, t, x: -28 },
];
const FICHA = { volumenM3: 3000, frioKw: 60 };

async function nave() {
  const a = pasarelasEnMemoria(() => AHORA);
  const token = nuevoToken();
  const datos = aplicarCambios(pasarelaVacia("Nave de pruebas", token, AHORA, 30), { plc: "50.50.0.1", cadaSegundos: 10, variablesTexto: `grupo\tvariable\n${LISTA}` });
  if ("error" in datos) throw new Error(datos.error);
  const p = await a.crear("11111111-1111-4111-8111-111111111111", huellaToken(token), datos);
  await a.anotar(p.id, lecturas(AHORA - 60_000), true);
  await a.contactar(p.id, { t: AHORA, programa: "0.4.0", plataforma: "darwin-arm64", estado: { plc: "bien", detalle: "", leidas: 9, total: 9, ultima: AHORA, simulado: true, pendientes: 0, ordenes: true } });
  const leer = async () => (await a.leer(p.id)) as Pasarela;
  return { a, token, leer };
}

/** Con ficha, consignas permitidas y órdenes encendidas: lista para aplicar. */
async function lista() {
  const n = await nave();
  await guardarActua(n.a, await n.leer(), { ficha: { clave: C, ficha: FICHA } });
  const p = await n.leer();
  const [d] = detectarCamaras(p.variables);
  const m = montar(d, FICHA, new Map((await n.a.ultimas(p.id)).map((l) => [l.v, l.x])));
  if ("falta" in m) throw new Error(m.falta);
  const e = conEscribibles(p, lineasEscribibles(d.vars, m.camara.suelo, m.camara.techo));
  await guardarActua(n.a, p, { escritura: { ...e!, activa: true } });
  return { ...n, camara: m.camara };
}

describe("cámaras de la lista", () => {
  it("junta las variables de una cámara aunque vengan de bloques distintos", () => {
    const [d, ...mas] = detectarCamaras(LISTA.split("\n").map((l) => ({ n: l.split("\t")[1], g: "Cámara 6" })));
    expect(mas).toEqual([]);
    expect(d.clave).toBe(C);
    expect(d.nombre).toBe("Cámara 6");
    expect(d.vars.consigna.valle).toBe(`${C}_REAL.Hora_valle_ac`);
    expect(d.vars.enfriando).toBe(`${C}_BOOL.Refrigeracion`);
  });
  it("no cuenta una cámara a la que le falta una consigna", () => {
    expect(detectarCamaras([{ n: "X_REAL.TT9" }, { n: "X_REAL.Hora_punta_ac" }, { n: "X_REAL.Hora_llana_ac" }])).toEqual([]);
  });
  it("los límites salen de lo más estricto: género, alarmas y ficha", async () => {
    const { camara } = await lista();
    expect(camara.techo).toBe(-18); // congelado: nunca por encima de −18
    expect(camara.diferencial).toBe(1.5);
    expect(camara.suelo).toBeGreaterThanOrEqual(-27); // un grado sobre la alarma de muy baja
    expect(fichaValida({ volumenM3: 3000, frioKw: 60 })).toBe(true);
    expect(fichaValida({ volumenM3: 1, frioKw: 60 })).toBe(false);
  });
});

describe("cuenta de las consignas", () => {
  it("propone enfriar en valle y aflojar en punta, sin salirse de los límites ni calentar el género", async () => {
    const { camara } = await lista();
    const p = proponer(camara, TARIFA_PARTIDA);
    expect(p.mejor).not.toBeNull();
    const c = p.mejor!.consignas;
    expect(c.valle).toBeLessThanOrEqual(c.llana);
    expect(c.llana).toBeLessThanOrEqual(c.punta);
    expect(c.punta).toBeLessThanOrEqual(camara.techo);
    expect(p.mejor!.dia.aireMax).toBeLessThanOrEqual(camara.techo + 1e-6);
    expect(p.mejor!.dia.generoMedia).toBeLessThanOrEqual(p.ahora.generoMedia + 0.2 + 1e-6);
    expect(p.eurosDia).toBeGreaterThan(0);
    expect(p.parte).toBeGreaterThan(0.02);
    expect(p.mejor!.dia.marcha.punta).toBeLessThan(p.ahora.marcha.punta);
    expect(dentro(camara, p.mejor!.dia, p.ahora)).toBe(true);
  });
  it("con la luz al mismo precio todo el día no propone nada", async () => {
    const { camara } = await lista();
    const plana = { ...TARIFA_PARTIDA, precio: { punta: 0.13, llana: 0.13, valle: 0.13 } };
    expect(proponer(camara, plana).mejor).toBeNull();
  });
  it("el día simulado cuadra: la energía es la suma de sus tramos", async () => {
    const { camara } = await lista();
    const d = simularDia(camara, camara.consignas, TARIFA_PARTIDA);
    expect(d.kwh.punta + d.kwh.llana + d.kwh.valle).toBeCloseTo(d.kwhDia, 6);
    expect(d.curva).toHaveLength(24);
  });
  it("una tarifa vale si tiene las 24 horas, los tres tramos y precios con sentido", () => {
    expect(tarifaValida(TARIFA_PARTIDA)).toBe(true);
    expect(tarifaValida({ ...TARIFA_PARTIDA, horas: TARIFA_PARTIDA.horas.slice(1) })).toBe(false);
    expect(tarifaValida({ ...TARIFA_PARTIDA, precio: { punta: 0, llana: 0.1, valle: 0.1 } })).toBe(false);
  });
});

describe("aplicar, deshacer y vigilar", () => {
  it("sin ficha dice qué falta, y con ficha enseña la propuesta y las líneas que hay que permitir", async () => {
    const { a, leer } = await nave();
    let e = await estadoActua(a, await leer(), AHORA);
    expect(e.camaras[0].falta).toMatch(/ficha/i);
    await guardarActua(a, await leer(), { ficha: { clave: C, ficha: FICHA } });
    e = await estadoActua(a, await leer(), AHORA);
    expect(e.camaras[0].propuesta?.eurosAno).toBeGreaterThan(0);
    expect(e.camaras[0].faltanEscribibles).toHaveLength(3);
    expect(e.totales.propuestoAno).toBe(e.camaras[0].propuesta?.eurosAno);
    await expect(aplicar(a, await leer(), C, AHORA)).rejects.toThrow(/no están activadas/);
  });
  it("aplica por órdenes, una por consigna que cambia, y no deja aplicar dos veces", async () => {
    const { a, leer } = await lista();
    const act = await aplicar(a, await leer(), C, AHORA);
    const ordenes = await a.ordenesAbiertas((await leer()).id);
    const cambian = (["punta", "llana", "valle"] as const).filter((p) => act.antes[p] !== act.despues[p]);
    expect(ordenes.map((o) => o.n).sort()).toEqual(cambian.map((p) => act.vars.consigna[p]).sort());
    for (const o of ordenes) expect(o.antes).toBe(-20);
    await expect(aplicar(a, await leer(), C, AHORA)).rejects.toThrow(/ya tiene una actuación/);
    const e = await estadoActua(a, await leer(), AHORA + 1000);
    expect(e.actuaciones[0].situacion).toBe("esperando");
    expect(e.camaras[0].activa).toBe(act.id);
    expect(e.totales.enMarchaAno).toBe(act.previsto.eurosAno);
  });
  it("sin la llave de la planta no aplica", async () => {
    const { a, leer } = await lista();
    const p = await leer();
    await a.contactar(p.id, { ...p.contacto!, estado: { ...p.contacto!.estado, ordenes: false } });
    await expect(aplicar(a, await leer(), C, AHORA)).rejects.toThrow(/Permitir órdenes/);
  });
  it("deshacer devuelve las consignas que Gradiox dejó y respeta las que alguien cambió a mano", async () => {
    const { a, leer } = await lista();
    const act = await aplicar(a, await leer(), C, AHORA);
    const id = (await leer()).id;
    for (const o of await a.ordenesAbiertas(id)) await a.cambiarOrden(id, o.id, { estado: "hecha", cambio: AHORA + 1000 }, ["pendiente"]);
    // El PLC ya tiene las nuevas, pero alguien ha tocado la de punta en la planta.
    await a.anotar(id, lecturas(AHORA + 60_000, [-19, act.despues.llana, act.despues.valle]), true);
    expect((await estadoActua(a, await leer(), AHORA + 61_000)).actuaciones[0].situacion).toBe("esperando");
    const cerrada = await deshacer(a, await leer(), act, "deshecha", "Deshecha desde el panel", AHORA + 120_000);
    expect(cerrada.estado).toBe("deshecha");
    const vuelta = await a.ordenesAbiertas(id);
    expect(vuelta.every((o) => o.valor === -20)).toBe(true);
    expect(vuelta.some((o) => o.n === act.vars.consigna.punta)).toBe(false);
    await expect(deshacer(a, await leer(), cerrada, "deshecha", "", AHORA)).rejects.toThrow(/ya está deshecha/);
  });
  it("si la temperatura se queda en el límite, las consignas vuelven solas con la entrega de lecturas", async () => {
    const { a, leer, token } = await lista();
    const act = await aplicar(a, await leer(), C, AHORA);
    const id = (await leer()).id;
    for (const o of await a.ordenesAbiertas(id)) await a.cambiarOrden(id, o.id, { estado: "hecha", cambio: AHORA + 1000 }, ["pendiente"]);
    const entrega = (t: number, aire: number) =>
      recibirLecturas(new Request("https://gradiox.com/api/pasarela/lecturas", { method: "POST", headers: { authorization: `Bearer ${token}`, "x-gradiox-protocolo": "1" }, body: JSON.stringify({ simulado: true, lecturas: lecturas(t, [act.despues.punta, act.despues.llana, act.despues.valle], aire) }) }), a, t + 1000);
    const MIN = 60_000;
    expect((await entrega(AHORA + MIN, act.techo - 0.4)).estado).toBe(200);
    // Un pico corto (una puerta, un desescarche) no la devuelve.
    await entrega(AHORA + 2 * MIN, act.techo + 0.5);
    expect((await a.actuaciones(id, true))[0].sobre).toBe(AHORA + 2 * MIN);
    await entrega(AHORA + 8 * MIN, act.techo - 0.2);
    expect((await a.actuaciones(id, true))[0].sobre).toBeUndefined();
    // Un cuarto de hora seguido en el límite, sí.
    await entrega(AHORA + 10 * MIN, act.techo + 0.1);
    await entrega(AHORA + 20 * MIN, act.techo + 0.3);
    expect(await a.actuaciones(id, true)).toHaveLength(1);
    await entrega(AHORA + 10 * MIN + AGUANTE_MS, act.techo + 0.3);
    const [cerrada] = await a.actuaciones(id);
    expect(cerrada.estado).toBe("revertida");
    expect(cerrada.motivo).toMatch(/15 minutos en el límite de seguridad/);
    expect((await a.ordenesAbiertas(id)).length).toBeGreaterThan(0);
    expect((await a.ordenesAbiertas(id)).every((o) => o.valor === -20)).toBe(true);
  });
  it("muy por encima del límite no espera, y lo de antes de aplicar no cuenta", () => {
    const act = { vars: { temperatura: "T" }, aplicada: 1000, techo: -18 } as unknown as Actuacion;
    expect(mirarTecho(act, [{ v: "T", t: 500, x: -10 }], 2000)).toEqual({ sobre: undefined });
    expect(mirarTecho(act, [{ v: "T", t: 1500, x: -17.5 }, { v: "otra", t: 1600, x: 5 }], 2000)).toEqual({ sobre: 1500 });
    expect(mirarTecho(act, [{ v: "T", t: 1500, x: -15.9 }], 2000)).toEqual({ revertir: -15.9 });
    // Sin lecturas nuevas, el reloj sigue corriendo.
    expect(mirarTecho({ ...act, sobre: 1500 }, [], 1500 + AGUANTE_MS)).toEqual({ revertir: -18 });
  });
  it("vigilar no hace nada sin actuaciones en marcha", async () => {
    const { a, leer } = await lista();
    expect(await vigilar(a, await leer(), lecturas(AHORA, [-20, -20, -20], 0), AHORA)).toBe(0);
  });
});

describe("medir el ahorro de verdad", () => {
  const act = (aplicada: number): Actuacion => ({
    id: "x", camara: C, nombre: "Cámara 6", estado: "aplicada", vars: { consigna: { punta: "p", llana: "l", valle: "v" }, temperatura: "t", enfriando: "e" }, antes: { punta: -20, llana: -20, valle: -20 }, despues: { punta: -18, llana: -20, valle: -22 }, techo: -18,
    previsto: { eurosDia: 10, eurosAno: 2500, kwhDia: 0, parte: 0.1, marchaAntes: { punta: 0.5, llana: 0.5, valle: 0.5 }, marchaDespues: { punta: 0.2, llana: 0.5, valle: 0.7 }, kwhAntes: { punta: 80, llana: 80, valle: 80 }, kwhDespues: { punta: 32, llana: 80, valle: 112 } },
    tarifa: TARIFA_PARTIDA, por: "prueba", aplicada,
  });
  const tramos = (desde: number, horas: number, marcha: (p: string) => number): Tramo[] =>
    Array.from({ length: horas }, (_, i) => {
      const t = desde + i * HORA;
      const p = TARIFA_PARTIDA.horas[horaPeninsula(t).hora];
      return { t, n: 6, ms: HORA, min: null, max: null, media: null, activa: marcha(p), arranques: 1 };
    });
  // Lunes 16 de noviembre de 2026 a las 00:00 en la península.
  const LUNES = Date.UTC(2026, 10, 15, 23, 0, 0);

  it("la hora de la península sabe de fines de semana", () => {
    expect(horaPeninsula(LUNES)).toEqual({ hora: 0, laborable: true });
    expect(horaPeninsula(LUNES - HORA).laborable).toBe(false);
    expect(horaPeninsula(Date.UTC(2026, 6, 1, 10, 0, 0)).hora).toBe(12); // horario de verano
  });
  it("con menos de un día a cada lado no da cifra", () => {
    const a = act(LUNES + 24 * HORA);
    const m = medir(a, tramos(LUNES, 30, () => 0.5), LUNES + 30 * HORA, horaPeninsula);
    expect(m.horasAntes).toBe(24);
    expect(m.horasDespues).toBe(6);
    expect(m.eurosDia).toBeNull();
  });
  it("con un día a cada lado, el ahorro sale de las horas de marcha de verdad", () => {
    const a = act(LUNES + 24 * HORA);
    const horas = [...tramos(LUNES, 24, () => 0.5), ...tramos(LUNES + 24 * HORA, 24, (p) => (p === "punta" ? 0.2 : p === "valle" ? 0.7 : 0.5))];
    const m = medir(a, horas, LUNES + 48 * HORA, horaPeninsula);
    expect(m.marchaAntes.punta).toBeCloseTo(0.5, 6);
    expect(m.marchaDespues.punta).toBeCloseTo(0.2, 6);
    // 20 kW en marcha (240 kWh en 12 h de marcha): 8 h de punta y 8 de valle.
    const kw = 20;
    expect(m.eurosDia).toBeCloseTo(kw * (8 * 0.3 * TARIFA_PARTIDA.precio.punta - 8 * 0.2 * TARIFA_PARTIDA.precio.valle), 6);
  });
  it("si marcha igual que antes, el ahorro medido es cero aunque lo previsto fuera otro", () => {
    const a = act(LUNES + 24 * HORA);
    const m = medir(a, tramos(LUNES, 48, () => 0.5), LUNES + 48 * HORA, horaPeninsula);
    expect(m.eurosDia).toBeCloseTo(0, 6);
  });
});
