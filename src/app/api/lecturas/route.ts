import { NextResponse } from "next/server";
import { resumenLecturas } from "@/conexion/resumen";
import { almacen } from "@/conexion/servidor";

// Lecturas reales recibidas de las pasarelas. Solo con sesión iniciada.
// Sin parámetros: todas las pasarelas con sus equipos. Con `pasarela`: sus últimas medidas.
export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const pasarela = new URL(peticion.url).searchParams.get("pasarela");
  const cabeceras = { "Cache-Control": "no-store" };
  try {
    if (pasarela === null) return NextResponse.json(await resumenLecturas(almacen(), Boolean(process.env.GRADIOX_PASARELA_CLAVE)), { headers: cabeceras });
    if (!/^[a-z0-9-]{1,60}$/.test(pasarela)) return NextResponse.json({ error: "El identificador de la pasarela no es válido" }, { status: 400 });
    return NextResponse.json({ medidas: await almacen().ultimas(pasarela) }, { headers: cabeceras });
  } catch {
    return NextResponse.json({ error: "No se ha podido leer el almacén de lecturas" }, { status: 503, headers: cabeceras });
  }
}
