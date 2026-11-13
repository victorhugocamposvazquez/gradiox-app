// Fallos típicos: la lista de cosas que suelen pasar en una instalación, escrita
// por quien la conoce. Cada fallo dice por qué señal se reconoce, qué hay que
// revisar a mano y qué orden se le daría al autómata. Las órdenes son simuladas:
// aquí no hay ningún autómata que las reciba.

import { CAMARAS, leer, type Ajustes, type Camara, type Lectura } from "./sim";

export type Senal = "puerta" | "sobreconsigna" | "limite" | "compresor" | "desescarche";
export type Orden = "ninguna" | "avisador" | "reforzar" | "desescarche" | "rearme";

export const SENALES: Record<Senal, { texto: string; unidad: string | null; porDefecto: number }> = {
  puerta: { texto: "Puerta abierta más de", unidad: "min", porDefecto: 4 },
  sobreconsigna: { texto: "Temperatura por encima de la consigna más de", unidad: "°C", porDefecto: 3 },
  desescarche: { texto: "Desescarche que dura más de", unidad: "min", porDefecto: 22 },
  compresor: { texto: "Compresor parado cuando debería enfriar", unidad: null, porDefecto: 0 },
  limite: { texto: "Temperatura por encima del límite del género", unidad: null, porDefecto: 0 },
};

export const ORDENES: Record<Orden, string> = {
  ninguna: "Nada, solo avisar",
  avisador: "Hacer sonar el avisador de la puerta",
  reforzar: "Bajar la consigna 2 °C hasta que pase",
  desescarche: "Lanzar un desescarche extra",
  rearme: "Intentar rearmar el compresor una vez",
};

export type FalloTipico = { id: string; nombre: string; senal: Senal; umbral: number; revisar: string; orden: Orden };

/** Ejemplos de partida. Cada instalador pondría los suyos. */
export const FALLOS_INICIALES: FalloTipico[] = [
  { id: "f-puerta", nombre: "Puerta mal cerrada", senal: "puerta", umbral: 4, revisar: "Mirar el cierre y la goma de la puerta. Si se repite en el mismo turno, hablar con el encargado.", orden: "avisador" },
  { id: "f-hielo", nombre: "Hielo en el evaporador", senal: "desescarche", umbral: 22, revisar: "Revisar la resistencia de desescarche, el desagüe y el hielo acumulado en el evaporador.", orden: "desescarche" },
  { id: "f-compresor", nombre: "Salta el compresor", senal: "compresor", umbral: 0, revisar: "Comprobar protecciones y presiones antes de rearmar. Si vuelve a saltar, no insistir y llamar al técnico.", orden: "rearme" },
  { id: "f-caliente", nombre: "No llega a consigna", senal: "sobreconsigna", umbral: 3, revisar: "Mirar si se ha metido género caliente, si el condensador está sucio y si falta gas.", orden: "reforzar" },
];

export const describir = (f: FalloTipico) => {
  const s = SENALES[f.senal];
  return s.unidad ? `${s.texto} ${f.umbral.toString().replace(".", ",")} ${s.unidad}` : s.texto;
};

/** ¿Esta lectura de esta cámara corresponde al fallo? */
export function coincide(f: FalloTipico, c: Camara, l: Lectura): boolean {
  switch (f.senal) {
    case "puerta":
      return l.puerta && l.puertaMin >= f.umbral;
    case "sobreconsigna":
      return !l.desescarche && l.motivo !== "Compresor parado" && l.temp > l.consigna + f.umbral;
    case "limite":
      return l.temp >= c.limite;
    case "compresor":
      return l.motivo === "Compresor parado";
    case "desescarche":
      return l.desescarche && c.desescarche > f.umbral;
  }
}

export type Repeticion = { fallo: FalloTipico; camaraId: string; veces: number; ultima: number; activo: boolean; porDia: number[] };

const MIN = 60_000;

/**
 * Cuántas veces ha pasado cada fallo típico en cada cámara en los últimos
 * `dias`, del que más se repite al que menos. `porDia` va del día más antiguo a hoy.
 */
export function historico(fallos: FalloTipico[], hasta: number, aj: Ajustes, dias = 7): Repeticion[] {
  const fin = Math.floor(hasta / MIN) * MIN;
  const total = dias * 24 * 60;
  const out: Repeticion[] = [];
  for (const c of CAMARAS) {
    const cuenta = fallos.map((fallo) => ({ fallo, camaraId: c.id, veces: 0, ultima: 0, activo: false, porDia: Array<number>(dias).fill(0) }));
    for (let i = total; i >= 0; i--) {
      const t = fin - i * MIN;
      const l = leer(c, t, aj);
      fallos.forEach((f, k) => {
        const ahora = coincide(f, c, l);
        const r = cuenta[k];
        if (ahora && !r.activo) {
          r.veces++;
          r.ultima = t;
          r.porDia[Math.min(dias - 1, Math.floor((total - i) / (24 * 60)))]++;
        }
        r.activo = ahora;
      });
    }
    out.push(...cuenta.filter((r) => r.veces > 0));
  }
  return out.sort((a, b) => Number(b.activo) - Number(a.activo) || b.veces - a.veces);
}

/** Fallos típicos que se están dando ahora mismo en una cámara. */
export const fallosAhora = (fallos: FalloTipico[], c: Camara, l: Lectura) => fallos.filter((f) => coincide(f, c, l));
