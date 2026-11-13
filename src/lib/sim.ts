// Simulación de cámaras frigoríficas. Todo es una función del instante: la misma
// hora da siempre la misma lectura, así el histórico y el dato en vivo coinciden
// sin guardar nada. No hay ningún autómata detrás: son datos de demostración.

import { planDelDia, preciosDelDia } from "./luz";

export type TipoCamara = "congelado" | "fresco";
export type Camara = {
  id: string;
  nombre: string;
  tipo: TipoCamara;
  /** Temperatura que se le pide, en °C. */
  consigna: number;
  /** Temperatura que el género no debe pasar, en °C. */
  limite: number;
  /** Potencia del compresor, en kW. Valor de la simulación. */
  potenciaKw: number;
  /** Minutos de un ciclo completo de marcha y paro. */
  ciclo: number;
  /** Minutos que dura el desescarche. */
  desescarche: number;
};

export const CAMARAS: Camara[] = [
  { id: "c1", nombre: "Cámara 1", tipo: "congelado", consigna: -25, limite: -18, potenciaKw: 22, ciclo: 22, desescarche: 20 },
  { id: "c2", nombre: "Cámara 2", tipo: "congelado", consigna: -25, limite: -18, potenciaKw: 22, ciclo: 26, desescarche: 27 },
  { id: "c3", nombre: "Cámara 3", tipo: "congelado", consigna: -23, limite: -18, potenciaKw: 18, ciclo: 19, desescarche: 20 },
  { id: "c4", nombre: "Cámara 4", tipo: "fresco", consigna: 2, limite: 6, potenciaKw: 9, ciclo: 17, desescarche: 0 },
  { id: "c5", nombre: "Antecámara", tipo: "fresco", consigna: 6, limite: 10, potenciaKw: 6, ciclo: 15, desescarche: 0 },
];

/** Autómata que lee y manda sobre varios servicios. Reparto de la simulación. */
export type Automata = { id: string; nombre: string; camaras: string[] };
export const AUTOMATAS: Automata[] = [
  { id: "a1", nombre: "Autómata de congelado", camaras: ["c1", "c2", "c3"] },
  { id: "a2", nombre: "Autómata de fresco", camaras: ["c4", "c5"] },
];
/** Equipo que une los autómatas con el programa. Si cae, no llega nada. */
export const PASARELA = { id: "pasarela", nombre: "Pasarela de la nave" };
/** Cada cuántos segundos se lee cada autómata. */
export const SONDEO_S = 10;

export type Averia = { tipo: "compresor" | "puerta"; desde: number };
export type Ajustes = {
  averias: Record<string, Averia>;
  consignas: Record<string, number>;
  planActivo: boolean;
  /** Conexiones cortadas: instante del corte por autómata o por la pasarela. */
  cortes?: Record<string, number>;
};

/** Desde cuándo no llegan datos de un servicio en el instante `t`, o null si llegan. */
export function sinDatosDesde(camaraId: string, t: number, aj: Ajustes): number | null {
  const cortes = aj.cortes ?? {};
  const automata = AUTOMATAS.find((a) => a.camaras.includes(camaraId));
  const desde = [cortes[PASARELA.id], automata ? cortes[automata.id] : undefined].filter((d): d is number => d !== undefined && d <= t);
  return desde.length ? Math.min(...desde) : null;
}
export const AJUSTES_INICIALES: Ajustes = { averias: {}, consignas: {}, planActivo: false };

export type Estado = "correcto" | "aviso" | "error" | "sindatos";
export type Lectura = {
  t: number;
  /** Instante de la última lectura que llegó de verdad. Igual a `t` si hay conexión. */
  ultima: number;
  temp: number;
  consigna: number;
  compresor: boolean;
  puerta: boolean;
  puertaMin: number;
  desescarche: boolean;
  estado: Estado;
  motivo: string;
};

const MIN = 60_000;
const DUTY = 0.55;
const HISTERESIS = 0.7;
const CADA_DESESCARCHE = 360;

/** Número entre 0 y 1 que depende solo de sus dos entradas. */
export function azar(a: number, b: number): number {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return ((x >>> 0) % 100_000) / 100_000;
}

export function consignaEn(c: Camara, t: number, aj: Ajustes): number {
  const base = aj.consignas[c.id] ?? c.consigna;
  if (!aj.planActivo || c.tipo !== "congelado") return base;
  const fecha = new Date(t);
  const plan = planDelDia(preciosDelDia(fecha));
  const hora = fecha.getHours();
  if (plan.baratas.includes(hora)) return base - 2;
  if (plan.caras.includes(hora)) return Math.min(base + 2, c.limite - 3);
  return base;
}

function normal(c: Camara, idx: number, t: number, aj: Ajustes) {
  const min = t / MIN;
  const consigna = consignaEn(c, t, aj);
  const fase = (((min + idx * 7) / c.ciclo) % 1 + 1) % 1;
  let compresor = fase < DUTY;
  let temp = compresor
    ? consigna + HISTERESIS - 2 * HISTERESIS * (fase / DUTY)
    : consigna - HISTERESIS + 2 * HISTERESIS * ((fase - DUTY) / (1 - DUTY));

  let desescarche = false;
  if (c.desescarche > 0) {
    const d = (((min + idx * 53) % CADA_DESESCARCHE) + CADA_DESESCARCHE) % CADA_DESESCARCHE;
    if (d < c.desescarche) {
      desescarche = true;
      compresor = false;
      temp += 2 * (d / c.desescarche);
    } else if (d < c.desescarche + 30) {
      compresor = true;
      temp += 2 * (1 - (d - c.desescarche) / 30);
    }
  }

  const ventana = Math.floor(min / 10);
  const dentro = min - ventana * 10;
  const hora = new Date(t).getHours();
  const laborable = hora >= 6 && hora < 22;
  const seAbre = laborable && azar(idx + 1, ventana) < (c.tipo === "fresco" ? 0.18 : 0.1);
  const dura = 1 + Math.floor(azar(idx + 11, ventana) * 5);
  const puerta = seAbre && dentro < dura;
  if (seAbre) temp += puerta ? 0.25 * dentro : 0.25 * dura * Math.max(0, 1 - (dentro - dura) / (10 - dura));

  temp += (azar(idx + 31, Math.floor(min)) - 0.5) * 0.2;
  return { temp, consigna, compresor, puerta, puertaMin: puerta ? Math.floor(dentro) : 0, desescarche };
}

/**
 * Lo que el programa sabe de un servicio en el instante `t`. Sin conexión
 * devuelve la última lectura que llegó, marcada como «sin datos»: una cifra
 * parada no debe pasar por buena.
 */
export function leer(c: Camara, t: number, aj: Ajustes = AJUSTES_INICIALES): Lectura {
  const corte = sinDatosDesde(c.id, t, aj);
  if (corte === null) return leerVivo(c, t, aj);
  const ultima = leerVivo(c, corte, aj);
  return { ...ultima, t, ultima: corte, estado: "sindatos", motivo: t - corte < MIN ? "Sin datos desde ahora" : `Sin datos hace ${Math.floor((t - corte) / MIN)} min` };
}

function leerVivo(c: Camara, t: number, aj: Ajustes): Lectura {
  const idx = CAMARAS.findIndex((x) => x.id === c.id);
  const n = normal(c, idx, t, aj);
  let { temp, compresor, puerta, puertaMin } = n;
  const { consigna, desescarche } = n;
  const averia = aj.averias[c.id];
  const mins = averia && t >= averia.desde ? (t - averia.desde) / MIN : -1;

  if (averia && mins >= 0) {
    if (averia.tipo === "compresor") {
      const inicio = normal(c, idx, averia.desde, aj).temp;
      temp = Math.min(inicio + 0.12 * mins, 15);
      compresor = false;
    } else {
      puerta = true;
      puertaMin = Math.floor(mins);
      temp += Math.min(0.25 * mins, 8);
    }
  }

  let estado: Estado = "correcto";
  let motivo = desescarche ? "En desescarche" : "En consigna";
  if (averia?.tipo === "compresor" && mins >= 0) {
    estado = "error";
    motivo = "Compresor parado";
  } else if (temp >= c.limite) {
    estado = "error";
    motivo = "Temperatura por encima del límite";
  } else if (puerta && puertaMin >= 4) {
    estado = "aviso";
    motivo = `Puerta abierta ${puertaMin} min`;
  } else if (!desescarche && temp > consigna + 3) {
    estado = "aviso";
    motivo = "Por encima de consigna";
  }

  return { t, ultima: t, temp: Math.round(temp * 10) / 10, consigna, compresor, puerta, puertaMin, desescarche, estado, motivo };
}

/** Lecturas desde `horas` atrás hasta `hasta`, una cada `pasoMin` minutos. */
export function serie(c: Camara, hasta: number, aj: Ajustes, horas = 24, pasoMin = 5): Lectura[] {
  const fin = Math.floor(hasta / (pasoMin * MIN)) * pasoMin * MIN;
  const pasos = Math.floor((horas * 60) / pasoMin);
  const out: Lectura[] = [];
  for (let i = pasos; i >= 0; i--) out.push(leer(c, fin - i * pasoMin * MIN, aj));
  return out;
}

/** Lo que identifica un suceso aunque cambien los minutos que lleva. */
const claveDe = (motivo: string) => (motivo.startsWith("Sin datos") ? "Sin datos" : motivo.replace(/\d+ min/, ""));

export type Evento = { camaraId: string; desde: number; hasta: number; estado: Exclude<Estado, "correcto">; motivo: string };

/** Avisos y alarmas de las últimas `horas`, del más reciente al más antiguo. */
export function eventos(hasta: number, aj: Ajustes, horas = 24): Evento[] {
  const fin = Math.floor(hasta / MIN) * MIN;
  const out: Evento[] = [];
  for (const c of CAMARAS) {
    let abierto: Evento | null = null;
    for (let i = horas * 60; i >= 0; i--) {
      const l = leer(c, fin - i * MIN, aj);
      const clave = l.estado === "correcto" ? "" : claveDe(l.motivo);
      if (abierto && (clave === "" || clave !== claveDe(abierto.motivo))) {
        out.push(abierto);
        abierto = null;
      }
      if (l.estado !== "correcto") {
        if (abierto) {
          abierto.hasta = l.t;
          abierto.motivo = l.motivo;
          if (l.estado === "error") abierto.estado = "error";
        } else abierto = { camaraId: c.id, desde: l.t, hasta: l.t, estado: l.estado, motivo: l.motivo };
      }
    }
    if (abierto) out.push(abierto);
  }
  return out.sort((a, b) => b.desde - a.desde);
}

export type Anticipo = { camaraId: string; titulo: string; detalle: string };

/** Reglas sencillas que avisan antes de la avería. */
export function anticipos(hasta: number, aj: Ajustes): Anticipo[] {
  const out: Anticipo[] = [];
  const evs = eventos(hasta, aj, 24);
  for (const c of CAMARAS) {
    if (c.desescarche > 22)
      out.push({
        camaraId: c.id,
        titulo: "El desescarche tarda más de lo normal",
        detalle: `Dura ${c.desescarche} min y lo habitual en esta instalación son 20. Conviene revisar la resistencia y el hielo del evaporador.`,
      });
    const puertas = evs.filter((e) => e.camaraId === c.id && e.motivo.startsWith("Puerta abierta")).length;
    if (puertas >= 3)
      out.push({
        camaraId: c.id,
        titulo: "La puerta se queda abierta a menudo",
        detalle: `${puertas} veces más de 4 minutos en las últimas 24 horas. Revisar el cierre o hablar con el turno.`,
      });
  }
  return out;
}
