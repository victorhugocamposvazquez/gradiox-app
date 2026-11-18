import { NextResponse } from "next/server";
import { ErrorClientes, motivoBase, responder } from "../clientes/rutas";
import { almacenPasarelas, type AlmacenPasarelas } from "./almacen";
import type { Respuesta } from "./entrada";

const CABECERAS = { "Cache-Control": "no-store" };

/** Atiende a un programa de pasarela y convierte el resultado en respuesta. */
export async function atender(hacer: (a: AlmacenPasarelas) => Promise<Respuesta>): Promise<Response> {
  try {
    const r = await hacer(almacenPasarelas());
    if (r.bytes) return new Response(r.bytes as BodyInit, { status: r.estado, headers: { ...CABECERAS, "Content-Type": "application/octet-stream" } });
    if (r.estado === 304) return new Response(null, { status: 304, headers: CABECERAS });
    return NextResponse.json(r.cuerpo ?? {}, { status: r.estado, headers: CABECERAS });
  } catch {
    return NextResponse.json({ error: "El servidor no ha podido atender. Se reintentará" }, { status: 503, headers: CABECERAS });
  }
}

/** Ejecuta una operación del panel sobre las pasarelas y convierte los fallos en respuestas con su explicación. */
export async function conPasarelas(hacer: (a: AlmacenPasarelas) => Promise<unknown>) {
  try {
    return responder(await hacer(almacenPasarelas()));
  } catch (e) {
    if (e instanceof ErrorClientes) return responder({ error: e.message }, e.estado);
    return responder({ error: `No se ha podido usar la base de datos: ${motivoBase(e)}` }, 503);
  }
}
