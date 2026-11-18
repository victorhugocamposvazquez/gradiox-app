// Lo que hace el servidor cuando le habla un programa de pasarela. Está aparte
// de las rutas para poder probarlo sin levantar el servidor.

import { open, readFile } from "node:fs/promises";
import path from "node:path";
import type { AlmacenPasarelas } from "./almacen";
import { PROTOCOLO_MAXIMO, PROTOCOLO_MINIMO, esToken, huellaToken, situacion, validarEstado, validarLecturas, type Pasarela } from "./modelo";

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
  return { estado: 200, cuerpo: { nombre: p.nombre, plc: p.plc, cadaSegundos: p.cadaSegundos, perfil: p.perfil, variables: p.variables, caduca: p.caduca, revision: p.revision } };
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
  // Solo se guardan las variables que están en la lista de esta instalación.
  const mias = new Set(p.variables.map((v) => v.n));
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
  return { estado: 200, cuerpo: { recibidas: lote.length, revision: p.revision } };
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
