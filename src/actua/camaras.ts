// De la lista de variables de una instalación saca las cámaras sobre las que
// se puede actuar: las que tienen temperatura y una consigna por cada tramo de
// la tarifa. Con lo último leído y cuatro datos de la ficha monta lo que
// necesita la cuenta de `optimiza.ts`.

import { PERFILES, fichaDePerfil, type Perfil } from "../huella/perfiles";
import type { LecturaOpc, VariableOpc } from "../pasarelas/modelo";
import type { Camara, Consignas, Periodo } from "./optimiza";

/** Las variables del autómata que hacen falta de una cámara. */
export type VariablesCamara = {
  consigna: Record<Periodo, string>;
  temperatura: string;
  /** «Está enfriando», para medir después las horas de marcha. */
  enfriando?: string;
  arranca?: string;
  para?: string;
  muyAlta?: string;
  muyBaja?: string;
};

export type CamaraDetectada = { clave: string; nombre: string; vars: VariablesCamara };

const FINALES: [keyof Omit<VariablesCamara, "consigna"> | Periodo, RegExp][] = [
  ["punta", /\.hora_punta_ac$/i],
  ["llana", /\.hora_llana_ac$/i],
  ["valle", /\.hora_valle_ac$/i],
  ["temperatura", /\.tt9$/i],
  ["enfriando", /\.refrigeracion$/i],
  ["arranca", /\.p_consigna_ac$/i],
  ["para", /\.p_consigna_de$/i],
  ["muyAlta", /\.t_muy_alta_ac$/i],
  ["muyBaja", /\.t_muy_baja_ac$/i],
];

/** «Datos_C6_1_REAL.TT9» y «Datos_C6_1_BOOL.Refrigeracion» son de la misma cámara: «Datos_C6_1». */
const claveDe = (n: string) => n.slice(0, n.lastIndexOf(".")).replace(/_(REAL|BOOL|INT|WORD)$/i, "");

export function detectarCamaras(variables: VariableOpc[]): CamaraDetectada[] {
  const porClave = new Map<string, { nombre: string; v: Record<string, string> }>();
  for (const x of variables) {
    if (!x.n.includes(".")) continue;
    const que = FINALES.find(([, re]) => re.test(x.n))?.[0];
    if (!que) continue;
    const clave = claveDe(x.n);
    const c = porClave.get(clave) ?? { nombre: x.g || clave, v: {} };
    c.v[que] = x.n;
    porClave.set(clave, c);
  }
  const out: CamaraDetectada[] = [];
  for (const [clave, c] of porClave) {
    const v = c.v;
    if (!v.punta || !v.llana || !v.valle || !v.temperatura) continue;
    out.push({ clave, nombre: c.nombre, vars: { consigna: { punta: v.punta, llana: v.llana, valle: v.valle }, temperatura: v.temperatura, enfriando: v.enfriando, arranca: v.arranca, para: v.para, muyAlta: v.muyAlta, muyBaja: v.muyBaja } });
  }
  return out;
}

/** Lo que el técnico anota de cada cámara. Con el volumen y el frío ya se puede hacer la cuenta. */
export type FichaCamara = {
  volumenM3: number;
  /** Frío que le llega de la central, en kW. */
  frioKw: number;
  /** Potencia eléctrica del compresor, si tiene uno propio. Entonces `frioKw` no cuenta. */
  potenciaKw?: number;
  /** Lo más caliente que puede estar el género, si se quiere más estricto que el de partida. */
  limite?: number;
};

export const fichaValida = (f: unknown): f is FichaCamara => {
  const x = f as FichaCamara;
  const num = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  return !!x && num(x.volumenM3, 5, 500_000) && (num(x.frioKw, 0.2, 5000) || num(x.potenciaKw, 0.2, 2000)) && (x.limite === undefined || num(x.limite, -40, 20)) && (x.potenciaKw === undefined || num(x.potenciaKw, 0, 2000));
};

/** Una cámara que trabaja por debajo de −5 °C es de congelado. */
export const esCongelado = (consigna: number) => consigna < -5;
export const perfilDe = (consigna: number): Perfil => PERFILES.find((p) => p.id === (esCongelado(consigna) ? "camara-congelado" : "camara-fresco")) ?? PERFILES[0];

/** Margen que se deja siempre con las alarmas del autómata y con el límite del género. */
export const MARGEN_ALARMA = 1;
export const LIMITE_CONGELADO = -18;

export type Montada = { camara: Camara; avisos: string[] } | { falta: string };

const numero = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/**
 * Monta la cámara para la cuenta con lo último leído. Los límites salen de lo
 * más estricto entre el género, las alarmas que ya tiene el autómata y lo que
 * haya anotado el técnico.
 */
export function montar(d: CamaraDetectada, ficha: FichaCamara | undefined, ultimas: Map<string, LecturaOpc["x"]>): Montada {
  if (!ficha) return { falta: "Falta la ficha: volumen y frío que le llega." };
  const lee = (n?: string) => (n ? numero(ultimas.get(n)) : null);
  const punta = lee(d.vars.consigna.punta);
  const llana = lee(d.vars.consigna.llana);
  const valle = lee(d.vars.consigna.valle);
  if (punta === null || llana === null || valle === null) return { falta: "Todavía no se han leído sus tres consignas." };
  const consignas: Consignas = { punta, llana, valle };
  const avisos: string[] = [];
  const arranca = lee(d.vars.arranca);
  const para = lee(d.vars.para);
  const diferencial = arranca !== null && para !== null && arranca - para >= 0.3 && arranca - para <= 6 ? arranca - para : 1.5;
  const masCaliente = Math.max(punta, llana, valle);
  const masFria = Math.min(punta, llana, valle);
  const congelado = esCongelado(llana);

  const techos = [masCaliente + 3];
  if (congelado) techos.push(LIMITE_CONGELADO);
  if (ficha.limite !== undefined) techos.push(ficha.limite);
  const alta = lee(d.vars.muyAlta);
  if (alta !== null && alta > masCaliente) techos.push(alta - MARGEN_ALARMA);
  const suelos = [masFria - diferencial - 4];
  if (!congelado) suelos.push(0.5);
  const baja = lee(d.vars.muyBaja);
  if (baja !== null && baja < masFria - diferencial) suelos.push(baja + MARGEN_ALARMA);
  const techo = Math.min(...techos);
  const suelo = Math.max(...suelos);
  if (techo < masCaliente) avisos.push(`Alguna consigna de ahora (${masCaliente} °C) ya está por encima de lo que aquí se da por seguro (${techo} °C).`);

  const perfil = perfilDe(llana);
  const propia = (ficha.potenciaKw ?? 0) > 0;
  const base = fichaDePerfil(perfil, ficha.volumenM3, propia ? ficha.potenciaKw! : 0, propia ? undefined : ficha.frioKw);
  return { camara: { ficha: base, consignas, diferencial, techo, suelo }, avisos };
}
