import { ErrorTareas, validarTarea } from "@/tareas/github";
import { conTareas, cuerpoJson } from "@/tareas/rutas";

// Tareas de Gradiox. Solo con sesión iniciada.
export const dynamic = "force-dynamic";

export const GET = () => conTareas(async (t) => ({ activadas: true, tareas: await t.listar() }));

export async function POST(peticion: Request) {
  const v = validarTarea(await cuerpoJson(peticion));
  return conTareas(async (t) => {
    if ("error" in v) throw new ErrorTareas(v.error, 400);
    return { tarea: await t.crear(v.titulo, v.detalle) };
  });
}
