// Equipos de medida para el rendimiento (COP) y la automatización: para qué se usa
// cada uno, qué mejora (qué número pasa de estimado a medido y con qué precisión),
// qué avisos y ajustes habilita, y qué cuesta solo si falta. Lo normal es que la
// instalación ya los tenga: primero se comprueba en la ficha técnica si existen y si
// el autómata los lee. Fuente de /ops/automatizacion, de la ficha técnica y de la
// Ayuda «Rendimiento». Cambiar aquí obliga a cambiar docs/rendimiento.md (sección 7).

export interface EquipoMedida {
  nombre: string;
  /** Para qué se usa, en una frase para quien no es del sector. */
  paraQue: string;
  /** Qué mejora: qué número pasa de estimado a medido y con qué precisión. */
  mejora: string;
  /** Avisos y ajustes que habilita (ids de docs/rendimiento.md). */
  habilita: string;
  /** Nivel de automatización desde el que hace falta, y si es imprescindible. */
  nivel: 0 | 1 | 2 | 3 | 4;
  imprescindible: boolean;
  /** Coste orientativo si falta, sin presupuesto pedido (rangos de mercado del plan). */
  siFalta: string;
}

export const EQUIPOS_MEDIDA = {
  analizadorGeneral: {
    nombre: "Analizador de red general del frío",
    paraQue: "Mide la electricidad que gasta todo el frío junto (compresores, condensador, bombas, ventiladores, desescarches).",
    mejora: "El consumo pasa de estimado por intensidad (±7–20 %) a medido (±1–2 %). Sin él, ningún ahorro se puede demostrar.",
    habilita: "COP de la instalación, línea base, días de control, informe mensual, expediente CAE. Imprescindible para «Proponer» y todo lo que sigue.",
    nivel: 2,
    imprescindible: true,
    siFalta: "150–400 €",
  },
  analizadoresEquipos: {
    nombre: "Analizadores por compresor, condensador y bombas",
    paraQue: "Miden lo que gasta cada equipo por separado.",
    mejora: "El reparto por equipo pasa de estimado a medido; el COP de cada compresor, de banda ±15–35 % a ±3–8 % con su curva.",
    habilita: "Aviso «compresor que gasta más que antes» (A1) con kWh reales, indicador W/kW de condensador y bombas, condensación óptima contando ventiladores (J10).",
    nivel: 2,
    imprescindible: false,
    siFalta: "150–400 € cada uno",
  },
  sondaExterior: {
    nombre: "Sonda exterior de temperatura y humedad",
    paraQue: "Dice qué tiempo hace fuera, que es lo que limita cuánto puede bajar la condensación.",
    mejora: "Permite comparar días con distinto tiempo; sin ella la línea base y la condensación flotante no son fiables.",
    habilita: "Condensación flotante (J1), aviso de condensación más alta de lo que permite el tiempo (A13), línea base.",
    nivel: 2,
    imprescindible: true,
    siFalta: "Sin presupuesto pedido; muchas centrales ya la tienen",
  },
  sondaLiquido: {
    nombre: "Sonda de temperatura en la línea de líquido",
    paraQue: "Mide el líquido que sale del condensador.",
    mejora: "Confirma el aire en el circuito (de «probable» a «confirmado») y da el efecto frigorífico real en vez de supuesto.",
    habilita: "Aviso de aire confirmado (A9b); mejor cálculo del frío.",
    nivel: 1,
    imprescindible: false,
    siFalta: "50–150 € por punto",
  },
  caudalGlicol: {
    nombre: "Caudalímetro de glicol con sondas de ida y vuelta",
    paraQue: "Mide el frío que de verdad llega a los servicios.",
    mejora: "El COP de la instalación pasa de estimado (±15 %) a medido (±3–5 %). Es la única compra cara.",
    habilita: "COP medido, bombas de glicol por salto térmico (J6), aviso de glicol con poco salto (A24).",
    nivel: 3,
    imprescindible: false,
    siFalta: "1.500–5.000 € más montaje",
  },
  puertas: {
    nombre: "Contactos de puerta o señal de muelle",
    paraQue: "Dicen cuándo se abre una cámara o entra mercancía.",
    mejora: "Gradiox aparta esa cámara a tiempo en vez de deducirlo por la subida de temperatura.",
    habilita: "Aviso de puerta abierta (A19); parada del automático en esa cámara al entrar mercancía.",
    nivel: 3,
    imprescindible: false,
    siFalta: "30–150 € por punto",
  },
  nivelRecipiente: {
    nombre: "Nivel del recipiente de líquido",
    paraQue: "Mide cuánto refrigerante hay en el depósito.",
    mejora: "Detecta una pérdida lenta de amoniaco antes de que se note en el frío.",
    habilita: "Aviso de pérdida de amoniaco (A17).",
    nivel: 1,
    imprescindible: false,
    siFalta: "300–800 € si no existe",
  },
  detectoresNh3: {
    nombre: "Detectores de amoniaco conectados al autómata",
    paraQue: "Avisan de una fuga en la sala.",
    mejora: "Gradiox puede parar cualquier ajuste al momento si hay fuga.",
    habilita: "Parada total del automático y aviso (A18). La sala de máquinas ya suele tenerlos; solo falta que Gradiox los lea.",
    nivel: 3,
    imprescindible: true,
    siFalta: "0 € si ya van al autómata",
  },
} as const satisfies Record<string, EquipoMedida>;

export type IdEquipoMedida = keyof typeof EQUIPOS_MEDIDA;
export const IDS_EQUIPO = Object.keys(EQUIPOS_MEDIDA) as IdEquipoMedida[];
