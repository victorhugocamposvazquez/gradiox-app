// Cómo se guardan las lecturas para que no llenen el disco. Tres capas:
//  1. Solo se guarda una lectura si cambia respecto a la última guardada de su
//     variable, o si han pasado diez minutos (lectura de control: dice que la
//     variable sigue viva y con el mismo valor).
//  2. El detalle se conserva treinta días. Antes de borrarlo queda resumido por
//     horas (mínima, media, máxima, tiempo en «sí», arranques).
//  3. El resumen por horas y las órdenes no se borran nunca.

import type { LecturaOpc } from "./modelo";

/** Cada cuánto se guarda una lectura aunque no haya cambiado. */
export const CONTROL_MS = 10 * 60_000;
/** Lo que vale una lectura guardada si no llega otra: pasado este rato, se entiende que no hay datos. */
export const VIGENCIA_MS = 15 * 60_000;
/** Días que se conserva el detalle de las lecturas. */
export const DIAS_DETALLE = 30;

export type Previa = Pick<LecturaOpc, "t" | "x" | "c">;

/** Un número ha cambiado si se mueve más de medio punto por ciento (o de una centésima, para valores pequeños). */
export function distinto(a: LecturaOpc["x"], b: LecturaOpc["x"]): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) > Math.max(0.01, Math.abs(a) * 0.005);
  return a !== b;
}

/**
 * De un lote, lo que merece guardarse. `previas` es la última lectura guardada
 * de cada variable antes del lote. Con el mismo lote y las mismas previas sale
 * siempre lo mismo: si el programa repite un envío, no se guarda nada de más.
 */
export function soloCambios(lote: LecturaOpc[], previas: Map<string, Previa>): LecturaOpc[] {
  const ultima = new Map(previas);
  const out: LecturaOpc[] = [];
  for (const l of [...lote].sort((a, b) => a.t - b.t)) {
    const p = ultima.get(l.v);
    if (p && l.t > p.t && l.t - p.t < CONTROL_MS && !distinto(p.x, l.x) && (p.c ?? "") === (l.c ?? "")) continue;
    out.push(l);
    if (!p || l.t > p.t) ultima.set(l.v, l);
  }
  return out;
}
