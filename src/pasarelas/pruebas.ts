// Pruebas programadas de órdenes: poner una variable a un valor a una hora,
// dejarla así unos minutos y devolverla sola al valor que tenía. Sirven para
// comprobar de punta a punta que una orden sale del panel, llega al PLC y
// vuelve, sin que nadie tenga que acordarse de deshacerla.
//
// Van por las órdenes de siempre, con sus dos llaves y sus límites: la prueba
// solo decide cuándo se pide cada una. Avanza cada vez que el programa de la
// planta pregunta por órdenes (cada pocos segundos), así que sin programa
// conectado no pasa nada: ni la ida ni la vuelta. La vuelta se reintenta hasta
// que queda hecha.

import { randomBytes } from "node:crypto";
import type { AlmacenPasarelas } from "./almacen";
import type { Pasarela } from "./modelo";
import { nuevaOrden, validarValor, type Escritura, type Orden } from "./ordenes";

export type EstadoPrueba = "programada" | "aplicando" | "aplicada" | "volviendo" | "devuelta" | "anulada" | "fallida";

export type Prueba = {
  id: string;
  n: string;
  valor: boolean | number;
  /** El valor al que vuelve: el que tenía la variable al programar la prueba. */
  original: boolean | number;
  /** Cuándo se pide la ida (ms). */
  inicio: number;
  /** Cuánto se deja con el valor nuevo antes de volver. */
  minutos: number;
  estado: EstadoPrueba;
  /** Cuándo quedó hecha la ida: desde ahí se cuentan los minutos. */
  aplicada?: number;
  ida?: string;
  vuelta?: string;
  /** Veces que se ha pedido la vuelta. */
  intentos?: number;
  motivo?: string;
  por: string;
  creada: number;
  cambio: number;
};

export const MAX_MINUTOS = 240;
export const MAX_ANTELACION_MS = 7 * 86_400_000;
export const MAX_GUARDADAS = 20;
const ABIERTAS: EstadoPrueba[] = ["programada", "aplicando", "aplicada", "volviendo"];
export const enCurso = (p: Prueba) => ABIERTAS.includes(p.estado);

const mismoTipo = (a: unknown, b: unknown) => typeof a === typeof b;

/** Comprueba y crea una prueba. `actual` es la última lectura de la variable. */
export function nuevaPrueba(
  e: Escritura | undefined,
  pruebas: Prueba[],
  b: { n?: unknown; valor?: unknown; inicio?: unknown; minutos?: unknown },
  actual: unknown,
  ahora: number,
  por: string,
): Prueba | { error: string } {
  if (!e?.activa) return { error: "Las órdenes no están activadas en esta conexión" };
  const n = typeof b.n === "string" ? b.n : "";
  const lim = e.variables.find((x) => x.n === n);
  const v = validarValor(lim, b.valor);
  if ("error" in v) return v;
  if (actual === undefined || actual === null || typeof actual === "string") return { error: "No hay una lectura de esa variable: sin saber su valor de ahora no se puede devolver" };
  const vuelta = validarValor(lim, actual);
  if ("error" in vuelta) return { error: `El valor de ahora (${String(actual)}) queda fuera de los límites, y la vuelta no podría darse` };
  if (!mismoTipo(vuelta.valor, v.valor)) return { error: "El valor nuevo no es del mismo tipo que el de ahora" };
  if (vuelta.valor === v.valor) return { error: "El valor nuevo es el mismo que tiene ahora" };
  const minutos = Math.round(Number(b.minutos));
  if (!Number.isFinite(minutos) || minutos < 1 || minutos > MAX_MINUTOS) return { error: `La duración va de 1 a ${MAX_MINUTOS} minutos` };
  const inicio = b.inicio === undefined || b.inicio === null || b.inicio === "" ? ahora : Number(b.inicio);
  if (!Number.isFinite(inicio) || inicio < ahora - 60_000) return { error: "Esa hora ya ha pasado" };
  if (inicio > ahora + MAX_ANTELACION_MS) return { error: "Como mucho con siete días de antelación" };
  if (pruebas.some((p) => enCurso(p) && p.n === n)) return { error: "Ya hay una prueba en curso con esa variable" };
  return { id: randomBytes(8).toString("hex"), n, valor: v.valor, original: vuelta.valor, inicio: Math.max(inicio, ahora), minutos, estado: "programada", por, creada: ahora, cambio: ahora };
}

/** Lo que se guarda: las en curso y las últimas terminadas. */
export const recortar = (pruebas: Prueba[]) => {
  const abiertas = pruebas.filter(enCurso);
  const cerradas = pruebas.filter((p) => !enCurso(p)).sort((a, b) => b.cambio - a.cambio);
  return [...abiertas, ...cerradas].slice(0, Math.max(MAX_GUARDADAS, abiertas.length));
};

/**
 * Da un paso a cada prueba en curso. Pide la ida al llegar la hora, la da por
 * hecha cuando el PLC la confirma, pide la vuelta pasados los minutos y la
 * repite si falla. Devuelve las pruebas cambiadas o null si nada cambió.
 */
export async function avanzarPruebas(a: AlmacenPasarelas, p: Pasarela, ahora: number): Promise<Prueba[] | null> {
  const pruebas = p.pruebas ?? [];
  if (!pruebas.some(enCurso)) return null;
  let cambio = false;
  const recientes = await a.ordenes(p.id, { desde: ahora - 2 * 86_400_000, limite: 200 });
  const porId = new Map(recientes.map((o) => [o.id, o]));
  const abiertas = await a.ordenesAbiertas(p.id);
  const ocupada = (n: string) => abiertas.some((o) => o.n === n);
  const pedir = async (pr: Prueba, valor: boolean | number, antes: Orden["antes"], que: string) => {
    const o = nuevaOrden(pr.n, valor, antes, ahora, `Prueba programada · ${que}`);
    await a.ponerOrden(p.id, o);
    abiertas.push(o);
    return o.id;
  };
  const out: Prueba[] = [];
  for (const pr0 of pruebas) {
    let pr = pr0;
    const poner = (x: Partial<Prueba>) => { pr = { ...pr, ...x, cambio: ahora }; cambio = true; };
    if (pr.estado === "programada" && ahora >= pr.inicio && !ocupada(pr.n)) {
      poner({ estado: "aplicando", ida: await pedir(pr, pr.valor, pr.original, "ida") });
    } else if (pr.estado === "aplicando") {
      const o = pr.ida ? porId.get(pr.ida) : undefined;
      if (o?.estado === "hecha") {
        // Vuelve a lo que de verdad tenía el PLC justo antes de escribir, si el programa lo leyó.
        const lim = p.escritura?.variables.find((x) => x.n === pr.n);
        const leido = o.antes === undefined || o.antes === null ? null : validarValor(lim, o.antes);
        const original = leido && "valor" in leido && typeof leido.valor === typeof pr.original ? leido.valor : pr.original;
        poner({ estado: "aplicada", aplicada: o.cambio, original });
      }
      else if (!o || o.estado === "rechazada" || o.estado === "caducada" || o.estado === "anulada") poner({ estado: "fallida", motivo: `La ida no se hizo: ${o?.motivo ?? "no se encuentra la orden"}` });
    }
    if (pr.estado === "aplicada" && ahora >= (pr.aplicada ?? pr.inicio) + pr.minutos * 60_000 && !ocupada(pr.n)) {
      poner({ estado: "volviendo", vuelta: await pedir(pr, pr.original, pr.valor, "vuelta"), intentos: (pr.intentos ?? 0) + 1 });
    } else if (pr.estado === "volviendo") {
      const o = pr.vuelta ? porId.get(pr.vuelta) : undefined;
      if (o?.estado === "hecha") poner({ estado: "devuelta", motivo: undefined });
      else if ((!o || o.estado === "rechazada" || o.estado === "caducada" || o.estado === "anulada") && !ocupada(pr.n)) {
        // La vuelta no se abandona: se pide otra vez.
        poner({ vuelta: await pedir(pr, pr.original, pr.valor, "vuelta"), intentos: (pr.intentos ?? 0) + 1, motivo: `Vuelta repetida: ${o?.motivo ?? "no se encuentra la orden"}` });
      }
    }
    out.push(pr);
  }
  return cambio ? recortar(out) : null;
}

/** Desde el panel: anular una prueba que no ha empezado, o adelantar la vuelta de una que está en marcha. */
export function pararPrueba(pruebas: Prueba[], id: string, ahora: number): Prueba[] | { error: string } {
  const pr = pruebas.find((x) => x.id === id);
  if (!pr || !enCurso(pr)) return { error: "Esa prueba ya ha terminado o no existe" };
  const cambiada: Prueba =
    pr.estado === "programada"
      ? { ...pr, estado: "anulada", motivo: "Anulada desde el panel", cambio: ahora }
      : pr.estado === "aplicada"
        ? // Se acorta: en el próximo paso se pide la vuelta.
          { ...pr, minutos: 0, aplicada: Math.min(pr.aplicada ?? ahora, ahora), motivo: "Vuelta adelantada desde el panel", cambio: ahora }
        : pr.estado === "aplicando"
          ? { ...pr, minutos: 0, motivo: "Vuelta adelantada desde el panel", cambio: ahora }
          : pr;
  if (cambiada === pr) return { error: "La vuelta ya está en marcha" };
  return pruebas.map((x) => (x.id === id ? cambiada : x));
}
