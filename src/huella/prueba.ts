// La prueba de arranque: una hora guiada para sacar la huella de una cámara sin
// esperar a que la enseñen sus ciclos. Gradiox no para ni arranca nada a la
// fuerza: solo sube la consigna unos grados y la vuelve a dejar donde estaba.
// El regulador de la propia cámara, con todas sus protecciones, es quien para y
// arranca el compresor. Mientras sube se mide lo que pierde; mientras vuelve,
// lo que enfría.
//
// Todo este archivo es una cuenta sin efectos: recibe lecturas y devuelve el
// estado nuevo y las órdenes que hay que dar. Quien lo usa decide cómo se dan.

import { pendiente } from "./ciclos";
import { subidaA, type Ritmo } from "./fisica";

/** Grados que se sube la consigna, como mucho. */
export const SUBE_C = 2.5;
/** Grados que la prueba se queda siempre por debajo del límite del género. */
export const MARGEN_LIMITE_C = 2;
/** Menos recorrido que este no da una medida fiable. */
export const RECORRIDO_MINIMO_C = 1.5;
export const MINUTOS = { reposo: 10, subida: 20, bajada: 25, final: 5 } as const;
export const MINUTOS_TOTAL = MINUTOS.reposo + MINUTOS.subida + MINUTOS.bajada + MINUTOS.final;
/** Segundos sin lecturas que hacen parar la prueba. */
export const SIN_DATOS_S = 60;
/** Segundos de puerta abierta que hacen parar la prueba. */
export const PUERTA_S = 60;

export type Fase = "reposo" | "subida" | "bajada" | "final";
export const FASES: { fase: Fase; nombre: string; hace: string; mide: string }[] = [
  { fase: "reposo", nombre: "Mirar sin tocar", hace: "No se cambia nada. Se comprueba que la cámara regula con normalidad.", mide: "El punto de partida." },
  { fase: "subida", nombre: "Subir la consigna", hace: "Se sube la consigna unos grados. El regulador de la cámara para el frío él solo y la temperatura sube despacio.", mide: "Cuánto frío pierde: aislamiento, puertas e inercia." },
  { fase: "bajada", nombre: "Devolver la consigna", hace: "Se devuelve la consigna a su valor. El compresor arranca y trabaja seguido hasta recuperarla.", mide: "Cuánto enfría el equipo de verdad." },
  { fase: "final", nombre: "Comprobar que ha quedado igual", hace: "Se confirma que la consigna es la de antes y que la cámara vuelve a regular.", mide: "Que todo queda como estaba." },
];

export type PlanPrueba = {
  posible: boolean;
  /** Por qué no se puede hacer, si no se puede. */
  motivo?: string;
  consigna: number;
  limite: number;
  /** Consigna que se pide durante la subida. La temperatura no debe pasar de aquí. */
  tope: number;
  /** Si la temperatura llega aquí, la prueba se para sola. Sigue por debajo del límite. */
  corte: number;
};

/** Hasta dónde puede subir la prueba en una cámara, respetando el límite de su género. */
export function planDePrueba(consigna: number, limite: number): PlanPrueba {
  const tope = Math.min(consigna + SUBE_C, limite - MARGEN_LIMITE_C);
  const corte = Math.min(tope + 0.7, limite - 1);
  const base = { consigna, limite, tope: Math.round(tope * 10) / 10, corte: Math.round(corte * 10) / 10 };
  if (tope - consigna < RECORRIDO_MINIMO_C)
    return { ...base, posible: false, motivo: `Entre la consigna y el límite del género hay muy poco sitio: la prueba necesita subir al menos ${String(RECORRIDO_MINIMO_C).replace(".", ",")} °C quedándose ${MARGEN_LIMITE_C} °C por debajo del límite. En este servicio la huella sale de sus ciclos.` };
  return { ...base, posible: true };
}

export type Lectura = { t: number; temp: number; puerta: boolean; desescarche: boolean; alarma: boolean };
export type OrdenPrueba = { t: number; consigna: number; texto: string };
export type FinPrueba = { bien: boolean; motivo: string; t: number };
export type ResultadoPrueba = { subidaCh: number; bajadaCh: number; minutosSubida: number; minutosBajada: number; recorrido: number; recuperada: boolean };

export type EstadoPrueba = {
  plan: PlanPrueba;
  /** Quién dio el permiso. */
  quien: string;
  exteriorC: number;
  inicio: number;
  fase: Fase;
  faseDesde: number;
  /** Consigna que tiene pedida ahora mismo la cámara. */
  consignaPedida: number;
  lecturas: { t: number; temp: number; fase: Fase }[];
  ordenes: OrdenPrueba[];
  ultimaLectura: number;
  puertaDesde: number | null;
  fin?: FinPrueba;
  resultado?: ResultadoPrueba;
};

/** Lo que se comprueba antes de empezar. La prueba no arranca si algo falla. */
export function comprobaciones(plan: PlanPrueba, l: Lectura | null, ahora: number): { texto: string; bien: boolean }[] {
  const fresca = l !== null && ahora - l.t <= SIN_DATOS_S * 1000;
  return [
    { texto: "Llegan lecturas ahora mismo", bien: fresca },
    { texto: "No hay ninguna alarma en el servicio", bien: l !== null && !l.alarma },
    { texto: "La puerta está cerrada", bien: l !== null && !l.puerta },
    { texto: "No está en desescarche", bien: l !== null && !l.desescarche },
    { texto: "La temperatura está en su consigna", bien: l !== null && Math.abs(l.temp - plan.consigna) <= 1.5 },
    { texto: "Hay sitio para subir sin acercarse al límite del género", bien: plan.posible },
  ];
}

export function empezar(plan: PlanPrueba, quien: string, exteriorC: number, t: number): EstadoPrueba {
  return { plan, quien, exteriorC, inicio: t, fase: "reposo", faseDesde: t, consignaPedida: plan.consigna, lecturas: [], ordenes: [], ultimaLectura: t, puertaDesde: null };
}

const min = (ms: number) => ms / 60_000;

/** Devuelve la consigna a su valor y cierra la prueba. Vale para parar a mano y para cualquier corte de seguridad. */
export function parar(e: EstadoPrueba, t: number, motivo: string): EstadoPrueba {
  if (e.fin) return e;
  const hayQueDevolver = e.consignaPedida !== e.plan.consigna;
  return {
    ...e,
    consignaPedida: e.plan.consigna,
    ordenes: hayQueDevolver ? [...e.ordenes, { t, consigna: e.plan.consigna, texto: "Devolver la consigna: prueba parada" }] : e.ordenes,
    fin: { bien: false, motivo, t },
  };
}

/** Saca el resultado de las lecturas de la subida y de la bajada, llevado a la consigna de siempre. */
export function resultadoDe(e: EstadoPrueba): ResultadoPrueba | null {
  const de = (f: Fase) => e.lecturas.filter((l) => l.fase === f);
  const sube = de("subida"), baja = de("bajada");
  if (sube.length < 4 || baja.length < 4) return null;
  // El primer minuto de cada fase no cuenta: el regulador tarda en reaccionar.
  const util = (ls: typeof sube) => ls.filter((l) => l.t - ls[0].t >= 60_000);
  const s = util(sube), b = util(baja);
  if (s.length < 3 || b.length < 3) return null;
  const recorrido = Math.max(...sube.map((l) => l.temp)) - sube[0].temp;
  if (recorrido < 0.5) return null;

  const { consigna } = e.plan;
  const salto = Math.max(1, e.exteriorC - consigna);
  const media = (ls: typeof s) => ls.reduce((x, l) => x + l.temp, 0) / ls.length;
  // Lo que sube depende de la diferencia con el exterior: se lleva a la consigna.
  const subidaCh = (pendiente(s) * salto) / Math.max(1, e.exteriorC - media(s));
  const ritmo: Ritmo = { subidaCh, bajadaCh: 0, consigna, exteriorC: e.exteriorC };
  // Bajando, el equipo quita su tirón y a la vez entra el calor de siempre.
  const tiron = -pendiente(b) + subidaA(ritmo, media(b));
  const bajadaCh = tiron - subidaCh;
  if (!(subidaCh > 0) || !(bajadaCh > 0)) return null;
  const ultima = baja[baja.length - 1];
  return {
    subidaCh,
    bajadaCh,
    minutosSubida: min(sube[sube.length - 1].t - sube[0].t),
    minutosBajada: min(ultima.t - baja[0].t),
    recorrido,
    recuperada: ultima.temp <= consigna + 0.5,
  };
}

/** Hace avanzar la prueba con una lectura nueva. Si toca dar una orden, queda apuntada en `ordenes`. */
export function avanzar(e: EstadoPrueba, l: Lectura): EstadoPrueba {
  if (e.fin) return e;
  const { plan } = e;
  // Cortes de seguridad: cualquiera devuelve la consigna en el acto.
  if (l.t - e.ultimaLectura > SIN_DATOS_S * 1000) return parar(e, l.t, "Se han dejado de recibir lecturas");
  if (l.alarma) return parar(e, l.t, "Ha saltado una alarma en el servicio");
  if (l.temp >= plan.corte) return parar(e, l.t, "La temperatura ha subido más de lo previsto");
  if (l.desescarche) return parar(e, l.t, "Ha empezado un desescarche");
  const puertaDesde = l.puerta ? e.puertaDesde ?? l.t : null;
  if (puertaDesde !== null && l.t - puertaDesde >= PUERTA_S * 1000) return parar(e, l.t, "Se ha abierto la puerta");

  let s: EstadoPrueba = { ...e, ultimaLectura: l.t, puertaDesde, lecturas: [...e.lecturas, { t: l.t, temp: l.temp, fase: e.fase }] };
  const lleva = min(l.t - s.faseDesde);
  const pasar = (fase: Fase, consigna?: number, texto?: string): EstadoPrueba => ({
    ...s,
    fase,
    faseDesde: l.t,
    ...(consigna !== undefined && texto ? { consignaPedida: consigna, ordenes: [...s.ordenes, { t: l.t, consigna, texto }] } : {}),
  });

  if (s.fase === "reposo" && lleva >= MINUTOS.reposo) s = pasar("subida", plan.tope, "Subir la consigna");
  else if (s.fase === "subida" && (l.temp >= plan.tope - 0.2 || lleva >= MINUTOS.subida)) s = pasar("bajada", plan.consigna, "Devolver la consigna");
  else if (s.fase === "bajada" && (l.temp <= plan.consigna + 0.3 || lleva >= MINUTOS.bajada)) s = pasar("final");
  else if (s.fase === "final" && lleva >= MINUTOS.final) {
    const resultado = resultadoDe(s);
    s = { ...s, ...(resultado ? { resultado } : {}), fin: { bien: resultado !== null, motivo: resultado ? (resultado.recuperada ? "Prueba completa" : "Prueba completa, pero ha tardado en recuperar la consigna") : "La temperatura se ha movido demasiado poco para medir", t: l.t } };
  }
  return s;
}

/** Minutos que lleva la prueba y parte hecha, de 0 a 1. */
export function avance(e: EstadoPrueba, ahora: number): { minutos: number; parte: number } {
  const fin = e.fin?.t ?? ahora;
  const minutos = min(fin - e.inicio);
  return { minutos, parte: e.fin?.bien ? 1 : Math.min(0.99, minutos / MINUTOS_TOTAL) };
}

// ── Cámara simulada para ensayar la prueba ──────────────────────────────────

/** Una cámara de mentira que responde a la consigna como una de verdad: pierde frío según la diferencia con el exterior y su regulador arranca y para con histéresis. */
export type Planta = { temp: number; compresor: boolean; ritmo: Ritmo; histeresis: number };

export const plantaNueva = (ritmo: Ritmo, temp = ritmo.consigna, histeresis = 0.7): Planta => ({ temp, compresor: false, ritmo, histeresis });

/** Avanza la cámara simulada `segundos` con la consigna pedida. */
export function pasoPlanta(p: Planta, consigna: number, segundos: number): Planta {
  let { temp, compresor } = p;
  const tiron = p.ritmo.subidaCh + p.ritmo.bajadaCh;
  // Pasos de 5 segundos como mucho, para que el regulador no se salte la vuelta.
  for (let quedan = segundos; quedan > 0; quedan -= 5) {
    const dt = Math.min(5, quedan) / 3600;
    if (temp >= consigna + p.histeresis) compresor = true;
    else if (temp <= consigna - p.histeresis) compresor = false;
    temp += (subidaA(p.ritmo, temp) - (compresor ? tiron : 0)) * dt;
  }
  return { ...p, temp, compresor };
}
