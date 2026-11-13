// Precio de la luz SIMULADO. No viene de Red Eléctrica: es una curva inventada con
// forma parecida a un día normal (caro por la mañana y al anochecer, barato de
// madrugada y a mediodía) para poder enseñar el plan. Sustituir por ESIOS.

const FORMA = [62, 56, 52, 50, 51, 58, 78, 104, 118, 110, 84, 60, 44, 36, 34, 40, 58, 88, 122, 138, 132, 112, 90, 72];

function azarDia(a: number, b: number): number {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return ((x >>> 0) % 100_000) / 100_000;
}

/** 24 precios en €/MWh, uno por hora del día de `fecha`. */
export function preciosDelDia(fecha: Date): number[] {
  const semilla = fecha.getFullYear() * 372 + fecha.getMonth() * 31 + fecha.getDate();
  const nivel = 0.8 + 0.4 * azarDia(semilla, 1);
  return FORMA.map((v, h) => Math.max(5, Math.round(v * nivel + (azarDia(semilla, h + 2) - 0.5) * 14)));
}

export type Plan = { baratas: number[]; caras: number[] };

/** Las 6 horas más baratas (enfriar de más) y las 4 más caras (aflojar). */
export function planDelDia(precios: number[]): Plan {
  const orden = precios.map((p, h) => ({ p, h })).sort((a, b) => a.p - b.p || a.h - b.h);
  return {
    baratas: orden.slice(0, 6).map((x) => x.h).sort((a, b) => a - b),
    caras: orden.slice(-4).map((x) => x.h).sort((a, b) => a - b),
  };
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/**
 * Ahorro estimado del día en euros al mover consumo de las horas caras a las
 * baratas. Supone que el compresor trabaja el 55 % del tiempo y que el plan
 * desplaza un tercio de ese consumo en las horas caras. Es una cuenta de la
 * simulación, no una medida.
 */
export function ahorroEstimado(precios: number[], plan: Plan, potenciasKw: number[]): { kwh: number; euros: number } {
  const kwh = potenciasKw.reduce((a, b) => a + b, 0) * 0.55 * (1 / 3) * plan.caras.length;
  const diferencia = media(plan.caras.map((h) => precios[h])) - media(plan.baratas.map((h) => precios[h]));
  return { kwh: Math.round(kwh), euros: Math.round(((kwh * diferencia) / 1000) * 100) / 100 };
}
