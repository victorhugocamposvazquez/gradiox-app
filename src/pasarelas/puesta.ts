// La puesta en marcha de una instalación, en pasos que se marcan solos con lo
// que cuenta el programa. Sirve para que quien conecta un PLC sepa en todo
// momento qué falta, dónde se hace (en el programa de la planta o en el panel)
// y por qué algo no va, sin ir probando botones.

import type { UltimaLectura } from "./almacen";
import type { Pasarela } from "./modelo";
import { situacion } from "./modelo";
import type { Orden } from "./ordenes";
import { explicarOrden } from "./explicar";

export type IdPaso = "programa" | "plc" | "lista" | "ordenes" | "prueba";
export type AccionPaso = "token" | "quitar-inexistentes" | "aceptar-propuesta" | "ordenes";

export type Paso = {
  id: IdPaso;
  titulo: string;
  detalle: string;
  hecho: boolean;
  /** Algo va mal (no solo falta): se enseña en ámbar. */
  aviso?: boolean;
  /** Dónde se hace lo que falta. */
  donde: "programa" | "aqui";
  /** El botón que lo resuelve desde el panel, si lo hay. */
  accion?: AccionPaso;
  /** Solo hace falta si se van a dar órdenes. */
  opcional?: boolean;
};

/** El texto con el que el programa marca una variable que el PLC no tiene. */
export const NO_EXISTE = "No existe en el PLC con ese nombre";
/** Más de esto sin noticias del programa y se da por callado. */
export const CALLADO_MS = 5 * 60_000;

const hace = (ms: number) => {
  const min = Math.round(ms / 60_000);
  return min < 90 ? `${min} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} días`;
};

/** Las variables de la lista que el PLC dice no tener: candidatas a quitar. */
export function inexistentes(p: Pick<Pasarela, "variables">, lecturas: UltimaLectura[]): string[] {
  const malas = new Set(lecturas.filter((l) => l.c === NO_EXISTE).map((l) => l.v));
  return p.variables.filter((v) => malas.has(v.n)).map((v) => v.n);
}

export function pasosPuesta(p: Pasarela, lecturas: UltimaLectura[], ordenes: Orden[], ahora: number): Paso[] {
  const c = p.contacto;
  const token = situacion(p, ahora);
  const callado = c ? ahora - c.t > CALLADO_MS : false;
  const pasos: Paso[] = [];

  // 1. El programa habla con Gradiox.
  if (token !== "vale") {
    pasos.push({ id: "programa", titulo: "El programa entrega a Gradiox", detalle: `El token está ${token === "anulado" ? "anulado" : "caducado"}. Saca uno nuevo y pégalo en el programa, en «Conexión».`, hecho: false, aviso: true, donde: "aqui", accion: "token" });
  } else if (!c) {
    pasos.push({ id: "programa", titulo: "Instalar el programa y poner el token", detalle: "Abre el programa en el ordenador de la planta y pega el token de esta conexión en «Conexión» > «Token de Gradiox». Si no lo tienes, saca uno nuevo aquí.", hecho: false, donde: "programa", accion: "token" });
  } else if (callado) {
    pasos.push({ id: "programa", titulo: "El programa entrega a Gradiox", detalle: `No da noticias desde hace ${hace(ahora - c.t)}: está cerrado, el ordenador apagado o sin internet. Con cable directo al PLC, el ordenador necesita además wifi o datos para llegar a Gradiox.`, hecho: false, aviso: true, donde: "programa" });
  } else {
    pasos.push({ id: "programa", titulo: "El programa entrega a Gradiox", detalle: `Versión ${c.programa}, último contacto hace menos de ${Math.max(1, Math.ceil((ahora - c.t) / 60_000))} min.`, hecho: true, donde: "programa" });
  }

  // 2. El programa llega al PLC de verdad.
  const e = c?.estado;
  if (!e || callado) {
    pasos.push({ id: "plc", titulo: "Conectar con el PLC", detalle: "En el programa, «Conexión»: elige «PLC de verdad», escribe la dirección del PLC (p. ej. 192.168.0.10) y pulsa «Guardar y conectar».", hecho: false, donde: "programa" });
  } else if (e.simulado) {
    pasos.push({ id: "plc", titulo: "Conectar con el PLC", detalle: "Está leyendo el PLC simulado: valores inventados. En el programa, «Conexión»: elige «PLC de verdad», escribe la dirección del PLC y pulsa «Guardar y conectar».", hecho: false, donde: "programa" });
  } else if (e.plc !== "conectado") {
    pasos.push({ id: "plc", titulo: "Conectar con el PLC", detalle: `No llega al PLC${e.detalle ? `: ${e.detalle}` : "."} Se reintenta solo; el programa dice qué hacer en su página.`, hecho: false, aviso: e.plc === "error", donde: "programa" });
  } else {
    pasos.push({ id: "plc", titulo: "Conectado al PLC", detalle: p.plc ? `Dirección propuesta desde aquí: ${p.plc}.` : "Conectado a la dirección escrita en el programa.", hecho: true, donde: "programa" });
  }
  const plcVivo = Boolean(e && !callado && e.plc === "conectado");

  // 3. Qué se lee.
  const fuera = inexistentes(p, lecturas);
  if (p.propuesta) {
    pasos.push({ id: "lista", titulo: "Elegir qué se lee", detalle: `El programa lee las ${p.propuesta.variables.length} variables de su propio archivo. Úsala como lista de la conexión, o elige otras en el programa con «Buscar variables».`, hecho: false, donde: "aqui", accion: "aceptar-propuesta" });
  } else if (!p.variables.length) {
    pasos.push({ id: "lista", titulo: "Elegir qué se lee", detalle: "En el programa, pulsa «Buscar variables», marca las que interesan y pulsa «Leer las marcadas». La lista llega aquí sola, no hay que copiar nada.", hecho: false, donde: "programa" });
  } else if (plcVivo && e && e.total > 0 && e.leidas === 0) {
    pasos.push({ id: "lista", titulo: "Elegir qué se lee", detalle: `Ninguna de las ${e.total} variables de la lista da valor en este PLC: suele ser una lista de otra planta o de prueba. En el programa, «Buscar variables» y marca las de este PLC; la lista de aquí se cambia sola.`, hecho: false, aviso: true, donde: "programa", ...(fuera.length ? { accion: "quitar-inexistentes" as const } : {}) });
  } else if (plcVivo && e && e.leidas < e.total) {
    pasos.push({ id: "lista", titulo: "Leyendo", detalle: `${e.leidas} de ${e.total} variables con valor.${fuera.length ? ` ${fuera.length} no existen en este PLC con ese nombre.` : ""}`, hecho: true, aviso: fuera.length > 0, donde: "aqui", ...(fuera.length ? { accion: "quitar-inexistentes" as const } : {}) });
  } else {
    pasos.push({ id: "lista", titulo: plcVivo ? "Leyendo" : "Lista de lectura", detalle: plcVivo && e ? `Las ${e.total} variables de la lista dan valor.` : `${p.variables.length} variables en la lista. Se comprobarán al conectar con el PLC.`, hecho: plcVivo, donde: "programa" });
  }

  // 4. Órdenes: dos llaves, aquí y en el programa, y qué se puede cambiar.
  const esc = p.escritura;
  const cambiables = esc?.variables.length ?? 0;
  const llavePrograma = Boolean(e?.ordenes) && !callado;
  if (!cambiables) {
    pasos.push({ id: "ordenes", titulo: "Preparar las órdenes", detalle: "Elige abajo, en «Órdenes al PLC», qué variables se pueden cambiar y entre qué límites.", hecho: false, donde: "aqui", accion: "ordenes", opcional: true });
  } else if (!esc?.activa) {
    pasos.push({ id: "ordenes", titulo: "Preparar las órdenes", detalle: `${cambiables} ${cambiables === 1 ? "variable" : "variables"} que se pueden cambiar. Falta la llave de aquí: «Activar las órdenes».${llavePrograma ? "" : " Después, la del programa."}`, hecho: false, donde: "aqui", accion: "ordenes", opcional: true });
  } else if (!llavePrograma) {
    pasos.push({ id: "ordenes", titulo: "Preparar las órdenes", detalle: "Activadas aquí. Falta la llave del programa: en «Conexión», marca «Permitir órdenes de Gradiox» y pulsa «Guardar y conectar». Sin ella, las órdenes caducan a los 2 minutos.", hecho: false, donde: "programa", opcional: true });
  } else {
    pasos.push({ id: "ordenes", titulo: "Órdenes listas", detalle: `Las dos llaves puestas: se pueden cambiar ${cambiables} ${cambiables === 1 ? "variable" : "variables"} dentro de sus límites.`, hecho: true, donde: "aqui", opcional: true });
  }

  // 5. Una orden de punta a punta.
  const hecha = ordenes.find((o) => o.estado === "hecha");
  const devuelta = (p.pruebas ?? []).find((x) => x.estado === "devuelta");
  const fallida = ordenes.find((o) => o.estado === "rechazada" || o.estado === "caducada");
  if (hecha || devuelta) {
    pasos.push({ id: "prueba", titulo: "Orden probada de punta a punta", detalle: devuelta ? "Una prueba programada se hizo y volvió sola al valor de antes." : "Una orden llegó al PLC y se leyó el valor nuevo.", hecho: true, donde: "aqui", opcional: true });
  } else {
    pasos.push({ id: "prueba", titulo: "Probar una orden", detalle: fallida ? `La última no se hizo: ${explicarOrden(fallida).que}` : "Programa abajo una prueba: pone un valor unos minutos y lo devuelve solo al de antes.", hecho: false, aviso: Boolean(fallida), donde: "aqui", accion: "ordenes", opcional: true });
  }
  return pasos;
}

/** El primer paso que falta: el que toca ahora. */
export const siguiente = (pasos: Paso[]) => pasos.find((x) => !x.hecho && !x.opcional) ?? pasos.find((x) => !x.hecho) ?? null;
