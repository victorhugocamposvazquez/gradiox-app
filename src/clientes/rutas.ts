import { NextResponse } from "next/server";
import { almacenClientes, type AlmacenClientes } from "./almacen";

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

export async function cuerpoJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json();
  } catch {
    return null;
  }
}
