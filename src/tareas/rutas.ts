import { NextResponse } from "next/server";
import { ErrorTareas, configuracion, tareasGitHub } from "./github";

const CABECERAS = { "Cache-Control": "no-store" };
export const responder = (cuerpo: unknown, estado = 200) => NextResponse.json(cuerpo, { status: estado, headers: CABECERAS });

/** Ejecuta una operación de tareas y convierte los fallos en respuestas con su explicación. */
export async function conTareas(hacer: (t: ReturnType<typeof tareasGitHub>) => Promise<unknown>) {
  const c = configuracion();
  if (!c) return responder({ activadas: false, error: "Las tareas no están activadas en este servidor" }, 503);
  try {
    return responder(await hacer(tareasGitHub(c)));
  } catch (e) {
    if (e instanceof ErrorTareas) return responder({ error: e.message }, e.estado);
    return responder({ error: "No se ha podido completar" }, 500);
  }
}

export async function cuerpoJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json();
  } catch {
    return null;
  }
}
