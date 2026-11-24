// Las pasarelas de prueba: el programa que se instala en un ordenador de la
// planta, lee el PLC por OPC UA y entrega aquí lo que lee. Cada instalación
// tiene su token, que solo sirve para entregar lecturas y pedir su propia
// configuración; se puede anular y caduca solo.

import { createHash, randomBytes, randomInt } from "node:crypto";
import type { FichaCamara } from "../actua/camaras";
import type { Tarifa } from "../actua/optimiza";
import type { Escritura } from "./ordenes";
import type { Prueba } from "./pruebas";

/** Versiones del idioma entre programa y servidor que este servidor entiende. */
export const PROTOCOLO_MINIMO = 1;
export const PROTOCOLO_MAXIMO = 1;

export type VariableOpc = {
  /** Nombre en el PLC, p. ej. «Datos_C6_1_REAL.TT9». */
  n: string;
  /** Grupo con el que se enseña: cámara, compresor… */
  g?: string;
  tipo?: string;
  /** Qué es, en claro. */
  d?: string;
  u?: string;
  /** Identificador exacto en el servidor OPC UA, si no se deduce del nombre. */
  nodo?: string;
};

export type DatosPasarela = {
  nombre: string;
  nota: string;
  /** Dirección del PLC que se propone al programa; lo escrito en el propio ordenador manda. */
  plc: string;
  cadaSegundos: number;
  /** Nombre del perfil de variables, para saber cuál lleva. */
  perfil: string;
  variables: VariableOpc[];
  /** Cambia cada vez que cambia algo de lo anterior: así el programa sabe que tiene que volver a pedirlo. */
  revision: string;
  /** Últimos caracteres del token, para reconocerlo. El token entero no se guarda. */
  pista: string;
  caduca: number;
  anulada: boolean;
  /**
   * Lista que el programa está leyendo de su propio archivo y propone para
   * esta instalación. Se guarda lo que entrega de ella, pero no pasa a ser la
   * lista de la instalación hasta que se acepta en el panel. (La elegida en la
   * planta con «Buscar variables» pasa a ser la lista directamente.)
   */
  propuesta?: Propuesta;
  /**
   * La lista de lectura que había antes del último cambio hecho sin pasar por
   * el panel (elegida en la planta o limpiada de variables que no existen),
   * para poder volver a ella.
   */
  anterior?: ListaAnterior;
  /** Órdenes al PLC: apagadas mientras no se activen aquí y en el programa. */
  escritura?: Escritura;
  /** Lo que hace falta para actuar y ahorrar: la tarifa del cliente y la ficha de cada cámara, por su clave en el autómata. */
  actua?: { tarifa?: Tarifa; camaras?: Record<string, FichaCamara> };
  /** Pruebas programadas de órdenes: un valor a una hora y vuelta sola al de antes. */
  pruebas?: Prueba[];
  /** Ficha del cliente al que pertenece. Sus usuarios de la app la ven; los de otros clientes, no. */
  cliente?: string;
  /** Ubicación dentro del cliente: el id de una instalación de su ficha (la nave, el almacén). */
  ubicacion?: string;
  /** Código de conexión de un solo uso para vincular una pasarela sin copiar el token. Solo se guarda su huella. */
  codigo?: CodigoConexion;
};
export type CodigoConexion = { huella: string; caduca: number; fallos: number };
export type ListaAnterior = { t: number; perfil: string; variables: VariableOpc[]; motivo: string };
export type Propuesta = { t: number; origen: "elegidas" | "archivo"; variables: VariableOpc[] };

export type EstadoPrograma = { plc: string; detalle: string; leidas: number; total: number; ultima: number; simulado: boolean; pendientes: number; ordenes: boolean };
export type Contacto = { t: number; programa: string; plataforma: string; estado: EstadoPrograma };

export type Pasarela = DatosPasarela & { id: string; creada: number; actualizada: number; contacto: Contacto | null };

export type LecturaOpc = { v: string; t: number; x: boolean | number | string | null; c?: string };

export const MAX_VARIABLES = 5000;
export const MAX_LECTURAS_ENVIO = 5000;
export const DIAS_POR_DEFECTO = 30;
export const DIAS_MAXIMO = 366;

const PREFIJO = "gxp_";
export const nuevoToken = () => PREFIJO + randomBytes(32).toString("base64url");
export const esToken = (v: string) => /^gxp_[A-Za-z0-9_-]{43}$/.test(v);
/** Lo que se guarda del token: su huella. Con la huella no se puede reconstruir el token. */
export const huellaToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const pistaToken = (token: string) => token.slice(-4);

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function limpiarVariables(v: unknown): VariableOpc[] {
  if (!Array.isArray(v)) return [];
  const vistas = new Set<string>();
  const out: VariableOpc[] = [];
  for (const bruta of v) {
    if (typeof bruta !== "object" || bruta === null) continue;
    const b = bruta as Record<string, unknown>;
    const n = texto(b.n, 200);
    if (!n || vistas.has(n) || /[\n\r;]/.test(n)) continue;
    vistas.add(n);
    const una: VariableOpc = { n };
    for (const k of ["g", "tipo", "d", "u", "nodo"] as const) {
      const t = texto(b[k], k === "d" ? 300 : 200);
      if (t) una[k] = t;
    }
    out.push(una);
    if (out.length >= MAX_VARIABLES) break;
  }
  return out;
}

/**
 * Lee una lista de variables pegada desde una hoja de cálculo o un CSV. La
 * primera línea dice qué es cada columna (grupo, variable, tipo, descripción o
 * «qué…», unidad, nodo); sin cabecera, se toma una variable por línea.
 */
export function variablesDeTexto(pegado: string): VariableOpc[] {
  const lineas = pegado.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];
  const sep = lineas[0].includes("\t") ? "\t" : lineas[0].includes(";") ? ";" : ",";
  const partir = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const cabecera = partir(lineas[0]).map((c) => c.toLowerCase());
  const col: Partial<Record<keyof VariableOpc, number>> = {};
  cabecera.forEach((c, i) => {
    if (c.startsWith("grupo")) col.g ??= i;
    else if (c.startsWith("variable") || c === "nombre") col.n ??= i;
    else if (c.startsWith("tipo")) col.tipo ??= i;
    else if (c.startsWith("desc") || c.startsWith("qué") || c.startsWith("que")) col.d ??= i;
    else if (c.startsWith("unidad")) col.u ??= i;
    else if (c.startsWith("nodo")) col.nodo ??= i;
  });
  if (col.n === undefined) return limpiarVariables(lineas.map((l) => ({ n: partir(l)[0] })));
  return limpiarVariables(
    lineas.slice(1).map((l) => {
      const c = partir(l);
      const de = (k: keyof VariableOpc) => (col[k] === undefined ? "" : (c[col[k]] ?? ""));
      return { n: de("n"), g: de("g"), tipo: de("tipo"), d: de("d"), u: de("u"), nodo: de("nodo") };
    }),
  );
}

/** El código de conexión vale 30 minutos y una sola vez. */
export const CODIGO_MS = 30 * 60_000;
/**
 * Fallos de vinculación que aguanta un código antes de anularse. Cada código
 * equivocado cuenta contra todos los vigentes: así probar códigos al azar los
 * anula mucho antes de acertar (10 intentos entre un millón).
 */
export const CODIGO_FALLOS = 10;
export const nuevoCodigo = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const esCodigo = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v);
export const huellaCodigo = (codigo: string) => createHash("sha256").update("gradiox-codigo:" + codigo).digest("hex");
export const codigoVigente = (c: CodigoConexion | undefined, ahora: number): c is CodigoConexion => Boolean(c && c.caduca > ahora && c.fallos < CODIGO_FALLOS);

export const nuevaRevision = () => randomBytes(6).toString("hex");

export function dias(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DIAS_POR_DEFECTO;
  return Math.min(DIAS_MAXIMO, Math.max(1, n));
}

/** Lo que se puede cambiar desde el panel. Devuelve los datos nuevos o el motivo por el que no valen. */
export function aplicarCambios(antes: DatosPasarela, v: unknown, ahora = Date.now()): DatosPasarela | { error: string } {
  if (typeof v !== "object" || v === null) return { error: "Faltan los datos" };
  const b = v as Record<string, unknown>;
  const d: DatosPasarela = { ...antes };
  if (b.nombre !== undefined) {
    d.nombre = texto(b.nombre, 80);
    if (!d.nombre) return { error: "Falta el nombre de la conexión" };
  }
  if (b.nota !== undefined) d.nota = texto(b.nota, 500);
  if (b.plc !== undefined) {
    d.plc = texto(b.plc, 200);
    if (d.plc && !/^(opc\.tcp:\/\/)?[A-Za-z0-9.\-_[\]:]+(\/[^\s]*)?$/.test(d.plc)) return { error: "La dirección del PLC no parece una dirección. Ejemplo: 50.50.0.1" };
  }
  if (b.cadaSegundos !== undefined) {
    const n = Number(b.cadaSegundos);
    if (!Number.isFinite(n) || n < 0 || n > 3600) return { error: "El ritmo de lectura va de 2 a 3600 segundos" };
    d.cadaSegundos = n === 0 ? 0 : Math.max(2, Math.round(n));
  }
  if (b.perfil !== undefined) d.perfil = texto(b.perfil, 80);
  if (typeof b.variablesTexto === "string") {
    d.variables = variablesDeTexto(b.variablesTexto);
    if (b.variablesTexto.trim() && !d.variables.length) return { error: "No se ha reconocido ninguna variable en lo pegado" };
    if (antes.variables.length && !mismaLista(d.variables, antes.variables)) d.anterior = { t: ahora, perfil: antes.perfil, variables: antes.variables, motivo: "Pegada una lista nueva en el panel" };
  }
  d.revision = nuevaRevision();
  return d;
}

export const pasarelaVacia = (nombre: string, token: string, ahora: number, validez: number): DatosPasarela => ({
  nombre: texto(nombre, 80),
  nota: "",
  plc: "",
  cadaSegundos: 0,
  perfil: "",
  variables: [],
  revision: nuevaRevision(),
  pista: pistaToken(token),
  caduca: ahora + validez * 86_400_000,
  anulada: false,
});

export type SituacionToken = "vale" | "anulado" | "caducado";
export const situacion = (p: Pick<DatosPasarela, "anulada" | "caduca">, ahora: number): SituacionToken => (p.anulada ? "anulado" : ahora >= p.caduca ? "caducado" : "vale");

/** Limpia un lote de lecturas. Devuelve el lote o el motivo por el que no vale. */
export function validarLecturas(v: unknown): { lecturas: LecturaOpc[] } | { error: string } {
  if (!Array.isArray(v)) return { error: "Falta la lista de lecturas" };
  if (v.length > MAX_LECTURAS_ENVIO) return { error: `Demasiadas lecturas en un envío (máximo ${MAX_LECTURAS_ENVIO})` };
  const out: LecturaOpc[] = [];
  for (const [i, bruta] of v.entries()) {
    if (typeof bruta !== "object" || bruta === null) return { error: `La lectura ${i} no es un objeto` };
    const b = bruta as Record<string, unknown>;
    if (typeof b.v !== "string" || !b.v || b.v.length > 200) return { error: `La lectura ${i} no dice de qué variable es` };
    if (typeof b.t !== "number" || !Number.isFinite(b.t) || b.t <= 0) return { error: `La lectura ${i} no tiene instante` };
    let x: LecturaOpc["x"] = null;
    if (typeof b.x === "boolean") x = b.x;
    else if (typeof b.x === "number" && Number.isFinite(b.x)) x = b.x;
    else if (typeof b.x === "string") x = b.x.slice(0, 200);
    else if (b.x !== null && b.x !== undefined) return { error: `La lectura ${i} trae un valor que no se entiende` };
    const c = typeof b.c === "string" && b.c ? b.c.slice(0, 200) : undefined;
    out.push({ v: b.v, t: Math.round(b.t), x, ...(c ? { c } : {}) });
  }
  return { lecturas: out };
}

export function validarEstado(v: unknown): EstadoPrograma {
  const b = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
  return { plc: texto(b.plc, 20), detalle: texto(b.detalle, 300), leidas: num(b.leidas), total: num(b.total), ultima: num(b.ultima), simulado: b.simulado === true, pendientes: num(b.pendientes), ordenes: b.ordenes === true };
}

/** Lo que el panel enseña de una pasarela en la lista: sin variables, que pueden ser miles. */
export type ResumenPasarela = Omit<Pasarela, "variables" | "propuesta" | "escritura" | "actua" | "anterior" | "codigo"> & { variables: number; propuesta: number; ordenes: boolean; token: SituacionToken };
export const resumir = ({ escritura, actua: _, anterior: __, codigo: ___, ...p }: Pasarela, ahora: number): ResumenPasarela => ({ ...p, variables: p.variables.length, propuesta: p.propuesta?.variables.length ?? 0, ordenes: Boolean(escritura?.activa), token: situacion(p, ahora) });

/**
 * Cambia la lista de lectura guardando la de antes, para poder volver a ella.
 * La lista nueva rige en el programa en cuanto pide la configuración.
 */
export function cambiarLista(d: DatosPasarela, variables: VariableOpc[], perfil: string, motivo: string, ahora: number): DatosPasarela {
  return { ...d, propuesta: undefined, anterior: { t: ahora, perfil: d.perfil, variables: d.variables, motivo }, variables, perfil, revision: nuevaRevision() };
}

/** Dice si dos listas piden lo mismo al PLC. */
export const mismaLista = (a: VariableOpc[], b: VariableOpc[]) => a.length === b.length && a.every((v, i) => v.n === b[i].n && (v.nodo ?? "") === (b[i].nodo ?? ""));
