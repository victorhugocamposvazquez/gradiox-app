import { NextResponse } from "next/server";
import { almacen } from "../conexion/servidor";
import { almacenClientes, type AlmacenClientes } from "./almacen";
import type { Lecturas } from "./modelo";

const CABECERAS = { "Cache-Control": "no-store" };
export const responder = (cuerpo: unknown, estado = 200) => NextResponse.json(cuerpo, { status: estado, headers: CABECERAS });

export class ErrorClientes extends Error {
  constructor(mensaje: string, readonly estado = 400) {
    super(mensaje);
  }
}

/** Explica en claro por qué ha fallado la base de datos, sin enseñar la dirección ni la contraseña. */
export function motivoBase(e: unknown): string {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  const texto = `${code ?? ""} ${message ?? ""}`;
  if (code === "28P01" || /password authentication failed/i.test(texto)) return "la contraseña de la dirección no es correcta.";
  if (/ENOTFOUND|EAI_AGAIN/.test(texto)) return "el servidor de la dirección no existe. Revisa que esté copiada entera.";
  if (/Tenant or user not found/i.test(texto)) return "el usuario o el proyecto de la dirección no existen. Copia otra vez la dirección de «Transaction pooler».";
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(texto)) return "el servidor no contesta. Revisa el puerto (6543) y que el proyecto de Supabase esté en marcha.";
  if (/certificate|self.signed|SSL|TLS/i.test(texto)) return "falla el cifrado de la conexión.";
  if (/Invalid URL|invalid connection|ERR_INVALID_URL/i.test(texto)) return "la dirección no es válida. Puede que la contraseña tenga símbolos como @, # o /.";
  if (code === "42501" || /permission denied/i.test(texto)) return "el usuario de la dirección no tiene permiso para crear las tablas.";
  return `fallo sin identificar${code ? ` (código ${code})` : ""}.`;
}

/** Ejecuta una operación sobre los clientes y convierte los fallos en respuestas con su explicación. */
export async function conClientes(hacer: (a: AlmacenClientes) => Promise<unknown>) {
  try {
    const r = await hacer(almacenClientes());
    return r instanceof Response ? r : responder(r);
  } catch (e) {
    if (e instanceof ErrorClientes) return responder({ error: e.message }, e.estado);
    return responder({ error: `No se ha podido usar la base de datos: ${motivoBase(e)}` }, 503);
  }
}

/** Lo último que ha entregado cada aparato. Si el almacén de lecturas falla, el panel sigue funcionando sin ese dato. */
export async function lecturasActuales(): Promise<Lecturas> {
  try {
    return Object.fromEntries((await almacen().pasarelas()).map((p) => [p.id, { ultima: p.ultima, equipos: p.equipos }]));
  } catch {
    return {};
  }
}

export async function cuerpoJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json();
  } catch {
    return null;
  }
}
