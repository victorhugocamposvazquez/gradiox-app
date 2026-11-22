// Lo que hace el servidor cuando le habla un programa de pasarela. Está aparte
// de las rutas para poder probarlo sin levantar el servidor.

import { open, readFile } from "node:fs/promises";
import path from "node:path";
import type { AlmacenPasarelas } from "./almacen";
import { vigilar } from "../actua/servicio";
import { resultado } from "./ordenes";
import { avanzarPruebas } from "./pruebas";
import { PROTOCOLO_MAXIMO, PROTOCOLO_MINIMO, esToken, huellaToken, limpiarVariables, mismaLista, situacion, validarEstado, validarLecturas, type Pasarela } from "./modelo";

export type Respuesta = { estado: number; cuerpo?: unknown; bytes?: Uint8Array };
const error = (estado: number, mensaje: string): Respuesta => ({ estado, cuerpo: { error: mensaje } });

/**
 * Identifica a la instalación por su token. Devuelve la pasarela o la respuesta
 * de rechazo. Un token anulado o caducado deja de valer en el acto.
 */
export async function identificar(peticion: Request, almacen: AlmacenPasarelas, ahora: number): Promise<Pasarela | Respuesta> {
  const cabeceraProtocolo = peticion.headers.get("x-gradiox-protocolo") ?? "";
  if (!/^\d{1,6}$/.test(cabeceraProtocolo)) return error(400, "Falta la versión del protocolo");
  const protocolo = Number(cabeceraProtocolo);
  // 426: el programa es demasiado viejo para este servidor y tiene que actualizarse.
  if (protocolo < PROTOCOLO_MINIMO) return error(426, "Este programa es demasiado antiguo. Se actualizará solo; si no, pida la versión nueva a Gradiox");
  if (protocolo > PROTOCOLO_MAXIMO) return error(400, "Este servidor todavía no entiende a un programa tan nuevo");
  const cabecera = peticion.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
  if (!esToken(token)) return error(401, "El token no es válido");
  const p = await almacen.porHuella(huellaToken(token));
  if (!p) return error(401, "El token no es válido");
  const s = situacion(p, ahora);
  if (s === "anulado") return error(403, "Este token está anulado. Pida uno nuevo a Gradiox");
  if (s === "caducado") return error(403, "Este token ha caducado. Pida uno nuevo a Gradiox");
  return p;
}
const esRechazo = (v: Pasarela | Respuesta): v is Respuesta => "estado" in v && typeof (v as Respuesta).estado === "number" && !("id" in v);

/** La configuración de esta instalación. Con la misma revisión que ya tiene el programa, no se repite. */
export async function darConfiguracion(peticion: Request, almacen: AlmacenPasarelas, ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  if (new URL(peticion.url).searchParams.get("revision") === p.revision) return { estado: 304 };
  return { estado: 200, cuerpo: { nombre: p.nombre, plc: p.plc, cadaSegundos: p.cadaSegundos, perfil: p.perfil, variables: p.variables, caduca: p.caduca, revision: p.revision, propuesta: Boolean(p.propuesta), escritura: { activa: Boolean(p.escritura?.activa), variables: p.escritura?.variables ?? [] } } };
}

/** Recibe un lote de lecturas y el estado del programa. */
export async function recibirLecturas(peticion: Request, almacen: AlmacenPasarelas, ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return error(400, "El cuerpo no es JSON");
  }
  const b = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  const r = validarLecturas(b.lecturas ?? []);
  if ("error" in r) return error(400, r.error);
  // Solo se guardan las variables que están en la lista de esta instalación o en la que el programa ha propuesto.
  const mias = new Set([...p.variables, ...(p.propuesta?.variables ?? [])].map((v) => v.n));
  const lote = r.lecturas.filter((l) => mias.has(l.v));
  try {
    await almacen.anotar(p.id, lote, b.simulado === true);
    await almacen.contactar(p.id, {
      t: ahora,
      programa: (peticion.headers.get("x-gradiox-programa") ?? "").slice(0, 20),
      plataforma: (peticion.headers.get("x-gradiox-plataforma") ?? "").slice(0, 30),
      estado: validarEstado(b.estado),
    });
  } catch {
    // El programa conserva el lote y lo vuelve a entregar: no se pierde nada.
    return error(503, "No se ha podido guardar. El programa lo reintentará");
  }
  // Si una cámara con actuación en marcha ha llegado a su límite, sus consignas vuelven solas.
  await vigilar(almacen, p, lote, ahora);
  return { estado: 200, cuerpo: { recibidas: lote.length, revision: p.revision } };
}

/**
 * El programa cuenta qué lista está leyendo cuando no es la del panel: la que
 * se ha elegido en la planta o la de su archivo. Queda como propuesta; la lista
 * de la instalación no cambia hasta que alguien la acepta en el panel.
 */
export async function recibirPropuesta(peticion: Request, almacen: AlmacenPasarelas, ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return error(400, "El cuerpo no es JSON");
  }
  const b = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  const variables = limpiarVariables(b.variables);
  if (!variables.length) return error(400, "La propuesta no trae variables");
  const { id, creada: _, actualizada: __, contacto: ___, ...datos } = p;
  // Si es la misma lista que ya tiene la instalación, no hay nada que proponer.
  const propuesta = mismaLista(variables, p.variables) ? undefined : { t: ahora, origen: b.origen === "elegidas" ? ("elegidas" as const) : ("archivo" as const), variables };
  try {
    await almacen.guardar(id, { ...datos, propuesta });
  } catch {
    return error(503, "No se ha podido guardar. El programa lo reintentará");
  }
  return { estado: 200, cuerpo: { recibidas: variables.length, pendiente: Boolean(propuesta) } };
}

/**
 * Órdenes para el programa. GET: las pendientes de esta instalación, que pasan
 * a «enviada». POST: el programa cuenta cómo ha ido cada una. Sin la escritura
 * activada en el panel no se da ninguna.
 */
export async function darOrdenes(peticion: Request, almacen: AlmacenPasarelas, ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  const e = p.escritura;
  if (!e?.activa) return { estado: 200, cuerpo: { activa: false, ordenes: [] } };
  await almacen.caducarOrdenes(p.id, ahora);
  // Las pruebas programadas piden aquí su ida o su vuelta cuando les toca.
  const pruebas = await avanzarPruebas(almacen, p, ahora);
  if (pruebas) {
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    await almacen.guardar(p.id, { ...datos, pruebas });
  }
  const limites = new Map(e.variables.map((v) => [v.n, v]));
  const dar = [];
  for (const o of await almacen.ordenesAbiertas(p.id)) {
    if (o.estado !== "pendiente") continue;
    // Solo se entrega la que de verdad pasa de pendiente a enviada: nunca dos veces.
    const enviada = await almacen.cambiarOrden(p.id, o.id, { estado: "enviada", cambio: ahora }, ["pendiente"]);
    if (enviada) dar.push({ id: o.id, n: o.n, valor: o.valor, pedida: o.pedida, limites: limites.get(o.n) });
  }
  return { estado: 200, cuerpo: { activa: true, ordenes: dar } };
}

export async function recibirResultados(peticion: Request, almacen: AlmacenPasarelas, ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return error(400, "El cuerpo no es JSON");
  }
  const lista = (cuerpo as { resultados?: unknown })?.resultados;
  if (!Array.isArray(lista) || lista.length > 100) return error(400, "Falta la lista de resultados");
  let anotados = 0;
  for (const r of lista) {
    if (typeof r !== "object" || r === null || typeof (r as { id?: unknown }).id !== "string") continue;
    const c = resultado(r as Record<string, unknown>, ahora);
    // Solo cambia una orden que el programa tenía en sus manos: una terminada se queda como está.
    if (c && (await almacen.cambiarOrden(p.id, (r as { id: string }).id, c, ["enviada"]))) anotados++;
  }
  return { estado: 200, cuerpo: { anotados } };
}

// --- El programa publicado, para que se actualice solo ---

export type Publicado = { version: string; tamano: number; sha256: string; firma: string; archivo: string; comprimido: number };
export const PARTE = 3 * 1024 * 1024;
export const carpetaPublicado = () => path.join(/*turbopackIgnore: true*/ process.cwd(), "pasarela-opcua", "publicado");

export async function leerPublicado(carpeta: string): Promise<Record<string, Publicado>> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ path.join(carpeta, "publicado.json"), "utf8")) as Record<string, Publicado>;
  } catch {
    return {};
  }
}

/**
 * Sin «parte»: anuncia la última versión para la plataforma del programa.
 * Con «version» y «parte»: entrega ese trozo del archivo. El programa comprueba
 * la firma por su cuenta; aquí solo se sirve a quien tiene un token en vigor.
 */
export async function darPrograma(peticion: Request, almacen: AlmacenPasarelas, carpeta = carpetaPublicado(), ahora = Date.now()): Promise<Respuesta> {
  const p = await identificar(peticion, almacen, ahora);
  if (esRechazo(p)) return p;
  const q = new URL(peticion.url).searchParams;
  const pub = (await leerPublicado(carpeta))[q.get("plataforma") ?? ""];
  if (!pub) return error(404, "No hay programa publicado para esta plataforma");
  const partes = Math.max(1, Math.ceil(pub.comprimido / PARTE));
  if (q.get("parte") === null) return { estado: 200, cuerpo: { version: pub.version, tamano: pub.tamano, sha256: pub.sha256, firma: pub.firma, partes } };
  const parte = Number(q.get("parte"));
  if (q.get("version") !== pub.version || !Number.isInteger(parte) || parte < 0 || parte >= partes) return error(404, "Esa parte no existe");
  // El nombre del archivo sale de la lista publicada, nunca de la petición.
  if (!/^[A-Za-z0-9._-]+$/.test(pub.archivo)) return error(500, "La publicación no es válida");
  try {
    // Los archivos publicados viajan con la ruta por la lista de next.config.ts, no por lo que deduzca el empaquetador.
    const f = await open(/*turbopackIgnore: true*/ path.join(carpeta, pub.archivo), "r");
    try {
      const largo = Math.min(PARTE, pub.comprimido - parte * PARTE);
      const bytes = new Uint8Array(largo);
      const { bytesRead } = await f.read(bytes, 0, largo, parte * PARTE);
      if (bytesRead !== largo) return error(500, "La publicación está incompleta");
      return { estado: 200, bytes };
    } finally {
      await f.close();
    }
  } catch {
    return error(500, "La publicación está incompleta");
  }
}
