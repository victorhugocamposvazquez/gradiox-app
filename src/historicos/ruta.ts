import { NextResponse } from "next/server";
import { almacenPasarelas } from "../pasarelas/almacen";
import { ErrorConsulta, instalaciones, resumen, serie } from "./consulta";

/**
 * Responde a la pantalla de históricos. Sin parámetros: las instalaciones y sus
 * variables. Con `id`, `desde` y `hasta`: el resumen del periodo y del anterior.
 * Añadiendo `variable`: su serie para la gráfica. Quién puede preguntar lo
 * decide la ruta que lo usa (la app del cliente o el panel interno).
 */
export async function atenderHistoricos(peticion: Request) {
  const q = new URL(peticion.url).searchParams;
  const cabeceras = { "Cache-Control": "no-store" };
  try {
    const a = almacenPasarelas();
    const id = q.get("id");
    const variable = q.get("variable");
    const cuerpo =
      id === null
        ? { guardado: a.tipo, ahora: Date.now(), instalaciones: await instalaciones(a) }
        : variable === null
          ? await resumen(a, id, q.get("desde"), q.get("hasta"), Date.now())
          : await serie(a, id, variable, q.get("desde"), q.get("hasta"), Date.now());
    return NextResponse.json(cuerpo, { headers: cabeceras });
  } catch (e) {
    if (e instanceof ErrorConsulta) return NextResponse.json({ error: e.message }, { status: e.estado, headers: cabeceras });
    return NextResponse.json({ error: "No se han podido consultar los históricos" }, { status: 503, headers: cabeceras });
  }
}
