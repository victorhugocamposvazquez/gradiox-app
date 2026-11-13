// Cuentas que salen de las lecturas: cuánto falta para el límite, registro por
// días, consumo y marcha del compresor. Todo se calcula sobre la simulación.

import { preciosDelDia } from "./luz";
import { leer, type Ajustes, type Camara } from "./sim";

const MIN = 60_000;

/**
 * Minutos que faltan para tocar el límite del género si la temperatura sigue
 * subiendo como en el último cuarto de hora. Solo se calcula con una alarma o
 * con la puerta abierta diez minutos o más: una puerta que se abre un momento
 * no es una tendencia. Devuelve null si no sube o si ya ha pasado el límite.
 */
export function minutosAlLimite(c: Camara, t: number, aj: Ajustes): number | null {
  const ahora = leer(c, t, aj);
  if (ahora.temp >= c.limite) return null;
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

export type DiaRegistro = { fecha: string; min: number; max: number; media: number; minutosFuera: number; lecturas: number };

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
    for (let t = inicio; t < fin; t += PASO_REGISTRO * MIN) {
      const l = leer(c, t, aj);
      min = Math.min(min, l.temp);
      max = Math.max(max, l.temp);
      suma += l.temp;
      n++;
      if (l.temp >= c.limite) fuera += PASO_REGISTRO;
    }
    if (n) out.push({ fecha: fechaLocal(new Date(inicio)), min, max, media: Math.round((suma / n) * 10) / 10, minutosFuera: fuera, lecturas: n });
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
    filas.push([c.nombre, fechaLocal(d), hhmm, n(l.temp), n(l.consigna), n(c.limite), l.puerta ? "Abierta" : "Cerrada", l.compresor ? "En marcha" : "Parado"].join(";"));
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
    if (!leer(c, t, aj).compresor) continue;
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
