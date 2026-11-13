// Única puerta de las pantallas y de los cálculos a los datos de la instalación.
// Hoy detrás está la simulación. El día que lleguen lecturas reales, basta con
// dar otra fuente a `usarFuente`: las pantallas no cambian.
//
// Lo que sigue fijo aquí es la descripción de la instalación (servicios,
// autómatas, pasarela). Con datos reales vendría de un alta de instalación.

import * as sim from "./sim";

export * from "./sim";

export type Fuente = {
  nombre: string;
  /** true si los datos no vienen de una instalación de verdad. */
  simulada: boolean;
  leer: typeof sim.leer;
  serie: typeof sim.serie;
  eventos: typeof sim.eventos;
  anticipos: typeof sim.anticipos;
};

export const FUENTE_SIMULADA: Fuente = { nombre: "Simulación", simulada: true, leer: sim.leer, serie: sim.serie, eventos: sim.eventos, anticipos: sim.anticipos };

let actual: Fuente = FUENTE_SIMULADA;
export function usarFuente(f: Fuente) {
  actual = f;
}
export const fuenteActual = () => actual;

export const leer: Fuente["leer"] = (...a) => actual.leer(...a);
export const serie: Fuente["serie"] = (...a) => actual.serie(...a);
export const eventos: Fuente["eventos"] = (...a) => actual.eventos(...a);
export const anticipos: Fuente["anticipos"] = (...a) => actual.anticipos(...a);
