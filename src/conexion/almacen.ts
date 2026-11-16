// Dónde guarda la nube lo que entregan las pasarelas. La app solo conoce esta
// interfaz: hoy detrás hay memoria del propio servidor, válida para el banco de
// pruebas; con una base de datos basta con dar otra implementación.

import type { LecturaEquipo } from "./perfil";
import type { Medida } from "./pasarela";

export type Almacen = {
  guardar(pasarela: string, lote: Medida[]): Promise<void>;
  /** La última medida de cada equipo de una pasarela. */
  ultimas(pasarela: string): Promise<Medida[]>;
  /** Medidas de un equipo desde `desde`, de la más antigua a la más reciente. */
  serie(pasarela: string, equipo: string, desde: number): Promise<Medida[]>;
};

/** Almacén en memoria. Se pierde al reiniciar el servidor: solo para pruebas. */
export function almacenEnMemoria(maximoPorEquipo = 20_000): Almacen {
  const datos = new Map<string, Medida[]>();
  const clave = (pasarela: string, equipo: string) => `${pasarela}\n${equipo}`;
  return {
    async guardar(pasarela, lote) {
      for (const m of lote) {
        const k = clave(pasarela, m.equipo);
        const lista = datos.get(k) ?? [];
        // Una pasarela puede reenviar un lote si no supo que llegó: no se duplica.
        if (lista.some((x) => x.t === m.t)) continue;
        lista.push(m);
        lista.sort((a, b) => a.t - b.t);
        if (lista.length > maximoPorEquipo) lista.splice(0, lista.length - maximoPorEquipo);
        datos.set(k, lista);
      }
    },
    async ultimas(pasarela) {
      const out: Medida[] = [];
      for (const [k, lista] of datos) if (k.startsWith(`${pasarela}\n`) && lista.length) out.push(lista[lista.length - 1]);
      return out.sort((a, b) => a.equipo.localeCompare(b.equipo));
    },
    async serie(pasarela, equipo, desde) {
      return (datos.get(clave(pasarela, equipo)) ?? []).filter((m) => m.t >= desde);
    },
  };
}

const global = globalThis as { __gradioxAlmacen?: Almacen };
/** El almacén del servidor. Uno solo por proceso. */
export function almacen(): Almacen {
  return (global.__gradioxAlmacen ??= almacenEnMemoria());
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const NUMEROS = ["temperatura", "consigna"] as const;
const BOOLEANOS = ["compresor", "puerta", "desescarche", "alarma"] as const;
export const MAXIMO_POR_ENVIO = 5000;

/** Comprueba lo que manda una pasarela y devuelve el lote limpio, o el motivo por el que no vale. */
export function validarLote(cuerpo: unknown): { lote: Medida[] } | { error: string } {
  if (typeof cuerpo !== "object" || cuerpo === null) return { error: "El cuerpo no es un objeto" };
  const medidas = (cuerpo as { medidas?: unknown }).medidas;
  if (!Array.isArray(medidas)) return { error: "Falta la lista de medidas" };
  if (medidas.length > MAXIMO_POR_ENVIO) return { error: `Demasiadas medidas en un envío (máximo ${MAXIMO_POR_ENVIO})` };
  const lote: Medida[] = [];
  for (const [i, bruta] of medidas.entries()) {
    if (typeof bruta !== "object" || bruta === null) return { error: `La medida ${i} no es un objeto` };
    const m = bruta as Record<string, unknown>;
    if (typeof m.equipo !== "string" || !m.equipo || m.equipo.length > 80 || m.equipo.includes("\n")) return { error: `La medida ${i} no dice de qué equipo es` };
    if (!esNumero(m.t) || m.t <= 0) return { error: `La medida ${i} no tiene instante` };
    if (m.lectura === null || m.lectura === undefined) {
      lote.push({ equipo: m.equipo, t: m.t, lectura: null, error: typeof m.error === "string" ? m.error.slice(0, 200) : undefined });
      continue;
    }
    if (typeof m.lectura !== "object") return { error: `La lectura de la medida ${i} no es un objeto` };
    const l = m.lectura as Record<string, unknown>;
    const lectura: LecturaEquipo = { t: m.t };
    for (const k of NUMEROS) {
      if (l[k] === undefined) continue;
      if (!esNumero(l[k]) || Math.abs(l[k]) > 500) return { error: `La medida ${i} trae un valor de ${k} que no es válido` };
      lectura[k] = l[k];
    }
    for (const k of BOOLEANOS) {
      if (l[k] === undefined) continue;
      if (typeof l[k] !== "boolean") return { error: `La medida ${i} trae un valor de ${k} que no es válido` };
      lectura[k] = l[k];
    }
    lote.push({ equipo: m.equipo, t: m.t, lectura });
  }
  return { lote };
}
