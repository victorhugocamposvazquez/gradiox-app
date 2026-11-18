// Los históricos de la nave de demostración: mismas cuentas que con una
// instalación conectada, pero las lecturas salen de la simulación.

import { CAMARAS, serie, type Ajustes, type Camara, type Lectura } from "@/lib/datos";
import { ORDENES, type OrdenDada } from "@/lib/fallos";
import type { RespuestaResumen, RespuestaSerie } from "./consulta";
import { DIA, resumir, tramoPara, tramos, type Ejecutado, type MetaVariable, type Muestra } from "./modelo";

export const ID_SIMULADA = "demo";

type Campo = "temp" | "consigna" | "compresor" | "puerta" | "desescarche";
const CAMPOS: { campo: Campo; nombre: string; clase: MetaVariable["clase"]; vale: (c: Camara) => boolean }[] = [
  { campo: "temp", nombre: "Temperatura", clase: "numero", vale: () => true },
  { campo: "consigna", nombre: "Consigna", clase: "numero", vale: () => true },
  { campo: "compresor", nombre: "Compresor en marcha", clase: "sino", vale: (c) => !c.sinCompresor },
  { campo: "puerta", nombre: "Puerta abierta", clase: "sino", vale: (c) => !c.sinPuerta },
  { campo: "desescarche", nombre: "Desescarche", clase: "sino", vale: (c) => c.desescarche > 0 },
];

export const VARIABLES_SIMULADAS: MetaVariable[] = CAMARAS.flatMap((c) =>
  CAMPOS.filter((k) => k.vale(c)).map((k) => ({ v: `${c.id}.${k.campo}`, nombre: k.nombre, grupo: c.nombre, clase: k.clase, ...(k.clase === "numero" ? { unidad: "°C" } : {}) })),
);

/** Cada cuántos minutos se toma una lectura simulada: más espaciadas cuanto más largo el periodo. */
const pasoMin = (desde: number, hasta: number) => (hasta - desde <= 2 * DIA ? 5 : hasta - desde <= 8 * DIA ? 15 : 30);

function lecturas(c: Camara, desde: number, hasta: number, aj: Ajustes, ahora: number): Lectura[] {
  const fin = Math.min(hasta, ahora);
  if (fin <= desde) return [];
  return serie(c, fin, aj, (fin - desde) / 3_600_000, pasoMin(desde, hasta)).filter((l) => l.t >= desde && l.estado !== "sindatos");
}
const muestras = (ls: Lectura[], campo: Campo): Muestra[] => ls.map((l) => ({ t: l.t, x: l[campo] }));

export function ejecutadoSimulado(ordenes: OrdenDada[]): Ejecutado[] {
  return ordenes
    .map((o): Ejecutado => {
      const c = CAMARAS.find((x) => x.id === o.camaraId);
      return { id: o.id, t: o.cuando, que: `${c?.nombre ?? o.camaraId} · ${ORDENES[o.orden]}`, estado: "hecha", motivo: `${o.fallo}. ${o.resultado}`, quien: o.auto ? "Automático" : "Desde la app", simulada: true };
    })
    .sort((a, b) => b.t - a.t);
}

export function resumenSimulado(desde: number, hasta: number, aj: Ajustes, ordenes: OrdenDada[], ahora: number): RespuestaResumen {
  const largo = hasta - desde;
  const de = (d: number, h: number) =>
    CAMARAS.flatMap((c) => {
      const ls = lecturas(c, d, h, aj, ahora);
      return CAMPOS.filter((k) => k.vale(c)).map((k) => resumir(`${c.id}.${k.campo}`, muestras(ls, k.campo), d, h, pasoMin(d, h) * 60_000)).filter((r) => r !== null);
    });
  return { desde, hasta, actual: de(desde, hasta), anterior: de(desde - largo, desde), ejecutado: ejecutadoSimulado(ordenes).filter((e) => e.t >= desde && e.t < hasta) };
}

export function serieSimulada(variable: string, desde: number, hasta: number, aj: Ajustes, ahora: number): RespuestaSerie {
  const [id, campo] = variable.split(".") as [string, Campo];
  const c = CAMARAS.find((x) => x.id === id);
  const largo = hasta - desde;
  const tramoMs = tramoPara(desde, hasta);
  const de = (d: number, h: number) => (c ? tramos(muestras(lecturas(c, d, h, aj, ahora), campo), d, h, tramoMs, pasoMin(d, h) * 60_000) : []);
  return { desde, hasta, tramoMs, actual: de(desde, hasta), anterior: de(desde - largo, desde) };
}
