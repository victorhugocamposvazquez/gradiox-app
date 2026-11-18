// La huella sobre la nave de demostración: la ficha física de cada servicio,
// las lecturas que valen para medir y la cuenta de cuánto acierta lo previsto el
// primer día. Todo sale de la simulación; nada de esto es una instalación real.

import { AJUSTES_INICIALES, CAMARAS, leer, type Ajustes, type Camara } from "../lib/sim";
import { medirCiclos, ritmoDe, type Medida, type Muestra } from "./ciclos";
import { comparar, marchaDe, ritmoEsperado, type Comparacion, type FichaFisica, type Ritmo } from "./fisica";
import { ajusteDe, aporteDe, conAjuste, perfilPara, type Ajuste, type Perfil } from "./perfiles";

const MIN = 60_000;
const DIA = 24 * 60 * MIN;

/** Lo que se sabe de cada servicio de la nave de demostración. Valores inventados, de tamaño creíble. */
export const FICHAS: Record<string, FichaFisica> = {
  c1: { volumenM3: 3200, panelMm: 100, producto: "congelado", productoKg: 120_000, potenciaKw: 22, exteriorC: 20, aperturasHora: 3, entradaKgDia: 4000, entradaC: -15 },
  c2: { volumenM3: 3000, panelMm: 120, producto: "congelado", productoKg: 66_000, potenciaKw: 22, exteriorC: 20, aperturasHora: 3, entradaKgDia: 4000, entradaC: -15 },
  c3: { volumenM3: 2000, panelMm: 150, producto: "carne", productoKg: 70_000, potenciaKw: 18, exteriorC: 20, aperturasHora: 3, entradaKgDia: 3000, entradaC: -15 },
  c4: { volumenM3: 1500, panelMm: 80, producto: "fruta", productoKg: 40_000, potenciaKw: 9, exteriorC: 20, aperturasHora: 6, entradaKgDia: 25_000, entradaC: 12 },
  c5: { volumenM3: 900, panelMm: 60, producto: "mixto", productoKg: 40_000, potenciaKw: 6, exteriorC: 20, aperturasHora: 40, entradaKgDia: 0, entradaC: 10, cargaFijaKw: 4 },
  c6: { volumenM3: 400, panelMm: 150, producto: "carne", productoKg: 14_000, potenciaKw: 30, exteriorC: 20, aperturasHora: 2, entradaKgDia: 4500, entradaC: 4, acople: 0.5 },
  c7: { volumenM3: 1800, panelMm: 60, producto: "mixto", productoKg: 5000, potenciaKw: 0, frioCentralKw: 22, exteriorC: 20, aperturasHora: 30, entradaKgDia: 0, entradaC: 10, cargaFijaKw: 3 },
  c8: { volumenM3: 12, panelMm: 40, producto: "lacteos", productoKg: 1200, potenciaKw: 3, exteriorC: 21, aperturasHora: 0, entradaKgDia: 300, entradaC: 6, cargaFijaKw: 4.8, acople: 0.3 },
};

export const fichaDe = (c: Camara, cambios?: Partial<FichaFisica>): FichaFisica => ({ ...FICHAS[c.id], ...cambios });
export const perfilDe = (c: Camara): Perfil => perfilPara(c.clase, c.tipo);

/** Minutos que una lectura sigue sin valer después de cerrarse la puerta y de acabar un desescarche. */
const TRAS_PUERTA = 10;
const TRAS_DESESCARCHE = 35;

/** Lecturas de un servicio minuto a minuto, marcando las que no valen para medir la huella. */
export function muestrasDe(c: Camara, desde: number, hasta: number, aj: Ajustes = AJUSTES_INICIALES): Muestra[] {
  const out: Muestra[] = [];
  let puerta = -Infinity, desescarche = -Infinity;
  const inicio = Math.floor(desde / MIN) * MIN;
  // Se empieza un rato antes para saber si venía de una puerta o de un desescarche.
  for (let t = inicio - TRAS_DESESCARCHE * MIN; t <= hasta; t += MIN) {
    const l = leer(c, t, aj);
    if (l.puerta) puerta = t;
    if (l.desescarche) desescarche = t;
    if (t < inicio) continue;
    const vale = l.estado === "correcto" && !l.puerta && !l.desescarche && t - puerta >= TRAS_PUERTA * MIN && t - desescarche >= TRAS_DESESCARCHE * MIN;
    out.push({ t, temp: l.temp, vale });
  }
  return out;
}

/** La huella de un servicio medida en sus ciclos de las últimas `horas`. */
export const huellaDeCiclos = (c: Camara, hasta: number, horas: number, aj: Ajustes = AJUSTES_INICIALES): Medida | null =>
  medirCiclos(muestrasDe(c, hasta - horas * 60 * MIN, hasta, aj));

/** Horas de lecturas con las que se da la primera huella. */
export const HORAS_PRIMERA_HUELLA = 6;
/** Días que se miran para comprobar cuánto acertó lo previsto el primer día. */
export const DIAS_COMPROBACION = 14;

/** Parte del tiempo en marcha que se ha visto de verdad entre dos instantes: lo que dice el compresor, lectura a lectura. */
export function marchaObservada(c: Camara, desde: number, hasta: number, aj: Ajustes = AJUSTES_INICIALES): number | null {
  if (c.sinCompresor) {
    // Sin compresor propio no hay marcha que leer: se saca de lo que sube y baja la temperatura.
    const m = medirCiclos(muestrasDe(c, hasta - Math.min(hasta - desde, 2 * DIA), hasta, aj));
    return m ? m.subidaCh / (m.subidaCh + m.bajadaCh) : null;
  }
  let total = 0, enMarcha = 0;
  // Cada 97 segundos: un paso que no casa con la duración de ningún ciclo, para no mirar siempre el mismo punto.
  for (let t = Math.floor(desde / MIN) * MIN; t < hasta; t += 97_000) {
    const l = leer(c, t, aj);
    if (l.estado === "sindatos") continue;
    total++;
    if (l.compresor) enMarcha++;
  }
  return total ? enMarcha / total : null;
}

export type Acierto = { marcha: number; error: number };
export type Precision = {
  camaraId: string;
  /** Cuándo se dio de alta, en la demostración: hace `DIAS_COMPROBACION` días. */
  alta: number;
  observada: number;
  /** Lo previsto solo con la ficha y el perfil, antes de la primera lectura. */
  ficha: Acierto;
  /** Lo previsto con los ciclos de las primeras horas. */
  ciclos: (Acierto & { ciclos: number }) | null;
};

const error = (previsto: number, visto: number) => Math.abs(previsto - visto) / visto;

/**
 * Cuánto acertó lo que se previó el primer día. Hace como si el servicio se
 * hubiera dado de alta hace dos semanas: guarda lo que se habría previsto
 * entonces y lo compara con lo que ha hecho desde el día siguiente hasta hoy.
 */
export function precisionDe(c: Camara, ahora: number, aj: Ajustes = AJUSTES_INICIALES, ficha: FichaFisica = FICHAS[c.id]): Precision | null {
  const hoy = new Date(ahora);
  const alta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - DIAS_COMPROBACION).getTime();
  const observada = marchaObservada(c, alta + DIA, ahora, aj);
  if (observada === null || observada <= 0) return null;
  const teoria = Math.min(1, marchaDe(ritmoEsperado(ficha, c.consigna)));
  const primera = medirCiclos(muestrasDe(c, alta, alta + HORAS_PRIMERA_HUELLA * 60 * MIN, aj));
  const deCiclos = primera ? marchaDe(ritmoDe(primera, c.consigna, ficha.exteriorC)) : null;
  return {
    camaraId: c.id,
    alta,
    observada,
    ficha: { marcha: teoria, error: error(teoria, observada) },
    ciclos: primera && deCiclos !== null ? { marcha: deCiclos, error: error(deCiclos, observada), ciclos: primera.ciclos } : null,
  };
}

export type Conocimiento = "ficha" | "ciclos" | "prueba";
export const ROTULO_CONOCIMIENTO: Record<Conocimiento, string> = { ficha: "Solo ficha y perfil", ciclos: "Medida en sus ciclos", prueba: "Medida con la prueba" };

/** Lo que cada perfil ha aprendido de los servicios de la nave que ya tienen huella. `sin` deja fuera a uno: nadie se corrige con su propio dato. */
export function ajusteDelPerfil(perfil: Perfil, medidas: Record<string, Ritmo | null | undefined>, sin?: string, fichas: Record<string, FichaFisica> = FICHAS): Ajuste {
  const aportes: ReturnType<typeof aporteDe>[] = [];
  for (const c of CAMARAS) {
    const medido = medidas[c.id];
    if (c.id === sin || perfilDe(c).id !== perfil.id || !medido) continue;
    aportes.push(aporteDe(ritmoEsperado(fichas[c.id], c.consigna), medido));
  }
  return ajusteDe(aportes);
}

/** Lo que se espera de un servicio: la teoría de su ficha, corregida con lo aprendido de los que se le parecen. */
export const esperadoCon = (c: Camara, ficha: FichaFisica, ajuste: Ajuste): Ritmo => conAjuste(ritmoEsperado(ficha, c.consigna), ajuste);

/** Cómo se porta de verdad un servicio de la demostración, para la cámara simulada de la prueba: sale de la forma de su ciclo. */
export function ritmoReal(c: Camara, exteriorC: number): Ritmo {
  const recorrido = 1.4; // dos veces la histéresis de la simulación
  return { subidaCh: (recorrido / (0.45 * c.ciclo)) * 60, bajadaCh: (recorrido / (0.55 * c.ciclo)) * 60, consigna: c.consigna, exteriorC };
}

/**
 * Lo esperado frente a lo medido en un servicio, con las fichas de partida y los
 * ciclos de las últimas 24 horas de toda la nave. Es lo que ve el cliente en la
 * ficha del servicio. Null si aún no hay ciclos limpios para medir.
 */
export function veredictoDe(c: Camara, hasta: number, aj: Ajustes = AJUSTES_INICIALES): { esperado: Ritmo; medido: Ritmo; ciclos: number; cmp: Comparacion } | null {
  const propia = huellaDeCiclos(c, hasta, 24, aj);
  if (!propia) return null;
  const perfil = perfilDe(c);
  const medidas: Record<string, Ritmo | null> = {};
  for (const otra of CAMARAS) {
    if (otra.id === c.id || perfilDe(otra).id !== perfil.id) continue;
    const m = huellaDeCiclos(otra, hasta, 24, aj);
    medidas[otra.id] = m ? ritmoDe(m, otra.consigna, FICHAS[otra.id].exteriorC) : null;
  }
  const esperadoR = esperadoCon(c, FICHAS[c.id], ajusteDelPerfil(perfil, medidas, c.id));
  const medido = ritmoDe(propia, c.consigna, FICHAS[c.id].exteriorC);
  return { esperado: esperadoR, medido, ciclos: propia.ciclos, cmp: comparar(esperadoR, medido, c.potenciaKw, c.limite) };
}
