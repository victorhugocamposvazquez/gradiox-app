import { NextResponse } from "next/server";
import { almacenPasarelas } from "@/pasarelas/almacen";
import { instalacionesVivas } from "@/vivo/consulta";

// Las instalaciones conectadas con sus servicios en vivo, para Hoy y Servicios. Solo con sesión iniciada en la app.
export const dynamic = "force-dynamic";

export async function GET() {
  const cabeceras = { "Cache-Control": "no-store" };
  try {
    const ahora = Date.now();
    return NextResponse.json({ ahora, instalaciones: await instalacionesVivas(almacenPasarelas(), ahora) }, { headers: cabeceras });
  } catch {
    return NextResponse.json({ error: "No se han podido leer las instalaciones conectadas" }, { status: 503, headers: cabeceras });
  }
}
