// Entrada de lecturas: lo que hace el servidor cuando una pasarela le entrega
// un lote. Está aparte de la ruta para poder probarlo sin levantar el servidor.

import { timingSafeEqual } from "node:crypto";
import { validarLote, type Almacen } from "./almacen";

const igual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type Respuesta = { estado: number; cuerpo: { recibidas: number } | { error: string } };

/**
 * `clave` es la que tiene configurada el servidor. Sin clave configurada la
 * entrada está cerrada: nunca se aceptan lecturas sin identificar a la pasarela.
 */
export async function recibirLote(peticion: Request, clave: string | undefined, almacen: Almacen): Promise<Respuesta> {
  if (!clave) return { estado: 503, cuerpo: { error: "La entrada de lecturas no está activada en este servidor" } };
  const cabecera = peticion.headers.get("authorization") ?? "";
  if (!cabecera.startsWith("Bearer ") || !igual(cabecera.slice(7), clave)) return { estado: 401, cuerpo: { error: "Clave de pasarela no válida" } };
  const pasarela = peticion.headers.get("x-gradiox-pasarela") ?? "";
  if (!/^[a-z0-9-]{1,60}$/.test(pasarela)) return { estado: 400, cuerpo: { error: "Falta el identificador de la pasarela" } };
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return { estado: 400, cuerpo: { error: "El cuerpo no es JSON" } };
  }
  const r = validarLote(cuerpo);
  if ("error" in r) return { estado: 400, cuerpo: { error: r.error } };
  try {
    await almacen.guardar(pasarela, r.lote);
  } catch {
    // La pasarela conserva el lote y lo vuelve a entregar: no se pierde nada.
    return { estado: 503, cuerpo: { error: "No se ha podido guardar. La pasarela lo reintentará" } };
  }
  return { estado: 200, cuerpo: { recibidas: r.lote.length } };
}
