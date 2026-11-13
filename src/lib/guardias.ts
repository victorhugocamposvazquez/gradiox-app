// Guardias: a quién se avisa de una alarma y a quién pasa si nadie la atiende.
// Simulado: hoy no se manda ningún SMS ni se hace ninguna llamada.

export type Canal = "Notificación" | "SMS" | "Llamada";
export const CANALES: Canal[] = ["Notificación", "SMS", "Llamada"];
export type Guardia = { id: string; puesto: string; canal: Canal };

export const GUARDIAS_INICIALES: Guardia[] = [
  { id: "g1", puesto: "Encargado de turno", canal: "Notificación" },
  { id: "g2", puesto: "Técnico de guardia", canal: "Llamada" },
  { id: "g3", puesto: "Responsable de la nave", canal: "Llamada" },
];

export type Escalado = { avisados: Guardia[]; siguiente: Guardia | null; faltanMin: number };

/** A quién se ha avisado ya de una alarma que empezó en `desde` y sigue sin atender en `t`. */
export function escalado(desde: number, t: number, guardias: Guardia[], esperaMin: number): Escalado {
  if (!guardias.length) return { avisados: [], siguiente: null, faltanMin: 0 };
  const pasados = Math.max(0, (t - desde) / 60_000);
  const nivel = Math.min(guardias.length - 1, Math.floor(pasados / esperaMin));
  const siguiente = guardias[nivel + 1] ?? null;
  return { avisados: guardias.slice(0, nivel + 1), siguiente, faltanMin: siguiente ? Math.max(1, Math.ceil((nivel + 1) * esperaMin - pasados)) : 0 };
}
