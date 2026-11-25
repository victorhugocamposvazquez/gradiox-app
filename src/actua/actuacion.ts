// Una actuación: Gradiox cambia las tres consignas de una cámara para ahorrar.
// Queda apuntado qué cambió, cuánto esperaba ahorrar y, después, cuánto se ve
// en las horas de marcha de verdad. Se puede deshacer con un botón, y se
// deshace sola si la temperatura se queda en el límite.

import { randomUUID } from "node:crypto";
import type { Tramo } from "../historicos/modelo";
import type { LecturaOpc } from "../pasarelas/modelo";
import { nuevaOrden, validarValor, type Escritura, type Orden } from "../pasarelas/ordenes";
import type { VariablesCamara } from "./camaras";
import { PERIODOS, type Consignas, type Periodo, type Propuesta, type Tarifa } from "./optimiza";

export type EstadoActuacion = "aplicada" | "deshecha" | "revertida";

export type Actuacion = {
  id: string;
  /** Clave de la cámara en el autómata, p. ej. «Datos_C6_1». */
  camara: string;
  nombre: string;
  estado: EstadoActuacion;
  vars: VariablesCamara;
  antes: Consignas;
  despues: Consignas;
  /** Temperatura del aire a partir de la cual se deshace sola. */
  techo: number;
  previsto: { eurosDia: number; eurosAno: number; kwhDia: number; parte: number; marchaAntes: Record<Periodo, number>; marchaDespues: Record<Periodo, number>; kwhAntes: Record<Periodo, number>; kwhDespues: Record<Periodo, number> };
  tarifa: Tarifa;
  por: string;
  aplicada: number;
  /** Cuándo se deshizo y por qué. */
  cerrada?: number;
  motivo?: string;
  /** Desde cuándo está la temperatura en el límite, si lo está. */
  sobre?: number;
};

export const ACTIVA: EstadoActuacion[] = ["aplicada"];

/** Las consignas que cambian de verdad, con su variable. */
export const cambiosDe = (vars: VariablesCamara, de: Consignas, a: Consignas) => PERIODOS.filter((p) => de[p] !== a[p]).map((p) => ({ periodo: p, n: vars.consigna[p], de: de[p], a: a[p] }));

/**
 * Comprueba que las órdenes están activadas y que cada consigna nueva cabe en
 * los límites que se pusieron para esa variable. Devuelve qué falta, en claro,
 * o las órdenes listas para dar.
 */
export function prepararOrdenes(escritura: Escritura | undefined, vars: VariablesCamara, de: Consignas, a: Consignas, ahora: number, por: string): { error: string } | { ordenes: Orden[] } {
  if (!escritura?.activa) return { error: "Las órdenes no están activadas en esta conexión. Se activan en «Actuar a mano», dentro de la instalación." };
  const ordenes: Orden[] = [];
  for (const c of cambiosDe(vars, de, a)) {
    const v = validarValor(escritura.variables.find((x) => x.n === c.n), c.a);
    if ("error" in v) return { error: `${c.n}: ${v.error}` };
    ordenes.push(nuevaOrden(c.n, v.valor, c.de, ahora, por));
  }
  if (!ordenes.length) return { error: "No hay nada que cambiar" };
  return { ordenes };
}

/** Las líneas que hay que poner en «Órdenes al PLC» para que esta cámara se pueda optimizar. */
export const lineasEscribibles = (vars: VariablesCamara, suelo: number, techo: number) => PERIODOS.map((p) => `${vars.consigna[p]}; ${Math.floor(suelo)}; ${Math.ceil(techo)}`);

export function nuevaActuacion(camara: string, nombre: string, vars: VariablesCamara, antes: Consignas, p: Propuesta, techo: number, tarifa: Tarifa, ahora: number, por: string): Actuacion {
  if (!p.mejor) throw new Error("No hay propuesta");
  return {
    id: randomUUID(),
    camara,
    nombre,
    estado: "aplicada",
    vars,
    antes,
    despues: p.mejor.consignas,
    techo,
    previsto: { eurosDia: p.eurosDia, eurosAno: p.eurosAno, kwhDia: p.kwhDia, parte: p.parte, marchaAntes: p.ahora.marcha, marchaDespues: p.mejor.dia.marcha, kwhAntes: p.ahora.kwh, kwhDespues: p.mejor.dia.kwh },
    tarifa,
    por,
    aplicada: ahora,
  };
}

/** Rato seguido en el límite que se aguanta antes de devolver las consignas: un desescarche o una puerta abierta no cuentan. */
export const AGUANTE_MS = 15 * 60_000;
/** Grados por encima del límite a partir de los que no se espera nada. */
export const URGENTE = 2;

/**
 * Mira las lecturas de temperatura de un lote. Dice si hay que devolver las
 * consignas ya (`revertir`, con la temperatura que lo provoca) o desde cuándo
 * está la cámara en su límite (`sobre`; sin valor si está por debajo).
 */
export function mirarTecho(a: Actuacion, lote: LecturaOpc[], ahora: number): { revertir: number } | { sobre: number | undefined } {
  const suyas = lote.filter((l) => l.v === a.vars.temperatura && typeof l.x === "number" && l.t >= a.aplicada).sort((x, y) => x.t - y.t) as (LecturaOpc & { x: number })[];
  let sobre = a.sobre;
  let ultima: number | null = null;
  for (const l of suyas) {
    if (l.x >= a.techo + URGENTE) return { revertir: l.x };
    if (l.x >= a.techo) sobre ??= l.t;
    else sobre = undefined;
    ultima = l.x;
    if (sobre !== undefined && l.t - sobre >= AGUANTE_MS) return { revertir: l.x };
  }
  // Sin lecturas nuevas la temperatura sigue donde estaba: el reloj corre igual.
  if (sobre !== undefined && ahora - sobre >= AGUANTE_MS) return { revertir: ultima ?? a.techo };
  return { sobre };
}

export type Medido = {
  /** Horas con dato antes y después. */
  horasAntes: number;
  horasDespues: number;
  marchaAntes: Record<Periodo, number | null>;
  marchaDespues: Record<Periodo, number | null>;
  /** Ahorro al día con los kW de la previsión y las horas de marcha de verdad. Null si aún no hay un día entero a cada lado. */
  eurosDia: number | null;
};

export const HORA = 3_600_000;
/** Hace falta al menos un día entero de lecturas a cada lado para comparar. */
export const HORAS_MINIMAS = 24;

/**
 * Compara las horas de marcha de verdad antes y después de la actuación, tramo
 * a tramo, solo en días laborables. `horas` son los tramos de una hora de la
 * variable «está enfriando»; `horaLocal` dice qué hora del día y qué día de la
 * semana es cada instante en la planta.
 */
export function medir(a: Actuacion, horas: Tramo[], hasta: number, horaLocal: (t: number) => { hora: number; laborable: boolean }): Medido {
  const suma = () => ({ punta: { si: 0, ms: 0 }, llana: { si: 0, ms: 0 }, valle: { si: 0, ms: 0 } });
  const antes = suma();
  const despues = suma();
  let msAntes = 0, msDespues = 0;
  const fin = a.cerrada ?? hasta;
  for (const h of horas) {
    if (h.activa === null || h.ms <= 0) continue;
    const lado = h.t + HORA <= a.aplicada ? antes : h.t >= a.aplicada && h.t + HORA <= fin ? despues : null;
    if (!lado) continue;
    const { hora, laborable } = horaLocal(h.t);
    if (!laborable) continue;
    const p = a.tarifa.horas[hora];
    lado[p].si += h.activa * h.ms;
    lado[p].ms += h.ms;
    if (lado === antes) msAntes += h.ms;
    else msDespues += h.ms;
  }
  const parte = (s: ReturnType<typeof suma>) => ({ punta: s.punta.ms ? s.punta.si / s.punta.ms : null, llana: s.llana.ms ? s.llana.si / s.llana.ms : null, valle: s.valle.ms ? s.valle.si / s.valle.ms : null });
  const marchaAntes = parte(antes);
  const marchaDespues = parte(despues);
  const horasAntes = msAntes / HORA;
  const horasDespues = msDespues / HORA;
  let eurosDia: number | null = null;
  if (horasAntes >= HORAS_MINIMAS && horasDespues >= HORAS_MINIMAS && PERIODOS.every((p) => marchaAntes[p] !== null && marchaDespues[p] !== null)) {
    // kW eléctricos que gasta en marcha, sacados de la previsión; el resto son las horas de marcha de verdad.
    const horasTramo = (p: Periodo) => a.tarifa.horas.filter((x) => x === p).length;
    const horasPrevistas = PERIODOS.reduce((s, p) => s + a.previsto.marchaAntes[p] * horasTramo(p), 0);
    const kw = horasPrevistas > 0 ? PERIODOS.reduce((s, p) => s + a.previsto.kwhAntes[p], 0) / horasPrevistas : 0;
    const coste = (marcha: Record<Periodo, number | null>) => PERIODOS.reduce((s, p) => s + (marcha[p] ?? 0) * horasTramo(p) * kw * a.tarifa.precio[p], 0);
    eurosDia = coste(marchaAntes) - coste(marchaDespues);
  }
  return { horasAntes, horasDespues, marchaAntes, marchaDespues, eurosDia };
}

/** Hora y día de la semana en la península, que es donde están las plantas de momento. */
const FORMATO = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23", weekday: "short" });
export function horaPeninsula(t: number): { hora: number; laborable: boolean } {
  const partes = FORMATO.formatToParts(new Date(t));
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  return { hora, laborable: dia !== "Sat" && dia !== "Sun" };
}
