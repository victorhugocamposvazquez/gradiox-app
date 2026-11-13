// Histórico de cortes de conexión. Solo se apunta lo que pasa en este
// dispositivo desde que se usa la demostración: no hay un histórico inventado.

export type Corte = { id: string; equipoId: string; desde: number; hasta: number };

/**
 * Qué parte de las últimas `horas` ha estado conectado un equipo, de 0 a 100.
 * Cuenta los cortes ya cerrados y, si lo hay, el que sigue abierto desde `abierto`.
 */
export function tiempoConectado(cortes: Corte[], equipoId: string, ahora: number, abierto: number | undefined, horas = 24): number {
  const inicio = ahora - horas * 3_600_000;
  let caido = 0;
  for (const c of cortes) if (c.equipoId === equipoId) caido += Math.max(0, Math.min(c.hasta, ahora) - Math.max(c.desde, inicio));
  if (abierto !== undefined) caido += Math.max(0, ahora - Math.max(abierto, inicio));
  return Math.max(0, Math.round((1 - caido / (horas * 3_600_000)) * 1000) / 10);
}
