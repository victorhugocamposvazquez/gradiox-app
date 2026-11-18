// Modelo físico de un punto de frío. Con cuatro datos que se saben el primer día
// (volumen, género, potencia y temperatura de alrededor) calcula lo que debería
// pasar: cuánto frío pierde, cuánto tarda en enfriar, qué parte del tiempo tiene
// que trabajar el compresor y cuánto gasta. No aprende de nada: son cuentas de
// calor. Por eso sirve desde el minuto cero, antes de tener una sola lectura.
//
// La cámara se trata como un solo cuerpo: gana calor por las paredes, por las
// puertas, por el género que entra y por lo que lleva dentro (ventiladores,
// luces), y lo pierde cuando el compresor está en marcha.

export type ClaseProducto = "congelado" | "carne" | "lacteos" | "fruta" | "mixto";

/** Calor que guarda cada género. kJ por kilo y grado, por encima y por debajo de su punto de congelación; kJ por kilo al congelarse. */
export const PRODUCTOS: Record<ClaseProducto, { nombre: string; calorSobre: number; calorBajo: number; latente: number; congelaC: number }> = {
  congelado: { nombre: "Congelados en general", calorSobre: 3.5, calorBajo: 1.9, latente: 230, congelaC: -1.5 },
  carne: { nombre: "Carne y pescado", calorSobre: 3.2, calorBajo: 1.7, latente: 230, congelaC: -2 },
  lacteos: { nombre: "Lácteos", calorSobre: 3.8, calorBajo: 2, latente: 270, congelaC: -1 },
  fruta: { nombre: "Fruta y verdura", calorSobre: 3.8, calorBajo: 1.9, latente: 290, congelaC: -1 },
  mixto: { nombre: "Género variado", calorSobre: 3.5, calorBajo: 1.9, latente: 240, congelaC: -1.5 },
};

/** Lo que hay que saber de una cámara para calcular lo que se espera de ella. */
export type FichaFisica = {
  /** Volumen interior, en m³. */
  volumenM3: number;
  /** Espesor del panel aislante, en mm. */
  panelMm: number;
  producto: ClaseProducto;
  /** Kilos de género que suele haber dentro. */
  productoKg: number;
  /** Potencia eléctrica del compresor, en kW. Cero si el frío le llega de una central. */
  potenciaKw: number;
  /** Frío que le llega de la central, en kW, cuando no tiene compresor propio. */
  frioCentralKw?: number;
  /** Temperatura alrededor de la cámara, en °C. */
  exteriorC: number;
  /** Veces que se abre la puerta por hora, de media. */
  aperturasHora: number;
  /** Kilos de género que entran al día y a qué temperatura llegan. */
  entradaKgDia: number;
  entradaC: number;
  /** Calor fijo conocido que no sale de lo anterior, en kW: un mueble abierto, una cortina de aire. */
  cargaFijaKw?: number;
  /** Parte del género que sigue al aire en un ciclo corto, de 0 a 1. En una cámara, muy poca; en un túnel o un mueble, mucha. Lo pone el perfil. */
  acople?: number;
  /** Parte del rendimiento ideal que consigue el equipo. Entre 0,35 y 0,6; lo pone el perfil. */
  rendimiento?: number;
};

export type Esperado = {
  superficieM2: number;
  /** Calor que entra por cada grado de diferencia con el exterior, en W/°C: paredes más puertas. */
  perdidaWK: number;
  /** Calor que hace falta para cambiar un grado la cámara en el corto plazo, en kWh/°C. */
  inerciaKwhK: number;
  /** Frío que da el equipo por cada kW eléctrico. */
  cop: number;
  frioKw: number;
  /** De dónde viene el calor que hay que sacar, en kW. */
  cargas: { paredes: number; puertas: number; genero: number; interna: number; total: number };
  /** Parte del tiempo que el compresor tiene que estar en marcha, de 0 a 1. Puede pasar de 1: no llega. */
  marcha: number;
  kwhDia: number;
  /** Grados por hora que sube parada y que baja en marcha, a la consigna. */
  subidaCh: number;
  bajadaCh: number;
};

const AIRE_KJ_M3K = 1.3; // kilos por m³ × calor del aire
const LAMBDA_PANEL = 0.023; // W/m·°C del poliuretano
const PUENTES = 1.15; // juntas, suelo y puertas cerradas pierden algo más que el panel
const AIRE_POR_APERTURA_M3 = 15;
const HUMEDAD = 1.6; // el aire que entra trae agua que se hiela: cuenta un 60 % más
const PARTE_INTERNA = 0.12; // ventiladores, luces y desescarche, sobre la potencia del compresor
/** Parte del género que acompaña al aire en un ciclo corto. El resto tarda horas en enterarse. */
const ACOPLE = 0.01;
const PIEL_KJ_M2K = 2; // chapa interior del panel
const RENDIMIENTO = 0.48;

/** Superficie de paredes, techo y suelo de una cámara de ese volumen, con la altura habitual para su tamaño. */
export function superficie(volumenM3: number): number {
  const alto = Math.min(10, Math.max(2.5, 0.55 * Math.cbrt(volumenM3)));
  const planta = volumenM3 / alto;
  return 2 * planta + 4 * Math.sqrt(planta) * alto;
}

/** Frío que da el equipo por kW eléctrico: una parte del ideal entre la temperatura a la que evapora y a la que condensa. */
export function cop(camaraC: number, exteriorC: number, rendimiento = RENDIMIENTO): number {
  const evapora = camaraC - 7 + 273.15;
  const condensa = Math.max(exteriorC, 15) + 13 + 273.15;
  return rendimiento * (evapora / (condensa - evapora));
}

/** Calor que hay que sacarle a un kilo de género que entra a `entraC` para dejarlo a `finalC`, en kJ. */
export function calorDeEnfriar(p: ClaseProducto, entraC: number, finalC: number): number {
  if (entraC <= finalC) return 0;
  const g = PRODUCTOS[p];
  const sobre = Math.max(0, entraC - Math.max(finalC, g.congelaC)) * g.calorSobre;
  const cruza = entraC > g.congelaC && finalC < g.congelaC;
  const bajo = Math.max(0, Math.min(entraC, g.congelaC) - finalC) * g.calorBajo;
  return sobre + (cruza ? g.latente : 0) + bajo;
}

/** Lo que se espera de una cámara con esa ficha trabajando a esa consigna. */
export function esperado(f: FichaFisica, consigna: number): Esperado {
  const salto = Math.max(1, f.exteriorC - consigna);
  const superficieM2 = superficie(f.volumenM3);
  const paredesWK = (LAMBDA_PANEL / (f.panelMm / 1000)) * superficieM2 * PUENTES;
  const puertasWK = (f.aperturasHora * AIRE_POR_APERTURA_M3 * AIRE_KJ_M3K * HUMEDAD * 1000) / 3600;
  const perdidaWK = paredesWK + puertasWK;

  const rinde = cop(consigna, f.exteriorC, f.rendimiento);
  const frioKw = f.potenciaKw > 0 ? f.potenciaKw * rinde : f.frioCentralKw ?? 0;
  const genero = (f.entradaKgDia * calorDeEnfriar(f.producto, f.entradaC, consigna)) / 86_400;
  const interna = (f.potenciaKw > 0 ? f.potenciaKw * PARTE_INTERNA : frioKw * 0.06) + (f.cargaFijaKw ?? 0);
  const paredes = (paredesWK * salto) / 1000;
  const puertas = (puertasWK * salto) / 1000;
  const total = paredes + puertas + genero + interna;

  const g = PRODUCTOS[f.producto];
  const calorGenero = consigna < g.congelaC ? g.calorBajo : g.calorSobre;
  const inerciaKj = f.volumenM3 * AIRE_KJ_M3K + superficieM2 * PIEL_KJ_M2K + f.productoKg * calorGenero * (f.acople ?? ACOPLE);
  const inerciaKwhK = inerciaKj / 3600;

  const marcha = frioKw > 0 ? total / frioKw : 0;
  return {
    superficieM2,
    perdidaWK,
    inerciaKwhK,
    cop: rinde,
    frioKw,
    cargas: { paredes, puertas, genero, interna, total },
    marcha,
    kwhDia: f.potenciaKw * Math.min(1, marcha) * 24,
    subidaCh: total / inerciaKwhK,
    bajadaCh: (frioKw - total) / inerciaKwhK,
  };
}

/** Cómo se porta una cámara, medido o calculado: lo que sube parada y lo que baja en marcha, a una consigna y con un exterior. */
export type Ritmo = { subidaCh: number; bajadaCh: number; consigna: number; exteriorC: number };

export const ritmoEsperado = (f: FichaFisica, consigna: number): Ritmo => {
  const e = esperado(f, consigna);
  return { subidaCh: e.subidaCh, bajadaCh: e.bajadaCh, consigna, exteriorC: f.exteriorC };
};

/** Parte del tiempo que tiene que estar en marcha para mantenerse: lo que pierde entre lo que pierde más lo que gana. */
export const marchaDe = (r: Ritmo) => (r.subidaCh + r.bajadaCh > 0 ? r.subidaCh / (r.subidaCh + r.bajadaCh) : 0);

/** Lo que sube parada a otra temperatura: el calor que entra crece con la diferencia con el exterior. */
export function subidaA(r: Ritmo, temp: number): number {
  const salto = Math.max(1, r.exteriorC - r.consigna);
  return (r.subidaCh * Math.max(0, r.exteriorC - temp)) / salto;
}

/** Minutos que tarda parada en ir de `desde` a `hasta` (más caliente). Null si no llega nunca. */
export function minutosDeSubida(r: Ritmo, desde: number, hasta: number): number | null {
  if (hasta <= desde) return 0;
  if (r.subidaCh <= 0 || hasta >= r.exteriorC) return null;
  const tau = Math.max(1, r.exteriorC - r.consigna) / r.subidaCh; // horas
  return tau * Math.log((r.exteriorC - desde) / (r.exteriorC - hasta)) * 60;
}

/** Minutos que tarda en marcha continua en ir de `desde` a `hasta` (más frío). Null si el equipo no llega a esa temperatura. */
export function minutosDeBajada(r: Ritmo, desde: number, hasta: number): number | null {
  if (hasta >= desde) return 0;
  const salto = Math.max(1, r.exteriorC - r.consigna);
  const k = r.subidaCh / salto; // 1/h
  const tiron = r.subidaCh + r.bajadaCh; // °C/h que quita el equipo
  if (k <= 0) return tiron > 0 ? ((desde - hasta) / tiron) * 60 : null;
  const fondo = r.exteriorC - tiron / k; // temperatura a la que se quedaría sin parar nunca
  if (hasta <= fondo) return null;
  return (Math.log((desde - fondo) / (hasta - fondo)) / k) * 60;
}

export type Tono = "aviso" | "error" | "azul";
export type AvisoHuella = { clave: "pierde" | "enfria" | "limite" | "margen"; tono: Tono; titulo: string; detalle: string };
export type Comparacion = {
  /** Cuánto más (o menos) de lo esperado, en tanto por uno: 0,25 es un 25 % más. */
  perdida: number;
  tiron: number;
  marchaEsperada: number;
  marchaMedida: number;
  /** kWh al día que gasta de más (o de menos) frente a lo esperado. */
  sobraKwhDia: number;
  autonomiaMin: number | null;
  avisos: AvisoHuella[];
};

export const UMBRAL_PIERDE = 0.25;
export const UMBRAL_ENFRIA = -0.2;
export const AUTONOMIA_CORTA_MIN = 30;

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)} %`;

/** Compara lo medido con lo esperado y dice, con reglas fijas, qué se aparta y qué mirar. */
export function comparar(esperadoR: Ritmo, medido: Ritmo, potenciaKw: number, limite: number): Comparacion {
  const perdida = esperadoR.subidaCh > 0 ? medido.subidaCh / esperadoR.subidaCh - 1 : 0;
  const tironE = esperadoR.subidaCh + esperadoR.bajadaCh;
  const tironM = medido.subidaCh + medido.bajadaCh;
  const tiron = tironE > 0 ? tironM / tironE - 1 : 0;
  const marchaEsperada = marchaDe(esperadoR);
  const marchaMedida = marchaDe(medido);
  const autonomiaMin = minutosDeSubida(medido, medido.consigna, limite);
  const sobraKwhDia = potenciaKw * (Math.min(1, marchaMedida) - Math.min(1, marchaEsperada)) * 24;

  const avisos: AvisoHuella[] = [];
  if (perdida >= UMBRAL_PIERDE)
    avisos.push({ clave: "pierde", tono: "aviso", titulo: `Pierde frío un ${pct(perdida)} más rápido de lo esperado`, detalle: "Parada sube más deprisa de lo que debería una cámara como esta. Revisar los burletes y el cierre de la puerta, la cortina, juntas de panel con hielo y si entra más género caliente del anotado en la ficha." });
  if (tiron <= UMBRAL_ENFRIA)
    avisos.push({ clave: "enfria", tono: "aviso", titulo: `Enfría un ${pct(tiron)} más despacio de lo esperado`, detalle: "En marcha baja menos de lo que debería con esa potencia. Revisar hielo en el evaporador y el desescarche, el condensador sucio, la carga de gas y los ventiladores." });
  if (marchaMedida >= 0.85)
    avisos.push({ clave: "limite", tono: "error", titulo: "El equipo va casi al límite", detalle: `Necesita estar en marcha el ${pct(marchaMedida)} del tiempo para mantenerse. Con un día de calor o una carga grande no llegará a la consigna.` });
  if (autonomiaMin !== null && autonomiaMin < AUTONOMIA_CORTA_MIN)
    avisos.push({ clave: "margen", tono: "azul", titulo: `Si se para, llega al límite en unos ${Math.round(autonomiaMin)} min`, detalle: "Es el tiempo que tarda el aire de la cámara; el género va por detrás, así que la cifra queda del lado seguro. Conviene que el aviso de compresor parado llegue al momento a quien pueda actuar." });
  return { perdida, tiron, marchaEsperada, marchaMedida, sobraKwhDia, autonomiaMin, avisos };
}
