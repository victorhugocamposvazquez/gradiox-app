// Rendimiento (COP): qué se mide en cada nivel y en cada equipo, y cómo se dice.
// Es la fuente de la Ayuda «Rendimiento» y de las pantallas que vengan; las fórmulas
// completas y los umbrales están en docs/rendimiento.md. Si cambias algo aquí,
// cambia también ese documento en el mismo PR.

/** De dónde sale un número. Ningún número se enseña sin esta etiqueta. */
export type Calidad = "medido" | "calculado" | "estimado";

export const CALIDAD: Record<Calidad, { titulo: string; cuando: string }> = {
  medido: {
    titulo: "Medido",
    cuando: "Sale de una medida directa con su precisión: un analizador de red, un caudalímetro.",
  },
  calculado: {
    titulo: "Calculado",
    cuando: "Sale de medidas más un modelo documentado: la curva del fabricante, un balance de energía.",
  },
  estimado: {
    titulo: "Estimado",
    cuando: "Depende de supuestos: potencia sacada de la intensidad, un rendimiento supuesto, un reparto. Se enseña siempre como banda.",
  },
};

export type IdNivel = "instalacion" | "compresor" | "servicio";

export interface Nivel {
  id: IdNivel;
  titulo: string;
  formula: string;
  electricidad: string;
  paraQue: string;
  precision: string;
}

/** El COP tiene tres niveles. Manda el de la instalación: con él se decide y se verifica cada ajuste. */
export const NIVELES: Nivel[] = [
  {
    id: "instalacion",
    titulo: "Instalación (el que manda)",
    formula: "Frío entregado a todos los servicios ÷ toda la electricidad del frío",
    electricidad:
      "Compresores, ventiladores y bomba del condensador, bombas de glicol, ventiladores de evaporadores y climatizadoras, desescarches",
    paraQue: "Objetivo del autoajuste, euros del cliente, línea base del ahorro, comparar instalaciones",
    precision: "±3–8 % con analizadores y caudalímetro de glicol",
  },
  {
    id: "compresor",
    titulo: "Compresor",
    formula: "Frío del compresor ÷ su potencia eléctrica",
    electricidad: "Solo su motor",
    paraQue: "Averías y orden de arranque de los compresores",
    precision: "±3–8 % con su curva o su balance; banda más ancha si es estimado",
  },
  {
    id: "servicio",
    titulo: "Servicio",
    formula: "Frío que pide ese servicio ÷ electricidad que le toca",
    electricidad:
      "Su parte de sala de máquinas y condensador (repartida por el frío que pide), más sus ventiladores y desescarches",
    paraQue: "Coste por cámara, puertas, desescarches, informe por servicio",
    precision: "±10–20 %: el reparto es un cálculo",
  },
];

/** Los tres números de cada nivel y lo que significa la diferencia entre ellos. */
export const TRES_NUMEROS = [
  { titulo: "Real", texto: "Lo que da ahora." },
  { titulo: "Esperado", texto: "Lo que daría el equipo sano a las presiones de ahora (curva del fabricante o su propia historia)." },
  { titulo: "Alcanzable", texto: "El esperado con las mejores consignas permitidas." },
] as const;

export type Unidad = "COP" | "W/kW" | "kWh/t";

export interface Indicador {
  equipo: string;
  indicador: string;
  unidad: Unidad;
  /** Lo que hace falta leer o instalar para tenerlo. */
  senales: string;
  paraQue: string;
}

/**
 * Cada equipo tiene su indicador. Lo que produce frío, COP. Lo que no produce frío,
 * vatios por kW de frío: así se suman y dan 1000 / COP de la instalación.
 */
export const INDICADORES: Indicador[] = [
  {
    equipo: "Compresor",
    indicador: "COP y desvío frente a su propia historia",
    unidad: "COP",
    senales: "Presiones y temperaturas de aspiración y descarga, potencia eléctrica (analizador)",
    paraQue: "Ver si gasta más que antes para el mismo trabajo",
  },
  {
    equipo: "Sala de máquinas",
    indicador: "COP de los compresores juntos",
    unidad: "COP",
    senales: "Lo de cada compresor",
    paraQue: "Elegir qué compresores trabajan y cómo",
  },
  {
    equipo: "Condensador",
    indicador: "Ventiladores y bomba por kW de frío; distancia al bulbo húmedo",
    unidad: "W/kW",
    senales: "Potencia de ventiladores y bomba, temperatura y humedad exterior",
    paraQue: "Condensación flotante y suciedad del condensador",
  },
  {
    equipo: "Bombas de glicol",
    indicador: "Potencia por kW de frío transportado; salto térmico",
    unidad: "W/kW",
    senales: "Potencia de las bombas, temperaturas de ida y vuelta",
    paraQue: "Ajustar la velocidad al salto de diseño",
  },
  {
    equipo: "Ventiladores de evaporadores y climatizadoras",
    indicador: "Potencia por kW de frío de su servicio",
    unidad: "W/kW",
    senales: "Potencia o estado de marcha de los ventiladores",
    paraQue: "Ventiladores que van de más",
  },
  {
    equipo: "Desescarches",
    indicador: "Energía al día por kW de frío; número al día",
    unidad: "W/kW",
    senales: "Resistencias o gas caliente, fin de desescarche",
    paraQue: "Desescarchar solo cuando hace falta",
  },
  {
    equipo: "Recuperación de calor",
    indicador: "Calor aprovechado ÷ electricidad de más",
    unidad: "COP",
    senales: "Caudal y temperaturas del circuito de recuperación",
    paraQue: "Saber si recuperar calor compensa subir la condensación",
  },
  {
    equipo: "Servicio",
    indicador: "COP atribuido; kWh al día por m³ o por kg",
    unidad: "COP",
    senales: "Frío pedido por cada servicio y el reparto de la sala de máquinas",
    paraQue: "Coste por cámara",
  },
  {
    equipo: "Túnel de congelación",
    indicador: "kWh por tonelada congelada y por ciclo",
    unidad: "kWh/t",
    senales: "Ciclos y toneladas por ciclo",
    paraQue: "Comparar ciclos y cargas",
  },
];

/** Qué dato se añade, en orden, y qué desbloquea. */
export const ESCALERA: { dato: string; desbloquea: string }[] = [
  { dato: "Variables del autómata que aún no se leen", desbloquea: "Avisos de compresor con su propia historia" },
  { dato: "Ficha de la instalación (placas, modelos, presión relativa o absoluta, altitud)", desbloquea: "Cuentas físicas correctas" },
  { dato: "Facturas y tarifa", desbloquea: "Euros en vez de kWh" },
  { dato: "Previsión meteorológica", desbloquea: "Condensación flotante con antelación" },
  { dato: "Analizadores de red", desbloquea: "kWh medidos: sin esto no hay ahorro demostrable" },
  { dato: "Sonda de temperatura del líquido", desbloquea: "Aire en el circuito confirmado y efecto frigorífico real" },
  { dato: "Curva del fabricante de cada compresor", desbloquea: "COP esperado y cuánto se pierde por el estado del equipo" },
  { dato: "Caudalímetro de glicol con dos sondas", desbloquea: "Frío medido: COP de la instalación medido, no estimado" },
  { dato: "Niveles, detectores, puertas, fin de desescarche", desbloquea: "Avisos de seguridad y desescarche por necesidad" },
  { dato: "Vibración y análisis de aceite", desbloquea: "Mantenimiento predictivo de los compresores" },
];

export interface Reparto {
  /** COP de la instalación: frío ÷ toda la electricidad del frío. */
  cop: number;
  /** Vatios eléctricos por kW de frío de cada parte. Sumados dan 1000 / cop. */
  wPorKw: Record<string, number>;
}

/**
 * Reparte la electricidad del frío en vatios por kW de frío.
 * `consumos` en kW eléctricos por parte (compresores, condensador, bombas…).
 * Devuelve null si no hay frío o falta algún consumo: no se inventa.
 */
export function repartoPorKwFrio(frioKw: number, consumos: Record<string, number>): Reparto | null {
  const valores = Object.values(consumos);
  if (!(frioKw > 0) || valores.length === 0) return null;
  if (valores.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const total = valores.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const wPorKw: Record<string, number> = {};
  for (const [parte, kw] of Object.entries(consumos)) wPorKw[parte] = (kw * 1000) / frioKw;
  return { cop: frioKw / total, wPorKw };
}
