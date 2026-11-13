// Varias naves: lo que ve un instalador con más de una instalación. Solo la
// primera es la de la demostración; las demás son EJEMPLOS para enseñar la
// lista, con un estado inventado que cambia cada diez minutos.

import { AUTOMATAS, CAMARAS, PASARELA, azar, leer, type Ajustes, type Estado } from "./datos";

export type Nave = { id: string; nombre: string; detalle: string; servicios: number; ejemplo: boolean };
export const NAVES: Nave[] = [
  { id: "demo", nombre: "Nave de demostración", detalle: "La que se ve en Gradiox", servicios: CAMARAS.length, ejemplo: false },
  { id: "n2", nombre: "Plataforma de fresco", detalle: "Ejemplo de la lista", servicios: 8, ejemplo: true },
  { id: "n3", nombre: "Almacén de congelado", detalle: "Ejemplo de la lista", servicios: 12, ejemplo: true },
  { id: "n4", nombre: "Obrador y cámaras", detalle: "Ejemplo de la lista", servicios: 4, ejemplo: true },
];

export type EstadoNave = { estado: Estado; alarmas: number; avisos: number; sinDatos: number; resumen: string };
const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
export const porGravedad = (a: EstadoNave, b: EstadoNave) => GRAVEDAD[a.estado] - GRAVEDAD[b.estado];

export function estadoNave(n: Nave, indice: number, t: number, aj: Ajustes): EstadoNave {
  let alarmas = 0;
  let avisos = 0;
  let sinDatos = 0;
  if (n.ejemplo) {
    const r = azar(indice * 97 + 5, Math.floor(t / 600_000));
    if (r > 0.93) alarmas = 1;
    else if (r > 0.7) avisos = 1;
  } else {
    for (const c of CAMARAS) {
      const e = leer(c, t, aj).estado;
      if (e === "error") alarmas++;
      else if (e === "aviso") avisos++;
      else if (e === "sindatos") sinDatos++;
    }
    const cortes = aj.cortes ?? {};
    if (!sinDatos && [PASARELA, ...AUTOMATAS].some((x) => cortes[x.id] !== undefined)) sinDatos = 1;
  }
  const estado: Estado = alarmas ? "error" : sinDatos ? "sindatos" : avisos ? "aviso" : "correcto";
  const partes = [alarmas ? `${alarmas} en alarma` : "", sinDatos ? `${sinDatos} sin datos` : "", avisos ? `${avisos} con aviso` : ""].filter(Boolean);
  return { estado, alarmas, avisos, sinDatos, resumen: partes.join(" · ") || "Todo en orden" };
}
