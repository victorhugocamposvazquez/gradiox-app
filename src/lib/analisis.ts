// Cuentas que salen de las lecturas: cuánto falta para el límite, registro por
// días, consumo y marcha del compresor. Todo se calcula sobre la simulación.

import { preciosDelDia } from "./luz";
import { leer, serie, type Ajustes, type Camara } from "./datos";

const MIN = 60_000;

/**
 * Minutos que faltan para tocar el límite del género si la temperatura sigue
 * subiendo como en el último cuarto de hora. Solo se calcula con una alarma o
 * con la puerta abierta diez minutos o más: una puerta que se abre un momento
 * no es una tendencia. Devuelve null si no sube o si ya ha pasado el límite.
 */
export function minutosAlLimite(c: Camara, t: number, aj: Ajustes): number | null {
  const ahora = leer(c, t, aj);
  if (ahora.estado === "sindatos" || ahora.temp >= c.limite) return null;
  if (ahora.estado !== "error" && !(ahora.puerta && ahora.puertaMin >= 10)) return null;
  const averia = aj.averias[c.id];
  const desdeAveria = averia && t >= averia.desde ? (t - averia.desde) / MIN : Infinity;
  const ventana = Math.min(15, Math.max(2, desdeAveria));
  const antes = leer(c, t - ventana * MIN, aj);
  const pendiente = (ahora.temp - antes.temp) / ventana;
  if (pendiente < 0.03) return null;
  const minutos = Math.round((c.limite - ahora.temp) / pendiente);
  return minutos <= 600 ? Math.max(1, minutos) : null;
}

export type DiaRegistro = { fecha: string; min: number | null; max: number | null; media: number | null; minutosFuera: number; minutosSinDatos: number; lecturas: number };

const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PASO_REGISTRO = 15;

/** Mínima, máxima y media de cada día, del más reciente al más antiguo. Una lectura cada 15 minutos. */
export function registroDiario(c: Camara, hasta: number, aj: Ajustes, dias = 7): DiaRegistro[] {
  const out: DiaRegistro[] = [];
  const hoy = new Date(hasta);
  for (let d = 0; d < dias; d++) {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d).getTime();
    const fin = Math.min(inicio + 24 * 60 * MIN, hasta);
    let min = Infinity;
    let max = -Infinity;
    let suma = 0;
    let n = 0;
    let fuera = 0;
    let sinDatos = 0;
    for (let t = inicio; t < fin; t += PASO_REGISTRO * MIN) {
      const l = leer(c, t, aj);
      if (l.estado === "sindatos") {
        sinDatos += PASO_REGISTRO;
        continue;
      }
      min = Math.min(min, l.temp);
      max = Math.max(max, l.temp);
      suma += l.temp;
      n++;
      if (l.temp >= c.limite) fuera += PASO_REGISTRO;
    }
    if (n || sinDatos) out.push({ fecha: fechaLocal(new Date(inicio)), min: n ? min : null, max: n ? max : null, media: n ? Math.round((suma / n) * 10) / 10 : null, minutosFuera: fuera, minutosSinDatos: sinDatos, lecturas: n });
  }
  return out;
}

/** Las lecturas de los últimos días en CSV, con punto y coma y coma decimal para abrirlo en una hoja de cálculo en español. */
export function registroCsv(c: Camara, hasta: number, aj: Ajustes, dias = 7): string {
  const hoy = new Date(hasta);
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (dias - 1)).getTime();
  const filas = ["Cámara;Fecha;Hora;Temperatura °C;Consigna °C;Límite °C;Puerta;Compresor"];
  for (let t = inicio; t <= hasta; t += PASO_REGISTRO * MIN) {
    const l = leer(c, t, aj);
    const d = new Date(t);
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const n = (v: number) => v.toFixed(1).replace(".", ",");
    const fila = l.estado === "sindatos" ? ["Sin datos", n(l.consigna), n(c.limite), "Sin datos", "Sin datos"] : [n(l.temp), n(l.consigna), n(c.limite), l.puerta ? "Abierta" : "Cerrada", l.compresor ? "En marcha" : "Parado"];
    filas.push([c.nombre, fechaLocal(d), hhmm, ...fila].join(";"));
  }
  return filas.join("\r\n");
}

export type Consumo = { kwh: number; euros: number };

/**
 * Consumo y coste del compresor desde las 00:00 de hoy. Se calcula con la
 * potencia nominal y el tiempo de marcha, no con un contador.
 */
export function consumoHoy(c: Camara, hasta: number, aj: Ajustes): Consumo {
  const hoy = new Date(hasta);
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const precios = preciosDelDia(hoy);
  const paso = 5;
  let kwh = 0;
  let euros = 0;
  for (let t = inicio; t < hasta; t += paso * MIN) {
    const l = leer(c, t, aj);
    if (l.estado === "sindatos" || !l.compresor) continue;
    const e = (c.potenciaKw * paso) / 60;
    kwh += e;
    euros += (e * precios[new Date(t).getHours()]) / 1000;
  }
  return { kwh: Math.round(kwh), euros: Math.round(euros * 100) / 100 };
}

export type Marcha = { porcentaje: number; arranquesHora: number };

/** Qué parte del tiempo ha estado en marcha el compresor y cuántas veces arranca por hora. */
export function marchaCompresor(c: Camara, hasta: number, aj: Ajustes, horas = 24): Marcha {
  const fin = Math.floor(hasta / MIN) * MIN;
  const total = horas * 60;
  let enMarcha = 0;
  let arranques = 0;
  let previo = leer(c, fin - total * MIN, aj).compresor;
  for (let i = total - 1; i >= 0; i--) {
    const ahora = leer(c, fin - i * MIN, aj).compresor;
    if (ahora) enMarcha++;
    if (ahora && !previo) arranques++;
    previo = ahora;
  }
  return { porcentaje: Math.round((enMarcha / total) * 100), arranquesHora: Math.round((arranques / horas) * 10) / 10 };
}

export type Tendencia = "sube" | "baja" | "estable";

/** Hacia dónde va la temperatura respecto a hace diez minutos. Un grado de margen para no bailar con cada ciclo. */
export function tendencia(c: Camara, t: number, aj: Ajustes): Tendencia {
  const d = leer(c, t, aj).temp - leer(c, t - 10 * MIN, aj).temp;
  return d > 1 ? "sube" : d < -1 ? "baja" : "estable";
}

/** Temperaturas de la última hora, una cada dos minutos, para el trazo pequeño de cada cámara. */
export function ultimaHora(c: Camara, t: number, aj: Ajustes): number[] {
  const fin = Math.floor(t / MIN) * MIN;
  const out: number[] = [];
  for (let i = 30; i >= 0; i--) out.push(leer(c, fin - i * 2 * MIN, aj).temp);
  return out;
}

export type Periodo = "1h" | "24h" | "7d" | "30d";
/** `pasoMin` es cada cuánto se lee; `cuboMin`, cada cuánto se pinta un punto. */
export const PERIODOS: Record<Periodo, { texto: string; titulo: string; horas: number; pasoMin: number; cuboMin: number }> = {
  "1h": { texto: "1 h", titulo: "Última hora", horas: 1, pasoMin: 1, cuboMin: 1 },
  "24h": { texto: "24 h", titulo: "Últimas 24 horas", horas: 24, pasoMin: 2, cuboMin: 2 },
  "7d": { texto: "7 días", titulo: "Últimos 7 días", horas: 168, pasoMin: 5, cuboMin: 30 },
  "30d": { texto: "30 días", titulo: "Últimos 30 días", horas: 720, pasoMin: 15, cuboMin: 120 },
};

/** Un punto de la gráfica. Sin datos, las temperaturas van a null y la línea se corta. */
export type Punto = { t: number; temp: number | null; min: number | null; max: number | null; consigna: number };
export type TipoMarca = "desescarche" | "puerta" | "alarma" | "sindatos";
/** Algo que pasó entre dos instantes y explica la forma de la línea. */
export type MarcaGrafica = { tipo: TipoMarca; desde: number; hasta: number };
export type Historia = { puntos: Punto[]; marcas: MarcaGrafica[]; desde: number; hasta: number };

/**
 * La temperatura de un periodo lista para pintar, con lo que pasó en él. En
 * los periodos largos cada punto resume un rato: media, mínima y máxima. Ahí
 * solo se marcan alarmas y cortes; desescarches y puertas serían una mancha.
 */
export function historia(c: Camara, hasta: number, aj: Ajustes, periodo: Periodo): Historia {
  const p = PERIODOS[periodo];
  const lecturas = serie(c, hasta, aj, p.horas, p.pasoMin);
  const porCubo = p.cuboMin / p.pasoMin;
  const puntos: Punto[] = [];
  for (let i = 0; i < lecturas.length; i += porCubo) {
    const trozo = lecturas.slice(i, i + porCubo);
    const vivas = trozo.filter((l) => l.estado !== "sindatos").map((l) => l.temp);
    const media = vivas.length ? Math.round((vivas.reduce((a, b) => a + b, 0) / vivas.length) * 10) / 10 : null;
    puntos.push({ t: trozo[0].t, temp: media, min: vivas.length ? Math.min(...vivas) : null, max: vivas.length ? Math.max(...vivas) : null, consigna: trozo[0].consigna });
  }
  const cortos = p.horas <= 24;
  const marcas: MarcaGrafica[] = [];
  const abiertas: Partial<Record<TipoMarca, MarcaGrafica>> = {};
  for (const l of lecturas) {
    const mudo = l.estado === "sindatos";
    const pasa: Record<TipoMarca, boolean> = {
      sindatos: mudo,
      alarma: l.estado === "error",
      desescarche: cortos && !mudo && l.desescarche,
      puerta: cortos && !mudo && l.puerta,
    };
    for (const tipo of Object.keys(pasa) as TipoMarca[]) {
      const abierta = abiertas[tipo];
      if (pasa[tipo]) {
        if (abierta) abierta.hasta = l.t;
        else marcas.push((abiertas[tipo] = { tipo, desde: l.t, hasta: l.t }));
      } else if (abierta) delete abiertas[tipo];
    }
  }
  return { puntos, marcas, desde: lecturas[0].t, hasta: lecturas[lecturas.length - 1].t };
}

export type ResumenPeriodo = { min: number | null; max: number | null; media: number | null; minutosFuera: number; minutosSinDatos: number; minutosConDatos: number; dentro: number | null };
/** Junta varios días del registro en un solo resumen. `dentro` es la parte del tiempo con datos en la que no se pasó el límite, de 0 a 1. */
export function resumenPeriodo(dias: DiaRegistro[]): ResumenPeriodo {
  let min: number | null = null;
  let max: number | null = null;
  let suma = 0;
  let lecturas = 0;
  let fuera = 0;
  let sinDatos = 0;
  for (const d of dias) {
    if (d.min !== null) min = min === null ? d.min : Math.min(min, d.min);
    if (d.max !== null) max = max === null ? d.max : Math.max(max, d.max);
    if (d.media !== null) suma += d.media * d.lecturas;
    lecturas += d.lecturas;
    fuera += d.minutosFuera;
    sinDatos += d.minutosSinDatos;
  }
  const conDatos = lecturas * PASO_REGISTRO;
  return { min, max, media: lecturas ? Math.round((suma / lecturas) * 10) / 10 : null, minutosFuera: fuera, minutosSinDatos: sinDatos, minutosConDatos: conDatos, dentro: conDatos ? 1 - fuera / conDatos : null };
}
