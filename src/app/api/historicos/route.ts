import { NextResponse } from "next/server";
import { ErrorConsulta, instalaciones, resumen, serie } from "@/historicos/consulta";
import { almacenPasarelas } from "@/pasarelas/almacen";

// Históricos de lo leído y lo ejecutado en las instalaciones conectadas. Solo con sesión iniciada.
// Sin parámetros: las instalaciones y sus variables. Con `id`, `desde` y `hasta`: el resumen del
// periodo y del anterior. Añadiendo `variable`: su serie para la gráfica.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(peticion: Request) {
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
          : await serie(a, id, variable, q.get("desde"), q.get("hasta"));
    return NextResponse.json(cuerpo, { headers: cabeceras });
  } catch (e) {
    if (e instanceof ErrorConsulta) return NextResponse.json({ error: e.message }, { status: e.estado, headers: cabeceras });
    return NextResponse.json({ error: "No se han podido consultar los históricos" }, { status: 503, headers: cabeceras });
  }
}
