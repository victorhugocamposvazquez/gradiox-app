// Perfiles compartidos: el punto de partida de una cámara nueva es lo que ya se
// sabe de las que se le parecen. Un perfil rellena lo que el técnico no sabe el
// primer día (espesor de panel, cuánto género suele haber, cuánto se abre la
// puerta) y, además, lleva una corrección aprendida: cuánto se apartan de la
// teoría las cámaras de ese tipo que ya se han medido.
//
// De una instalación a otra no viaja ningún dato del cliente: solo dos números
// por cámara, «pierde un tanto más o menos que la teoría» y «enfría un tanto
// más o menos que la teoría».

import type { ClaseProducto, FichaFisica, Ritmo } from "./fisica";

export type Perfil = {
  id: string;
  nombre: string;
  /** Para qué cámaras vale, dicho en claro. */
  para: string;
  clase: "camara" | "tunel" | "muelle" | "mueble";
  tipo: "congelado" | "fresco";
  panelMm: number;
  producto: ClaseProducto;
  /** Kilos de género por m³ de cámara, con una ocupación normal. */
  kgPorM3: number;
  aperturasHora: number;
  /** Parte del género que se renueva cada día y a qué temperatura entra. */
  renuevaDia: number;
  entradaC: number;
  exteriorC: number;
  acople?: number;
  /** Calor fijo por m³ que no sale del resto, en W: muebles abiertos, gente y carretillas. */
  fijoWM3?: number;
};

export const PERFILES: Perfil[] = [
  { id: "camara-congelado", nombre: "Cámara de congelado", para: "Cámaras de conservación entre −18 y −28 °C", clase: "camara", tipo: "congelado", panelMm: 100, producto: "congelado", kgPorM3: 35, aperturasHora: 3, renuevaDia: 0.04, entradaC: -15, exteriorC: 20 },
  { id: "camara-fresco", nombre: "Cámara de fresco", para: "Cámaras de conservación entre 0 y 8 °C", clase: "camara", tipo: "fresco", panelMm: 80, producto: "mixto", kgPorM3: 30, aperturasHora: 8, renuevaDia: 0.3, entradaC: 12, exteriorC: 20 },
  { id: "tunel", nombre: "Túnel de congelación", para: "Túneles que congelan género que entra fresco", clase: "tunel", tipo: "congelado", panelMm: 150, producto: "carne", kgPorM3: 35, aperturasHora: 2, renuevaDia: 0.35, entradaC: 4, exteriorC: 20, acople: 0.5 },
  { id: "muelle", nombre: "Muelle refrigerado", para: "Muelles y antecámaras con mucho paso", clase: "muelle", tipo: "fresco", panelMm: 60, producto: "mixto", kgPorM3: 3, aperturasHora: 30, renuevaDia: 0, entradaC: 10, exteriorC: 20, fijoWM3: 1.7 },
  { id: "mueble", nombre: "Mueble de venta", para: "Murales y vitrinas abiertas de tienda", clase: "mueble", tipo: "fresco", panelMm: 40, producto: "lacteos", kgPorM3: 100, aperturasHora: 0, renuevaDia: 0.25, entradaC: 6, exteriorC: 21, acople: 0.3, fijoWM3: 400 },
];

export const perfilPara = (clase: Perfil["clase"], tipo: Perfil["tipo"]): Perfil =>
  PERFILES.find((p) => p.clase === clase && (clase !== "camara" || p.tipo === tipo)) ?? PERFILES[0];

/** La ficha de partida de una cámara nueva: del técnico solo hacen falta el volumen y la potencia. */
export function fichaDePerfil(p: Perfil, volumenM3: number, potenciaKw: number, frioCentralKw?: number): FichaFisica {
  const productoKg = Math.round(volumenM3 * p.kgPorM3);
  return {
    volumenM3,
    panelMm: p.panelMm,
    producto: p.producto,
    productoKg,
    potenciaKw,
    ...(frioCentralKw ? { frioCentralKw } : {}),
    exteriorC: p.exteriorC,
    aperturasHora: p.aperturasHora,
    entradaKgDia: Math.round(productoKg * p.renuevaDia),
    entradaC: p.entradaC,
    ...(p.fijoWM3 ? { cargaFijaKw: Math.round(((p.fijoWM3 * volumenM3) / 1000) * 10) / 10 } : {}),
    ...(p.acople ? { acople: p.acople } : {}),
  };
}

/** Lo que una cámara medida aporta a su perfil: cuánto se aparta de la teoría, en veces. 1 es clavado. */
export type Aporte = { perdida: number; tiron: number };
export type Ajuste = Aporte & { aportes: number; usados: number };

/**
 * Un aporte fuera de aquí no es «cómo son estas cámaras»: es una cámara con un
 * problema, y no se le pega a las demás. Los bordes son los mismos que hacen
 * saltar un aviso: lo que da aviso no se comparte.
 */
export const APORTE_VALIDO: [number, number] = [0.8, 1.25];
/** Cuántas cámaras medidas pesan lo mismo que la teoría. Con pocas, manda la teoría; con muchas, lo medido. */
export const PESO_TEORIA = 3;

export const aporteDe = (teoria: Ritmo, medido: Ritmo): Aporte => ({
  perdida: medido.subidaCh / teoria.subidaCh,
  tiron: (medido.subidaCh + medido.bajadaCh) / (teoria.subidaCh + teoria.bajadaCh),
});

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** La corrección de un perfil a partir de las cámaras parecidas ya medidas: la mediana, acercada a la teoría cuando hay pocas. */
export function ajusteDe(aportes: Aporte[]): Ajuste {
  const vale = (x: number) => x >= APORTE_VALIDO[0] && x <= APORTE_VALIDO[1];
  const buenos = aportes.filter((a) => vale(a.perdida) && vale(a.tiron));
  if (!buenos.length) return { perdida: 1, tiron: 1, aportes: aportes.length, usados: 0 };
  const peso = buenos.length / (buenos.length + PESO_TEORIA);
  const hacia = (xs: number[]) => 1 + (mediana(xs) - 1) * peso;
  return { perdida: hacia(buenos.map((a) => a.perdida)), tiron: hacia(buenos.map((a) => a.tiron)), aportes: aportes.length, usados: buenos.length };
}

/** Lo que se espera de una cámara nueva una vez corregida la teoría con lo aprendido de las parecidas. */
export function conAjuste(teoria: Ritmo, a: Aporte): Ritmo {
  const subidaCh = teoria.subidaCh * a.perdida;
  const tiron = (teoria.subidaCh + teoria.bajadaCh) * a.tiron;
  return { ...teoria, subidaCh, bajadaCh: Math.max(0, tiron - subidaCh) };
}
