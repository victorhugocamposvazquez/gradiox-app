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

/** Ejecuta una operación sobre los clientes y convierte los fallos en respuestas con su explicación. */
export async function conClientes(hacer: (a: AlmacenClientes) => Promise<unknown>) {
  try {
    const r = await hacer(almacenClientes());
    return r instanceof Response ? r : responder(r);
  } catch (e) {
    if (e instanceof ErrorClientes) return responder({ error: e.message }, e.estado);
    return responder({ error: "No se ha podido guardar. Puede que la base de datos no responda." }, 503);
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
