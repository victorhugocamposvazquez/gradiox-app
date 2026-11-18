// Históricos: lo leído y lo ejecutado en una instalación, resumido para que se
// vea de un vistazo qué ha cambiado. Aquí solo hay cuentas; de dónde salen las
// lecturas (la base de datos o la simulación) lo decide quien llama.

export type Valor = boolean | number | string | null;
export type Muestra = { t: number; x: Valor };

/** Una variable es de número (temperatura, presión…) o de sí/no (en marcha, avería…). */
export type Clase = "numero" | "sino";

/** Lo que pasó en un rato: para números, mínima, media y máxima; para sí/no, qué parte del rato estuvo en «sí» y cuántas veces pasó a «sí». */
export type Tramo = { t: number; n: number; min: number | null; max: number | null; media: number | null; activa: number | null; arranques: number };

export type ResumenVariable = {
  v: string;
  clase: Clase;
  n: number;
  min: number | null;
  max: number | null;
  media: number | null;
  /** Parte del tiempo en «sí», de 0 a 1. */
  activa: number | null;
  /** Veces que pasó de «no» a «sí». */
  arranques: number;
  /** Cuánto sube o baja por día a lo largo del periodo. */
  pendiente: number | null;
};

export type MetaVariable = { v: string; nombre: string; grupo: string; unidad?: string; clase: Clase };

export type EstadoOrden = "pendiente" | "enviada" | "hecha" | "rechazada" | "caducada" | "anulada";
/** Algo que se mandó hacer a la instalación. */
export type Ejecutado = {
  id: string;
  t: number;
  /** Variable sobre la que se actuó. */
  v?: string;
  que: string;
  antes?: Valor;
  valor?: Valor;
  leido?: Valor;
  estado: EstadoOrden;
  motivo?: string;
  quien?: string;
  simulada?: boolean;
};

export const HORA = 3_600_000;
export const DIA = 86_400_000;
export const MAX_DIAS = 366;

const PASOS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, HORA, 3 * HORA, 6 * HORA, 12 * HORA, DIA];
/** El rato que resume cada punto de la gráfica, para que no pasen de unos doscientos. */
export const tramoPara = (desde: number, hasta: number, puntos = 200) => PASOS.find((p) => (hasta - desde) / p <= puntos) ?? DIA;

type Acumulado = { n: number; min: number; max: number; suma: number; si: number; no: number; arranques: number };
const vacio = (): Acumulado => ({ n: 0, min: Infinity, max: -Infinity, suma: 0, si: 0, no: 0, arranques: 0 });
function sumar(a: Acumulado, x: Valor, previo: Valor | undefined) {
  if (typeof x === "number" && Number.isFinite(x)) {
    a.n++;
    a.suma += x;
    if (x < a.min) a.min = x;
    if (x > a.max) a.max = x;
  } else if (typeof x === "boolean") {
    if (x) {
      a.si++;
      if (previo === false) a.arranques++;
    } else a.no++;
  }
}
const claseDe = (a: Acumulado): Clase | null => (a.n ? "numero" : a.si + a.no ? "sino" : null);

/** Reparte las lecturas (ordenadas por instante) en ratos iguales. Los ratos sin lecturas no salen. */
export function tramos(muestras: Muestra[], desde: number, hasta: number, tramoMs: number): Tramo[] {
  const cubos = new Map<number, Acumulado>();
  let previo: Valor | undefined;
  for (const m of muestras) {
    if (m.t >= desde && m.t < hasta) {
      const t = Math.floor(m.t / tramoMs) * tramoMs;
      let a = cubos.get(t);
      if (!a) cubos.set(t, (a = vacio()));
      sumar(a, m.x, previo);
    }
    previo = m.x;
  }
  const out: Tramo[] = [];
  for (const [t, a] of [...cubos].sort((x, y) => x[0] - y[0])) {
    const clase = claseDe(a);
    if (!clase) continue;
    out.push(clase === "numero" ? { t, n: a.n, min: a.min, max: a.max, media: a.suma / a.n, activa: null, arranques: 0 } : { t, n: a.si + a.no, min: null, max: null, media: null, activa: a.si / (a.si + a.no), arranques: a.arranques });
  }
  return out;
}

/** Pendiente de la recta que mejor sigue a los puntos, en unidades por día. */
export function pendientePorDia(puntos: { t: number; y: number }[]): number | null {
  if (puntos.length < 3) return null;
  const mt = puntos.reduce((s, p) => s + p.t, 0) / puntos.length;
  const my = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
  let arriba = 0;
  let abajo = 0;
  for (const p of puntos) {
    arriba += (p.t - mt) * (p.y - my);
    abajo += (p.t - mt) ** 2;
  }
  return abajo ? (arriba / abajo) * DIA : null;
}

/** Resume un periodo entero de una variable. */
export function resumir(v: string, muestras: Muestra[], desde: number, hasta: number): ResumenVariable | null {
  const horas = tramos(muestras, desde, hasta, HORA);
  if (!horas.length) return null;
  const numero = horas[0].media !== null;
  const n = horas.reduce((s, h) => s + h.n, 0);
  if (numero) {
    return {
      v,
      clase: "numero",
      n,
      min: Math.min(...horas.map((h) => h.min as number)),
      max: Math.max(...horas.map((h) => h.max as number)),
      media: horas.reduce((s, h) => s + (h.media as number) * h.n, 0) / n,
      activa: null,
      arranques: 0,
      pendiente: pendientePorDia(horas.map((h) => ({ t: h.t, y: h.media as number }))),
    };
  }
  return { v, clase: "sino", n, min: null, max: null, media: null, activa: horas.reduce((s, h) => s + (h.activa ?? 0) * h.n, 0) / n, arranques: horas.reduce((s, h) => s + h.arranques, 0), pendiente: null };
}

/** Para comparar hace falta que el periodo anterior tenga al menos la mitad de lecturas que este. */
export const comparable = (a: ResumenVariable, b: ResumenVariable | null | undefined): b is ResumenVariable => !!b && b.clase === a.clase && b.n >= 3 && a.n >= 3 && b.n >= a.n * 0.5;
/** Las veces que pasó a «sí» en el periodo anterior, llevadas al mismo número de lecturas que este: si antes hubo menos datos, no parece que antes pasara menos. */
export const arranquesAntes = (a: ResumenVariable, b: ResumenVariable) => Math.round((b.arranques * a.n) / b.n);

export type TipoCambio = "media" | "deriva" | "marcha" | "arranques";
/** Algo que es distinto de lo que venía siendo. `peso` ordena: 1 ya es un cambio que se nota. */
export type Cambio = { v: string; tipo: TipoCambio; ahora: number; antes: number | null; peso: number };

/**
 * Compara un periodo con el anterior, variable a variable, y devuelve lo que
 * más ha cambiado, de más a menos. De cada variable sale como mucho un cambio:
 * el que más pesa. No dice si el cambio es bueno o malo: eso depende de qué
 * mida la variable y lo decide quien conoce la instalación.
 */
export function cambios(actual: ResumenVariable[], anterior: ResumenVariable[], diasPeriodo: number, minimo = 0.5): Cambio[] {
  const antes = new Map(anterior.map((r) => [r.v, r]));
  const out: Cambio[] = [];
  for (const a of actual) {
    const b = antes.get(a.v);
    const candidatos: Cambio[] = [];
    if (a.clase === "numero" && a.media !== null) {
      // Lo que se mueve la variable en condiciones normales: con eso se mide si el cambio es grande.
      const vaiven = Math.max(b && b.max !== null && b.min !== null ? b.max - b.min : 0, (a.max as number) - (a.min as number), Math.abs(a.media) * 0.02, 0.1);
      if (comparable(a, b) && b.media !== null) candidatos.push({ v: a.v, tipo: "media", ahora: a.media, antes: b.media, peso: (Math.abs(a.media - b.media) / vaiven) * 2 });
      if (a.pendiente !== null && diasPeriodo >= 2) candidatos.push({ v: a.v, tipo: "deriva", ahora: a.pendiente, antes: null, peso: (Math.abs(a.pendiente) * diasPeriodo) / vaiven });
    } else if (a.clase === "sino" && a.activa !== null && comparable(a, b) && b.activa !== null) {
      const antesVeces = arranquesAntes(a, b);
      candidatos.push({ v: a.v, tipo: "marcha", ahora: a.activa, antes: b.activa, peso: Math.abs(a.activa - b.activa) * 5 });
      if (a.arranques + antesVeces >= 4) candidatos.push({ v: a.v, tipo: "arranques", ahora: a.arranques, antes: antesVeces, peso: Math.abs(a.arranques - antesVeces) / Math.max(antesVeces, 2) });
    }
    const mayor = candidatos.sort((x, y) => y.peso - x.peso)[0];
    if (mayor && mayor.peso >= minimo) out.push(mayor);
  }
  return out.sort((x, y) => y.peso - x.peso);
}

/** Nombre y grupo con los que se enseña una variable cuando nadie ha dicho qué es. */
export function metaPorNombre(v: string, clase: Clase): MetaVariable {
  const corte = v.lastIndexOf(".");
  return corte > 0 ? { v, nombre: v.slice(corte + 1), grupo: v.slice(0, corte), clase } : { v, nombre: v, grupo: "Sin grupo", clase };
}

const celda = (x: unknown) => {
  const s = x === null || x === undefined ? "" : typeof x === "number" ? String(x).replace(".", ",") : typeof x === "boolean" ? (x ? "sí" : "no") : String(x);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fechaHora = (t: number) => new Date(t).toLocaleString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const redondo = (n: number | null, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Las lecturas de una variable, para abrir en una hoja de cálculo. */
export function csvLecturas(m: MetaVariable, filas: Tramo[]): string {
  const cabecera = m.clase === "numero" ? ["Fecha y hora", "Mínima", "Media", "Máxima", "Lecturas"] : ["Fecha y hora", "% del tiempo en sí", "Veces que pasó a sí", "Lecturas"];
  const cuerpo = filas.map((f) => (m.clase === "numero" ? [fechaHora(f.t), redondo(f.min), redondo(f.media), redondo(f.max), f.n] : [fechaHora(f.t), redondo((f.activa ?? 0) * 100, 0), f.arranques, f.n]));
  return [[`${m.grupo} · ${m.nombre}${m.unidad ? ` (${m.unidad})` : ""}`], cabecera, ...cuerpo].map((f) => f.map(celda).join(";")).join("\r\n");
}

export const TEXTO_ESTADO: Record<EstadoOrden, string> = { pendiente: "Esperando", enviada: "Enviada", hecha: "Hecha", rechazada: "Rechazada", caducada: "No se llegó a hacer", anulada: "Anulada" };

export function csvEjecutado(filas: Ejecutado[]): string {
  return [["Fecha y hora", "Qué", "Variable", "Valor anterior", "Valor pedido", "Valor leído después", "Resultado", "Motivo", "Quién"], ...filas.map((e) => [fechaHora(e.t), e.que, e.v ?? "", e.antes ?? "", e.valor ?? "", e.leido ?? "", TEXTO_ESTADO[e.estado], e.motivo ?? "", e.quien ?? ""])]
    .map((f) => f.map(celda).join(";"))
    .join("\r\n");
}
