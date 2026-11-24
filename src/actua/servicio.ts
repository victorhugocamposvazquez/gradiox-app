// Lo que el panel interno hace con las actuaciones de una instalación: ver qué
// se propone para cada cámara, aplicarlo por las órdenes de doble llave,
// deshacerlo y vigilar que la temperatura no se acerque al límite.

import type { AlmacenPasarelas } from "../pasarelas/almacen";
import { nuevaRevision, type LecturaOpc, type Pasarela } from "../pasarelas/modelo";
import { MAX_ESCRIBIBLES, escrituraVacia, type Escribible } from "../pasarelas/ordenes";
import { AGUANTE_MS, HORA, URGENTE, cambiosDe, horaPeninsula, lineasEscribibles, medir, mirarTecho, nuevaActuacion, prepararOrdenes, type Actuacion, type Medido } from "./actuacion";
import { detectarCamaras, fichaValida, montar, type CamaraDetectada, type FichaCamara } from "./camaras";
import { PERIODOS, TARIFA_PARTIDA, TEXTO_MOTIVO, proponer, type Consignas, type Periodo, type Propuesta, type Tarifa } from "./optimiza";

export class ErrorActua extends Error {}

const POR = "Gradiox · actuación";
/** Lo que se espera a que el programa recoja y ejecute las órdenes antes de dar la actuación por no hecha. */
export const ESPERA_MS = 5 * 60_000;
const DIAS_ANTES = 14;

export const tarifaDe = (p: Pasarela): Tarifa => p.actua?.tarifa ?? TARIFA_PARTIDA;

export function tarifaValida(t: unknown): t is Tarifa {
  const x = t as Tarifa;
  const precio = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 2;
  return !!x && Array.isArray(x.horas) && x.horas.length === 24 && x.horas.every((h) => PERIODOS.includes(h)) && PERIODOS.every((p) => x.horas.includes(p)) && !!x.precio && PERIODOS.every((p) => precio(x.precio[p]));
}

export type Situacion = "esperando" | "en-marcha" | "no-aplicada";
export type ActuacionVista = Actuacion & { situacion?: Situacion; medido?: Medido };

export type CamaraVista = {
  clave: string;
  nombre: string;
  ficha?: FichaCamara;
  temperatura: number | null;
  consignas: Partial<Consignas>;
  techo?: number;
  suelo?: number;
  falta?: string;
  avisos: string[];
  /** Lo que se propone, resumido para pintarlo. */
  propuesta?: { consignas: Consignas; eurosDia: number; eurosAno: number; kwhDia: number; parte: number; ahora: Resumen; despues: Resumen };
  motivo?: string;
  /** Líneas que faltan en «Órdenes al PLC» para poder aplicarla. */
  faltanEscribibles: string[];
  activa?: string;
};
export type Resumen = { eurosDia: number; kwhDia: number; marcha: Record<Periodo, number>; kwh: Record<Periodo, number>; aire: number[]; genero: number[]; aireMax: number; aireMin: number };

export type EstadoActua = {
  ahora: number;
  tarifa: Tarifa;
  ordenesActivas: boolean;
  programaPermite: boolean;
  simulado: boolean;
  camaras: CamaraVista[];
  actuaciones: ActuacionVista[];
  /** Suma de lo previsto para las actuaciones en marcha y para las propuestas sin aplicar. */
  totales: { enMarchaAno: number; propuestoAno: number };
};

const resumen = (d: Propuesta["ahora"]): Resumen => ({ eurosDia: d.eurosDia, kwhDia: d.kwhDia, marcha: d.marcha, kwh: d.kwh, aire: d.curva.map((c) => c.aire), genero: d.curva.map((c) => c.genero), aireMax: d.aireMax, aireMin: d.aireMin });
const cerca = (a: unknown, b: number) => typeof a === "number" && Math.abs(a - b) < 0.05;

function calcular(d: CamaraDetectada, p: Pasarela, ultimas: Map<string, LecturaOpc["x"]>) {
  const ficha = p.actua?.camaras?.[d.clave];
  const m = montar(d, ficha, ultimas);
  if ("falta" in m) return { ficha, falta: m.falta };
  return { ficha, camara: m.camara, avisos: m.avisos, propuesta: proponer(m.camara, tarifaDe(p)) };
}

function faltan(p: Pasarela, lineas: string[], consignas: Consignas, vars: CamaraDetectada["vars"]): string[] {
  const puestas = new Map((p.escritura?.variables ?? []).map((v) => [v.n, v]));
  return PERIODOS.flatMap((periodo, i) => {
    const e = puestas.get(vars.consigna[periodo]);
    const x = consignas[periodo];
    return e && !e.sino && e.min !== undefined && e.max !== undefined && x >= e.min && x <= e.max ? [] : [lineas[i]];
  });
}

export async function estadoActua(a: AlmacenPasarelas, p: Pasarela, ahora: number): Promise<EstadoActua> {
  const ultimas = new Map((await a.ultimas(p.id)).map((l) => [l.v, l.x]));
  const todas = await a.actuaciones(p.id);
  const activas = new Map(todas.filter((x) => x.estado === "aplicada").map((x) => [x.camara, x]));
  const num = (n?: string) => {
    const x = n ? ultimas.get(n) : null;
    return typeof x === "number" ? x : null;
  };

  const camaras: CamaraVista[] = detectarCamaras(p.variables).map((d) => {
    const c = calcular(d, p, ultimas);
    const consignas: Partial<Consignas> = {};
    for (const per of PERIODOS) {
      const x = num(d.vars.consigna[per]);
      if (x !== null) consignas[per] = x;
    }
    const base: CamaraVista = { clave: d.clave, nombre: d.nombre, ficha: c.ficha, temperatura: num(d.vars.temperatura), consignas, avisos: [], faltanEscribibles: [], activa: activas.get(d.clave)?.id };
    if (!("camara" in c) || !c.camara) return { ...base, falta: c.falta };
    const pr = c.propuesta;
    const vista: CamaraVista = { ...base, techo: c.camara.techo, suelo: c.camara.suelo, avisos: c.avisos };
    // Con una actuación en marcha no se propone otra encima: primero se mide esta.
    if (base.activa) return { ...vista, avisos: [], motivo: "Estas son las consignas que puso Gradiox. Hasta que no se mida su resultado, o se deshaga, no se propone otro cambio." };
    if (!pr.mejor) return { ...vista, motivo: TEXTO_MOTIVO[pr.motivo ?? "ya-esta"] };
    return {
      ...vista,
      propuesta: { consignas: pr.mejor.consignas, eurosDia: pr.eurosDia, eurosAno: pr.eurosAno, kwhDia: pr.kwhDia, parte: pr.parte, ahora: resumen(pr.ahora), despues: resumen(pr.mejor.dia) },
      faltanEscribibles: faltan(p, lineasEscribibles(d.vars, c.camara.suelo, c.camara.techo), pr.mejor.consignas, d.vars),
    };
  });

  const actuaciones: ActuacionVista[] = [];
  for (const x of todas.slice(0, 30)) {
    const vista: ActuacionVista = { ...x };
    if (x.estado === "aplicada") vista.situacion = PERIODOS.every((per) => cerca(ultimas.get(x.vars.consigna[per]), x.despues[per])) ? "en-marcha" : ahora - x.aplicada < ESPERA_MS ? "esperando" : "no-aplicada";
    if (x.vars.enfriando) {
      const horas = await a.serieLecturas(p.id, x.vars.enfriando, x.aplicada - DIAS_ANTES * 24 * HORA, x.cerrada ?? ahora, HORA);
      vista.medido = medir(x, horas, ahora, horaPeninsula);
    }
    actuaciones.push(vista);
  }
  const enMarcha = todas.filter((x) => x.estado === "aplicada");
  return {
    ahora,
    tarifa: tarifaDe(p),
    ordenesActivas: Boolean(p.escritura?.activa),
    programaPermite: Boolean(p.contacto?.estado.ordenes),
    simulado: Boolean(p.contacto?.estado.simulado),
    camaras,
    actuaciones,
    totales: { enMarchaAno: enMarcha.reduce((s, x) => s + x.previsto.eurosAno, 0), propuestoAno: camaras.reduce((s, c) => s + (c.activa ? 0 : c.propuesta?.eurosAno ?? 0), 0) },
  };
}

/** Aplica lo que se propone ahora mismo para esa cámara. La cuenta se vuelve a hacer con lo último leído: no se aplica nada que venga escrito desde la pantalla. */
export async function aplicar(a: AlmacenPasarelas, p: Pasarela, clave: string, ahora: number): Promise<Actuacion> {
  const d = detectarCamaras(p.variables).find((x) => x.clave === clave);
  if (!d) throw new ErrorActua("Esa cámara no está en la lista de esta conexión");
  if ((await a.actuaciones(p.id, true)).some((x) => x.camara === clave)) throw new ErrorActua("Esta cámara ya tiene una actuación en marcha. Deshazla antes de aplicar otra.");
  if (!p.contacto?.estado.ordenes) throw new ErrorActua("El programa de la planta no tiene permitidas las órdenes. Se marca allí, en «Conexión», «Permitir órdenes de Gradiox».");
  const c = calcular(d, p, new Map((await a.ultimas(p.id)).map((l) => [l.v, l.x])));
  if (!("camara" in c) || !c.camara) throw new ErrorActua(c.falta ?? "Faltan datos");
  if (!c.propuesta.mejor) throw new ErrorActua(TEXTO_MOTIVO[c.propuesta.motivo ?? "ya-esta"]);
  const r = prepararOrdenes(p.escritura, d.vars, c.camara.consignas, c.propuesta.mejor.consignas, ahora, POR);
  if ("error" in r) throw new ErrorActua(r.error);
  await a.caducarOrdenes(p.id, ahora);
  const abiertas = new Set((await a.ordenesAbiertas(p.id)).map((o) => o.n));
  if (r.ordenes.some((o) => abiertas.has(o.n))) throw new ErrorActua("Ya hay una orden en curso para alguna de esas consignas");
  const act = nuevaActuacion(clave, d.nombre, d.vars, c.camara.consignas, c.propuesta, c.camara.techo, tarifaDe(p), ahora, POR);
  await a.guardarActuacion(p.id, act);
  for (const o of r.ordenes) await a.ponerOrden(p.id, o);
  return act;
}

/**
 * Devuelve las consignas a como estaban. Si no se pueden dar las órdenes
 * (apagadas, fuera de límites) no se marca como deshecha: sigue en marcha y se
 * dice por qué.
 */
export async function deshacer(a: AlmacenPasarelas, p: Pasarela, act: Actuacion, estado: "deshecha" | "revertida", motivo: string, ahora: number): Promise<Actuacion> {
  if (act.estado !== "aplicada") throw new ErrorActua("Esa actuación ya está deshecha");
  const ultimas = new Map((await a.ultimas(p.id)).map((l) => [l.v, l.x]));
  // Solo se devuelven las consignas que siguen como las dejó Gradiox: si alguien las ha cambiado a mano en la planta, manda lo suyo.
  const tocar = cambiosDe(act.vars, act.antes, act.despues).filter((c) => !ultimas.has(c.n) || cerca(ultimas.get(c.n), c.a));
  if (tocar.length) {
    const de = { ...act.antes };
    const hasta = { ...act.antes };
    for (const c of tocar) de[c.periodo] = c.a;
    const r = prepararOrdenes(p.escritura, act.vars, de, hasta, ahora, `${POR} (deshacer)`);
    if ("error" in r) throw new ErrorActua(`No se puede deshacer: ${r.error}`);
    await a.caducarOrdenes(p.id, ahora);
    for (const o of await a.ordenesAbiertas(p.id)) if (o.estado === "pendiente" && tocar.some((c) => c.n === o.n)) await a.cambiarOrden(p.id, o.id, { estado: "anulada", motivo: "Actuación deshecha", cambio: ahora }, ["pendiente"]);
    for (const o of r.ordenes) await a.ponerOrden(p.id, o);
  }
  const cerrada: Actuacion = { ...act, estado, cerrada: ahora, motivo };
  await a.guardarActuacion(p.id, cerrada);
  return cerrada;
}

/**
 * Se llama con cada lote de lecturas que entrega el programa. Si una cámara con
 * actuación en marcha se queda en su límite un cuarto de hora, o lo pasa de
 * largo, se devuelven sus consignas sin esperar a nadie. No debe tumbar la
 * entrega de lecturas: los fallos se callan y se vuelve a intentar con el lote
 * siguiente.
 */
export async function vigilar(a: AlmacenPasarelas, p: Pasarela, lote: LecturaOpc[], ahora: number): Promise<number> {
  let hechas = 0;
  try {
    const g = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
    for (const act of await a.actuaciones(p.id, true)) {
      const r = mirarTecho(act, lote, ahora);
      if ("revertir" in r) {
        const como = r.revertir >= act.techo + URGENTE ? `La temperatura llegó a ${g(r.revertir)} °C, muy por encima del límite de seguridad (${g(act.techo)} °C)` : `La temperatura llevaba ${AGUANTE_MS / 60_000} minutos en el límite de seguridad (${g(act.techo)} °C)`;
        await deshacer(a, p, act, "revertida", `${como}. Gradiox devolvió las consignas solo.`, ahora);
        hechas++;
      } else if (r.sobre !== act.sobre) await a.guardarActuacion(p.id, { ...act, sobre: r.sobre });
    }
  } catch {
    // Se reintenta con el lote siguiente.
  }
  return hechas;
}

/** Añade a «Órdenes al PLC» las consignas de una cámara con sus límites. No activa las órdenes: eso sigue siendo una decisión aparte. */
export function conEscribibles(p: Pasarela, lineas: string[]): Pasarela["escritura"] {
  const e = p.escritura ?? escrituraVacia();
  const nuevas: Escribible[] = lineas.map((l) => {
    const [n, min, max] = l.split(";").map((x) => x.trim());
    return { n, sino: false, min: Number(min), max: Number(max) };
  });
  const nombres = new Set(nuevas.map((x) => x.n));
  const variables = [...e.variables.filter((v) => !nombres.has(v.n)), ...nuevas];
  if (variables.length > MAX_ESCRIBIBLES) throw new ErrorActua(`Como mucho se pueden cambiar ${MAX_ESCRIBIBLES} variables por conexión`);
  return { ...e, variables };
}

export async function guardarActua(a: AlmacenPasarelas, p: Pasarela, cambio: { tarifa?: Tarifa; ficha?: { clave: string; ficha: FichaCamara | null }; escritura?: Pasarela["escritura"] }): Promise<Pasarela | null> {
  const { id, creada: _c, actualizada: _a, contacto: _k, ...datos } = p;
  const actua = { ...(datos.actua ?? {}) };
  if (cambio.tarifa) actua.tarifa = { ...cambio.tarifa, dePartida: false };
  if (cambio.ficha) {
    const camaras = { ...(actua.camaras ?? {}) };
    if (cambio.ficha.ficha) camaras[cambio.ficha.clave] = cambio.ficha.ficha;
    else delete camaras[cambio.ficha.clave];
    actua.camaras = camaras;
  }
  // La lista de lo que se puede escribir viaja al programa: cambia la revisión para que la vuelva a pedir.
  return a.guardar(id, { ...datos, actua, ...(cambio.escritura ? { escritura: cambio.escritura, revision: nuevaRevision() } : {}) });
}

export { fichaValida };
