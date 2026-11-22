// Lo que la pantalla de históricos pide al servidor: qué instalaciones hay,
// el resumen de un periodo comparado con el anterior y la serie de una variable.

import type { AlmacenPasarelas } from "../pasarelas/almacen";
import { DIAS_DETALLE } from "../pasarelas/ahorro";
import type { Pasarela, VariableOpc } from "../pasarelas/modelo";
import { DIA, HORA, MAX_DIAS, metaPorNombre, tramoPara, type Ejecutado, type MetaVariable, type ResumenVariable, type Tramo } from "./modelo";

export type Instalacion = { id: string; nombre: string; simulada: boolean; primera: number | null; ultima: number | null; variables: MetaVariable[] };
export type RespuestaResumen = { desde: number; hasta: number; actual: ResumenVariable[]; anterior: ResumenVariable[]; ejecutado: Ejecutado[] };
export type RespuestaSerie = { desde: number; hasta: number; tramoMs: number; actual: Tramo[]; anterior: Tramo[]; /** El periodo alcanza fechas de las que ya solo queda el resumen por horas. */ porHoras?: boolean };

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

/** Las órdenes dadas a una instalación entre dos instantes, de la más reciente a la más antigua, con el nombre claro de su variable. */
export async function ejecutadoDe(a: AlmacenPasarelas, id: string, nombres: Map<string, MetaVariable>, desde: number, hasta: number, ahora: number): Promise<Ejecutado[]> {
  // Lo que el programa no recogió a tiempo queda como no hecho antes de enseñarlo.
  await a.caducarOrdenes(id, ahora);
  return (await a.ordenes(id, { desde, hasta: hasta - 1, limite: 5000 })).map((o) => {
    const m = nombres.get(o.n);
    return {
      id: o.id,
      t: o.pedida,
      v: o.n,
      que: m ? `${m.grupo} · ${m.nombre}` : o.n,
      ...(o.antes !== undefined && o.antes !== null ? { antes: o.antes } : {}),
      valor: o.valor,
      ...(o.leido !== undefined && o.leido !== null ? { leido: o.leido } : {}),
      estado: o.estado,
      ...(o.motivo ? { motivo: o.motivo } : {}),
      ...(o.por ? { quien: o.por } : {}),
      ...(o.simulada ? { simulada: true } : {}),
    };
  });
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

/** Quién puede ver qué instalación. Sin filtro, todas (el panel interno y el equipo de Gradiox). */
export type Filtro = (p: Pasarela) => boolean;
const todas: Filtro = () => true;

export async function instalaciones(a: AlmacenPasarelas, ver: Filtro = todas): Promise<Instalacion[]> {
  const out: Instalacion[] = [];
  for (const p of (await a.listar()).filter(ver)) {
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

async function pasarela(a: AlmacenPasarelas, id: string, ver: Filtro) {
  const p = /^[0-9a-f-]{36}$/.test(id) ? await a.leer(id) : null;
  // A quien no puede verla se le contesta igual que si no existiera.
  if (!p || !ver(p)) throw new ErrorConsulta("Esa instalación no existe", 404);
  return p;
}

export async function resumen(a: AlmacenPasarelas, id: string, desde: unknown, hasta: unknown, ahora: number, ver: Filtro = todas): Promise<RespuestaResumen> {
  const p = await pasarela(a, id, ver);
  const r = periodo(desde, hasta);
  const largo = r.hasta - r.desde;
  const [actual, anterior, leidas] = [await a.resumenLecturas(id, r.desde, r.hasta), await a.resumenLecturas(id, r.desde - largo, r.desde), await a.variablesLeidas(id)];
  const nombres = new Map(metas(p, leidas).map((m) => [m.v, m]));
  return { ...r, actual, anterior, ejecutado: await ejecutadoDe(a, id, nombres, r.desde, r.hasta, ahora) };
}

export async function serie(a: AlmacenPasarelas, id: string, variable: string, desde: unknown, hasta: unknown, ahora: number, ver: Filtro = todas): Promise<RespuestaSerie> {
  await pasarela(a, id, ver);
  if (!variable || variable.length > 200) throw new ErrorConsulta("Falta la variable");
  const r = periodo(desde, hasta);
  const largo = r.hasta - r.desde;
  // Del detalle solo quedan los últimos días: más atrás se enseña por horas.
  const porHoras = r.desde - largo < ahora - DIAS_DETALLE * DIA;
  const tramoMs = Math.max(tramoPara(r.desde, r.hasta), porHoras ? HORA : 0);
  return { ...r, tramoMs, ...(porHoras ? { porHoras } : {}), actual: await a.serieLecturas(id, variable, r.desde, r.hasta, tramoMs), anterior: await a.serieLecturas(id, variable, r.desde - largo, r.desde, tramoMs) };
}
