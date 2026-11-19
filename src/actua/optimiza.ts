// Actuación para ahorrar: las mejores consignas de una cámara para cada tramo
// de la tarifa eléctrica (punta, llana y valle).
//
// La idea es la de siempre en frío industrial: el género guarda frío. Si se
// enfría un poco de más cuando la luz es barata y se afloja cuando es cara, el
// equipo trabaja las mismas horas o casi, pero en las horas que cuestan menos.
// Enfriar de más no sale gratis (la cámara pierde más y el equipo rinde peor),
// así que no se supone nada: se simula un día entero con cada combinación de
// consignas y se queda la más barata de las que no se salen de los límites.
//
// No hay IA: es una cuenta de calor con dos cuerpos (el aire, que cambia en
// minutos, y el género, que tarda horas) y un termostato como el del autómata.

import { PRODUCTOS, cop, esperado, type FichaFisica } from "../huella/fisica";

export type Periodo = "punta" | "llana" | "valle";
export const PERIODOS: Periodo[] = ["punta", "llana", "valle"];
export const NOMBRE_PERIODO: Record<Periodo, string> = { punta: "Punta", llana: "Llana", valle: "Valle" };

/** Qué tramo toca a cada hora de un día laborable y lo que cuesta el kWh en cada uno. */
export type Tarifa = {
  /** 24 tramos, uno por hora, de un día laborable. Sábados, domingos y festivos son valle entero. */
  horas: Periodo[];
  /** €/kWh con todo incluido, de la factura. */
  precio: Record<Periodo, number>;
  /** true mientras nadie haya puesto los de la factura del cliente. */
  dePartida?: boolean;
};

const tramo = (h: number): Periodo => (h < 8 ? "valle" : (h >= 10 && h < 14) || (h >= 18 && h < 22) ? "punta" : "llana");

/**
 * Tarifa de partida: los tramos de la península en invierno, días laborables,
 * y precios redondos. Sirve para enseñar la cuenta; para prometer euros hay
 * que poner los de la factura del cliente.
 */
export const TARIFA_PARTIDA: Tarifa = {
  horas: Array.from({ length: 24 }, (_, h) => tramo(h)),
  precio: { punta: 0.19, llana: 0.13, valle: 0.09 },
  dePartida: true,
};

export const DIAS_LABORABLES_ANO = 250;

export type Consignas = Record<Periodo, number>;

/** Lo que hay que saber de una cámara para decidir. */
export type Camara = {
  ficha: FichaFisica;
  /** Consignas de ahora: la temperatura a la que arranca el frío en cada tramo. */
  consignas: Consignas;
  /** Grados que baja antes de parar. */
  diferencial: number;
  /** Lo más caliente y lo más frío que puede llegar a estar el aire. Ya con el margen quitado. */
  techo: number;
  suelo: number;
  /** Cuánto se deja mover cada consigna en una sola actuación. */
  pasoMax?: number;
  /** Grados que se deja subir la temperatura media del género respecto a la de ahora. Por defecto, casi nada: se ahorra moviendo el frío de hora, no quitándolo. */
  holguraGenero?: number;
  /** Parte de un tramo que como mucho puede estar en marcha. Deja sitio para un día de calor y para que la central no vaya a tope. */
  marchaMax?: number;
};

export type DiaSimulado = {
  kwh: Record<Periodo, number>;
  kwhDia: number;
  eurosDia: number;
  /** Parte del tramo que el frío está en marcha, de 0 a 1. */
  marcha: Record<Periodo, number>;
  aireMax: number;
  aireMin: number;
  generoMax: number;
  generoMin: number;
  generoMedia: number;
  /** Temperatura del aire al final de cada hora, y si el frío estuvo en marcha más de media hora. */
  curva: { aire: number; genero: number; marcha: number }[];
};

/** Horas que tarda el género en seguir al aire. Valor de partida para género paletizado. */
export const HORAS_GENERO = 6;
const AIRE_KJ_M3K = 1.3;
const PIEL_KJ_M2K = 2;

/**
 * Simula días laborables seguidos con esas consignas y devuelve el último,
 * cuando la cámara ya repite el mismo día. El termostato es el del autómata:
 * arranca al llegar a la consigna del tramo y para al bajar el diferencial.
 */
export function simularDia(c: Camara, consignas: Consignas, tarifa: Tarifa, dias = 3): DiaSimulado {
  const f = c.ficha;
  const base = esperado(f, consignas.llana);
  const g = PRODUCTOS[f.producto];
  const calor = consignas.llana < g.congelaC ? g.calorBajo : g.calorSobre;
  const ca = (f.volumenM3 * AIRE_KJ_M3K + base.superficieM2 * PIEL_KJ_M2K) / 3600; // kWh/°C
  const cp = Math.max(0.001, (f.productoKg * calor) / 3600);
  const une = cp / HORAS_GENERO; // kW/°C entre el aire y el género
  const ua = base.perdidaWK / 1000;
  const fijo = base.cargas.genero + base.cargas.interna;
  const propia = f.potenciaKw > 0;

  // Paso corto para que el aire, que tiene poca inercia, no dé saltos.
  const dt = Math.min(1 / 60, (0.25 * ca) / (une + ua + 1e-9));
  const pasosHora = Math.ceil(1 / dt);
  const h = 1 / pasosHora;

  const media = (consignas.punta + consignas.llana + consignas.valle) / 3 - c.diferencial / 2;
  let aire = media;
  let genero = media;
  let enMarcha = false;
  const vacio = () => ({ punta: 0, llana: 0, valle: 0 });
  let kwh = vacio();
  let horasMarcha = vacio();
  const horasTramo = vacio();
  let curva: DiaSimulado["curva"] = [];
  let aireMax = -Infinity, aireMin = Infinity, generoMax = -Infinity, generoMin = Infinity, sumaGenero = 0;

  for (let d = 0; d < dias; d++) {
    const ultimo = d === dias - 1;
    for (let hora = 0; hora < 24; hora++) {
      const p = tarifa.horas[hora];
      const sp = consignas[p];
      let marchaHora = 0;
      for (let i = 0; i < pasosHora; i++) {
        if (aire >= sp) enMarcha = true;
        else if (aire <= sp - c.diferencial) enMarcha = false;
        const rinde = cop(aire, f.exteriorC, f.rendimiento);
        const frio = enMarcha ? (propia ? f.potenciaKw * rinde : f.frioCentralKw ?? 0) : 0;
        const entra = ua * (f.exteriorC - aire) + fijo;
        const alGenero = une * (aire - genero);
        aire += ((entra - frio - alGenero) / ca) * h;
        genero += (alGenero / cp) * h;
        if (enMarcha) marchaHora += h;
        if (ultimo) {
          if (enMarcha) kwh[p] += (propia ? f.potenciaKw : frio / rinde) * h;
          if (aire > aireMax) aireMax = aire;
          if (aire < aireMin) aireMin = aire;
          if (genero > generoMax) generoMax = genero;
          if (genero < generoMin) generoMin = genero;
          sumaGenero += genero * h;
        }
      }
      if (ultimo) {
        horasMarcha[p] += marchaHora;
        horasTramo[p] += 1;
        curva.push({ aire, genero, marcha: marchaHora });
      }
    }
    if (!ultimo) {
      kwh = vacio();
      horasMarcha = vacio();
      curva = [];
    }
  }
  const kwhDia = kwh.punta + kwh.llana + kwh.valle;
  const eurosDia = PERIODOS.reduce((s, p) => s + kwh[p] * tarifa.precio[p], 0);
  const marcha = { punta: horasMarcha.punta / Math.max(1, horasTramo.punta), llana: horasMarcha.llana / Math.max(1, horasTramo.llana), valle: horasMarcha.valle / Math.max(1, horasTramo.valle) };
  return { kwh, kwhDia, eurosDia, marcha, aireMax, aireMin, generoMax, generoMin, generoMedia: sumaGenero / 24, curva };
}

export const PASO_MAX = 3;
export const HOLGURA_GENERO = 0.2;
export const MARCHA_MAX = 0.85;
/** Por debajo de esto no merece la pena tocar nada. */
export const AHORRO_MINIMO = 0.02;

export type Motivo = "ya-esta" | "sin-margen" | "equipo-justo" | "sin-datos";
export type Propuesta = {
  ahora: DiaSimulado;
  /** null si no hay nada que mejorar. */
  mejor: { consignas: Consignas; dia: DiaSimulado } | null;
  motivo?: Motivo;
  eurosDia: number;
  eurosAno: number;
  kwhDia: number;
  /** Ahorro sobre lo que gasta hoy, de 0 a 1. */
  parte: number;
  probadas: number;
};

const medio = (x: number) => Math.round(x * 2) / 2;

const marchaTope = (d: DiaSimulado) => Math.max(d.marcha.punta, d.marcha.llana, d.marcha.valle);

/**
 * ¿Ese día se queda dentro de los límites? Ni el aire ni el género pasan del
 * techo, el aire no baja del suelo, el género no queda de media más caliente
 * que ahora y el equipo no pasa del tope de marcha en ningún tramo.
 */
export function dentro(c: Camara, d: DiaSimulado, ahora: DiaSimulado): boolean {
  const tope = Math.max(c.marchaMax ?? MARCHA_MAX, marchaTope(ahora));
  return (
    d.aireMax <= c.techo + 1e-6 &&
    d.generoMax <= c.techo + 1e-6 &&
    d.aireMin >= c.suelo - 1e-6 &&
    d.generoMedia <= ahora.generoMedia + (c.holguraGenero ?? HOLGURA_GENERO) &&
    marchaTope(d) <= tope + 1e-6
  );
}

/**
 * Prueba todas las combinaciones de consignas de medio en medio grado, sin
 * mover ninguna más de `pasoMax`, y se queda la que menos cuesta sin salirse
 * de los límites. En valle nunca más caliente que en llana, ni en llana más
 * que en punta: lo contrario no ahorra.
 */
/** Lo que se deja entre la consigna más caliente y el límite, para que una puerta abierta no lo toque. */
export const HOLGURA_TECHO = 0.5;

export function proponer(c: Camara, tarifa: Tarifa): Propuesta {
  const ahora = simularDia(c, c.consignas, tarifa);
  const nada = (motivo: Motivo, probadas = 0): Propuesta => ({ ahora, mejor: null, motivo, eurosDia: 0, eurosAno: 0, kwhDia: 0, parte: 0, probadas });
  if (!(ahora.kwhDia > 0)) return nada("sin-datos");
  const paso = c.pasoMax ?? PASO_MAX;
  const rango = (p: Periodo) => {
    const desde = Math.max(medio(c.consignas[p] - paso), Math.ceil((c.suelo + c.diferencial) * 2) / 2);
    const hasta = Math.min(medio(c.consignas[p] + paso), Math.floor((c.techo - HOLGURA_TECHO) * 2) / 2);
    const out: number[] = [];
    for (let x = desde; x <= hasta + 1e-9; x += 0.5) out.push(x);
    return out;
  };
  const [vs, ls, ps] = [rango("valle"), rango("llana"), rango("punta")];
  const ahora2 = simularDia(c, c.consignas, tarifa, 2);
  let mejor: Propuesta["mejor"] = null;
  let probadas = 0;
  let algunaDentro = false;
  for (const valle of vs)
    for (const llana of ls) {
      if (llana < valle) continue;
      for (const punta of ps) {
        if (punta < llana) continue;
        probadas++;
        const consignas = { punta, llana, valle };
        const dia = simularDia(c, consignas, tarifa, 2);
        if (!dentro(c, dia, ahora2)) continue;
        algunaDentro = true;
        if (!mejor || dia.eurosDia < mejor.dia.eurosDia - 1e-9) mejor = { consignas, dia };
      }
    }
  if (!mejor) return nada(algunaDentro ? "ya-esta" : marchaTope(ahora) > (c.marchaMax ?? MARCHA_MAX) ? "equipo-justo" : "sin-margen", probadas);
  // El elegido se vuelve a simular con los mismos días que el de ahora, para comparar igual con igual.
  const dia = simularDia(c, mejor.consignas, tarifa);
  const eurosDia = ahora.eurosDia - dia.eurosDia;
  const parte = eurosDia / ahora.eurosDia;
  const igual = PERIODOS.every((p) => mejor!.consignas[p] === c.consignas[p]);
  if (igual || parte < AHORRO_MINIMO || !dentro(c, dia, ahora)) return nada("ya-esta", probadas);
  return { ahora, mejor: { consignas: mejor.consignas, dia }, eurosDia, eurosAno: eurosDia * DIAS_LABORABLES_ANO, kwhDia: ahora.kwhDia - dia.kwhDia, parte, probadas };
}

export const TEXTO_MOTIVO: Record<Motivo, string> = {
  "ya-esta": "Con estas consignas ya está cerca de lo mejor: cambiar algo ahorraría menos de un 2 %.",
  "sin-margen": "No hay margen para mover las consignas sin acercarse a los límites de temperatura.",
  "equipo-justo": "El equipo va casi siempre en marcha: no le sobra capacidad para adelantar frío.",
  "sin-datos": "Faltan datos de la cámara (potencia o frío que le llega) para hacer la cuenta.",
};
