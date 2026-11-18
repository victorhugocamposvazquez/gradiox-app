// Lo que la pantalla de históricos pide al servidor: qué instalaciones hay,
// el resumen de un periodo comparado con el anterior y la serie de una variable.

import type { AlmacenPasarelas } from "../pasarelas/almacen";
import type { Pasarela, VariableOpc } from "../pasarelas/modelo";
import { DIA, HORA, MAX_DIAS, metaPorNombre, tramoPara, type Ejecutado, type EstadoOrden, type MetaVariable, type ResumenVariable, type Tramo, type Valor } from "./modelo";

export type Instalacion = { id: string; nombre: string; simulada: boolean; primera: number | null; ultima: number | null; variables: MetaVariable[] };
export type RespuestaResumen = { desde: number; hasta: number; actual: ResumenVariable[]; anterior: ResumenVariable[]; ejecutado: Ejecutado[] };
export type RespuestaSerie = { desde: number; hasta: number; tramoMs: number; actual: Tramo[]; anterior: Tramo[] };

export class ErrorConsulta extends Error {
  constructor(mensaje: string, readonly estado = 400) {
    super(mensaje);
  }
}

/** Entre qué instantes se pregunta. Se ajusta a horas en punto y no deja pasar de un año. */
export function periodo(desde: unknown, hasta: unknown): { desde: number; hasta: number } {
  const d = Number(desde);
  const h = Number(hasta);
  if (!Number.isFinite(d) || !Number.isFinite(h) || d <= 0 || h <= d) throw new ErrorConsulta("Faltan las fechas del periodo");
  const fin = Math.ceil(h / HORA) * HORA;
  const inicio = Math.floor(d / HORA) * HORA;
  if (fin - inicio > MAX_DIAS * DIA) throw new ErrorConsulta("El periodo no puede pasar de un año");
  return { desde: inicio, hasta: fin };
}

const valor = (x: unknown): Valor | undefined => (typeof x === "boolean" || typeof x === "string" || (typeof x === "number" && Number.isFinite(x)) ? x : undefined);
const ESTADOS: EstadoOrden[] = ["pendiente", "enviada", "hecha", "rechazada", "caducada", "anulada"];
/** Tiempo que una orden puede esperar a que el programa la recoja antes de darla por no hecha. */
const ESPERA_ORDEN_MS = 10 * 60_000;

/**
 * Las órdenes dadas a una instalación, tal como las guarda la parte de
 * escritura de las pasarelas. Se lee con cuidado: si la forma cambia o todavía
 * no hay órdenes, sale una lista vacía en vez de un fallo.
 */
export function ejecutadoDe(p: Pasarela, nombres: Map<string, MetaVariable>, ahora: number): Ejecutado[] {
  const escritura = (p as unknown as { escritura?: { ordenes?: unknown } }).escritura;
  if (!escritura || !Array.isArray(escritura.ordenes)) return [];
  const out: Ejecutado[] = [];
  for (const bruta of escritura.ordenes) {
    if (typeof bruta !== "object" || bruta === null) continue;
    const o = bruta as Record<string, unknown>;
    const t = Number(o.pedida);
    if (typeof o.id !== "string" || typeof o.n !== "string" || !Number.isFinite(t)) continue;
    let estado = ESTADOS.includes(o.estado as EstadoOrden) ? (o.estado as EstadoOrden) : "pendiente";
    if ((estado === "pendiente" || estado === "enviada") && ahora - Number(o.cambio ?? t) > ESPERA_ORDEN_MS) estado = "caducada";
    const m = nombres.get(o.n);
    out.push({
      id: o.id,
      t,
      v: o.n,
      que: m ? `${m.grupo} · ${m.nombre}` : o.n,
      antes: valor(o.antes),
      valor: valor(o.valor),
      leido: valor(o.leido),
      estado,
      motivo: typeof o.motivo === "string" && o.motivo ? o.motivo : undefined,
      quien: typeof o.quien === "string" && o.quien ? o.quien : undefined,
      simulada: o.simulada === true,
    });
  }
  return out.sort((a, b) => b.t - a.t);
}

/** Cómo se llama cada variable: lo que diga su lista (la de la instalación o la que propone el programa) y, si no, su propio nombre. */
function metas(p: Pasarela, leidas: { v: string; clase: MetaVariable["clase"] }[]): MetaVariable[] {
  const dichas = new Map<string, VariableOpc>();
  for (const v of [...(p.propuesta?.variables ?? []), ...p.variables]) dichas.set(v.n, v);
  return leidas.map((l) => {
    const d = dichas.get(l.v);
    const base = metaPorNombre(l.v, l.clase);
    return d ? { ...base, nombre: d.d || base.nombre, grupo: d.g || base.grupo, ...(d.u && l.clase === "numero" ? { unidad: d.u } : {}) } : base;
  });
}

export async function instalaciones(a: AlmacenPasarelas): Promise<Instalacion[]> {
  const out: Instalacion[] = [];
  for (const p of await a.listar()) {
    const leidas = await a.variablesLeidas(p.id);
    out.push({
      id: p.id,
      nombre: p.nombre,
      simulada: p.contacto?.estado.simulado === true,
      primera: leidas.length ? Math.min(...leidas.map((l) => l.primera)) : null,
      ultima: leidas.length ? Math.max(...leidas.map((l) => l.ultima)) : null,
      variables: metas(p, leidas),
    });
  }
  return out;
}

async function pasarela(a: AlmacenPasarelas, id: string) {
  const p = /^[0-9a-f-]{36}$/.test(id) ? await a.leer(id) : null;
  if (!p) throw new ErrorConsulta("Esa instalación no existe", 404);
  return p;
}

export async function resumen(a: AlmacenPasarelas, id: string, desde: unknown, hasta: unknown, ahora: number): Promise<RespuestaResumen> {
  const p = await pasarela(a, id);
  const r = periodo(desde, hasta);
  const largo = r.hasta - r.desde;
  const [actual, anterior, leidas] = [await a.resumenLecturas(id, r.desde, r.hasta), await a.resumenLecturas(id, r.desde - largo, r.desde), await a.variablesLeidas(id)];
  const nombres = new Map(metas(p, leidas).map((m) => [m.v, m]));
  return { ...r, actual, anterior, ejecutado: ejecutadoDe(p, nombres, ahora).filter((e) => e.t >= r.desde && e.t < r.hasta) };
}

export async function serie(a: AlmacenPasarelas, id: string, variable: string, desde: unknown, hasta: unknown): Promise<RespuestaSerie> {
  await pasarela(a, id);
  if (!variable || variable.length > 200) throw new ErrorConsulta("Falta la variable");
  const r = periodo(desde, hasta);
  const largo = r.hasta - r.desde;
  const tramoMs = tramoPara(r.desde, r.hasta);
  return { ...r, tramoMs, actual: await a.serieLecturas(id, variable, r.desde, r.hasta, tramoMs), anterior: await a.serieLecturas(id, variable, r.desde - largo, r.desde, tramoMs) };
}
