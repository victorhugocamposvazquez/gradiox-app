// La huella de una cámara, sacada de sus propias lecturas. Cada ciclo de marcha
// y paro es un experimento pequeño: mientras el compresor está parado se ve
// cuánto frío pierde, y mientras está en marcha, cuánto enfría. No hace falta
// saber si el compresor está en marcha: basta la temperatura, que sube o baja.
// Con unas horas de lecturas ya hay una docena de ciclos.

import type { Ritmo } from "./fisica";

export type Muestra = {
  t: number;
  temp: number;
  /** Falsa si esa lectura no vale para medir: puerta abierta, desescarche, alarma o sin datos. */
  vale: boolean;
};

export type Medida = {
  /** Grados por hora que sube parada y que baja en marcha. */
  subidaCh: number;
  bajadaCh: number;
  /** Tramos limpios usados: el menor entre subidas y bajadas. */
  ciclos: number;
  /** Cuánto se parecen los tramos entre sí, de 0 (idénticos) hacia arriba. Por debajo de 0,15 es una medida firme. */
  dispersion: number;
  /** Primera y última lectura usadas. */
  desde: number;
  hasta: number;
};

const HORA = 3_600_000;
export const CICLOS_MINIMOS = 3;

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Pendiente de la recta que mejor pasa por esas lecturas, en °C por hora. */
export function pendiente(m: { t: number; temp: number }[]): number {
  const n = m.length;
  if (n < 2) return 0;
  const t0 = m[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of m) {
    const x = (p.t - t0) / HORA;
    sx += x;
    sy += p.temp;
    sxx += x * x;
    sxy += x * p.temp;
  }
  const d = n * sxx - sx * sx;
  return d === 0 ? 0 : (n * sxy - sx * sy) / d;
}

/** Parte la serie en ratos seguidos de lecturas que valen. Un hueco de más de `huecoMs` también corta. */
function ratos(m: Muestra[], huecoMs: number): Muestra[][] {
  const out: Muestra[][] = [];
  let actual: Muestra[] = [];
  for (const p of m) {
    const corta = !p.vale || (actual.length > 0 && p.t - actual[actual.length - 1].t > huecoMs);
    if (corta && actual.length) {
      out.push(actual);
      actual = [];
    }
    if (p.vale) actual.push(p);
  }
  if (actual.length) out.push(actual);
  return out;
}

/**
 * Mide lo que sube y lo que baja la temperatura en los ciclos de una serie.
 * Busca los puntos donde la temperatura da la vuelta (ignorando el temblor de
 * la sonda), mide la pendiente de cada tramo entre dos vueltas y se queda con
 * la mediana, que no se deja arrastrar por un tramo raro. Devuelve null si no
 * hay ciclos suficientes.
 */
export function medirCiclos(m: Muestra[], minimoMin = 3): Medida | null {
  const subidas: number[] = [];
  const bajadas: number[] = [];
  let desde = Infinity, hasta = -Infinity;

  for (const rato of ratos(m, 5 * 60_000)) {
    if (rato.length < 6) continue;
    const temps = rato.map((p) => p.temp).sort((a, b) => a - b);
    const recorrido = temps[Math.floor(temps.length * 0.9)] - temps[Math.floor(temps.length * 0.1)];
    // Una vuelta cuenta cuando la temperatura se aleja del extremo un tercio largo de lo que se mueve.
    const umbral = Math.max(0.3, 0.4 * recorrido);

    const vueltas: number[] = [];
    let extremo = 0;
    let sentido = 0; // 1 sube, -1 baja, 0 aún no se sabe
    for (let i = 1; i < rato.length; i++) {
      const dif = rato[i].temp - rato[extremo].temp;
      if (sentido === 0) {
        if (Math.abs(dif) >= umbral) {
          sentido = dif > 0 ? 1 : -1;
          extremo = i;
        }
      } else if (dif * sentido > 0) extremo = i;
      else if (-dif * sentido >= umbral) {
        vueltas.push(extremo);
        sentido = -sentido;
        extremo = i;
      }
    }

    // Solo los tramos entre dos vueltas son completos: el primero y el último pueden estar cortados.
    for (let k = 1; k < vueltas.length; k++) {
      const tramo = rato.slice(vueltas[k - 1], vueltas[k] + 1);
      const minutos = (tramo[tramo.length - 1].t - tramo[0].t) / 60_000;
      if (minutos < minimoMin || tramo.length < 4) continue;
      const recorte = Math.floor(tramo.length * 0.15);
      const centro = tramo.slice(recorte, tramo.length - recorte);
      const p = pendiente(centro.length >= 3 ? centro : tramo);
      if (p > 0) subidas.push(p);
      else if (p < 0) bajadas.push(-p);
      desde = Math.min(desde, tramo[0].t);
      hasta = Math.max(hasta, tramo[tramo.length - 1].t);
    }
  }

  const ciclos = Math.min(subidas.length, bajadas.length);
  if (ciclos < CICLOS_MINIMOS) return null;
  const a = mediana(subidas), b = mediana(bajadas);
  const desvio = (xs: number[], centro: number) => mediana(xs.map((x) => Math.abs(x - centro))) / centro;
  return { subidaCh: a, bajadaCh: b, ciclos, dispersion: Math.max(desvio(subidas, a), desvio(bajadas, b)), desde, hasta };
}

export const ritmoDe = (m: Pick<Medida, "subidaCh" | "bajadaCh">, consigna: number, exteriorC: number): Ritmo => ({ subidaCh: m.subidaCh, bajadaCh: m.bajadaCh, consigna, exteriorC });

/** Cuánto ha cambiado una huella respecto a la de referencia, en tanto por uno. Sirve para avisar de que una cámara ya no se porta como cuando se midió. */
export function deriva(referencia: Pick<Medida, "subidaCh" | "bajadaCh">, ahora: Pick<Medida, "subidaCh" | "bajadaCh">): { perdida: number; tiron: number } {
  const tr = referencia.subidaCh + referencia.bajadaCh, ta = ahora.subidaCh + ahora.bajadaCh;
  return { perdida: referencia.subidaCh > 0 ? ahora.subidaCh / referencia.subidaCh - 1 : 0, tiron: tr > 0 ? ta / tr - 1 : 0 };
}
