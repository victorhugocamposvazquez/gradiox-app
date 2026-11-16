import { ErrorTareas, validarCambio } from "@/tareas/github";
import { conTareas, cuerpoJson } from "@/tareas/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ numero: string }> };

const numeroDe = async (contexto: Contexto) => {
  const n = Number((await contexto.params).numero);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorTareas("Esa tarea no existe", 404);
  return n;
};

/** Las notas de una tarea. */
export const GET = (_: Request, contexto: Contexto) => conTareas(async (t) => ({ notas: await t.notas(await numeroDe(contexto)) }));

/** Añade una nota o marca la tarea como hecha o abierta. */
export async function POST(peticion: Request, contexto: Contexto) {
  const v = validarCambio(await cuerpoJson(peticion));
  return conTareas(async (t) => {
    const numero = await numeroDe(contexto);
    if ("error" in v) throw new ErrorTareas(v.error, 400);
    return "nota" in v ? { nota: await t.anotar(numero, v.nota) } : { tarea: await t.marcar(numero, v.abierta) };
  });
}
