import { NextResponse } from "next/server";
import { quienEs } from "@/accesos/quien";
import { visitasSoporte } from "@/clientes/soporte";

/** Las veces que soporte de Gradiox ha entrado a ver la app de este cliente, para que el propio cliente lo pueda comprobar. */
export async function GET(peticion: Request) {
  const cabeceras = { "Cache-Control": "no-store" };
  const q = await quienEs(peticion).catch(() => null);
  if (!q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cabeceras });
  if (q.tipo !== "cliente") return NextResponse.json({ visitas: [] }, { headers: cabeceras });
  return NextResponse.json({ visitas: (await visitasSoporte(q.acceso.cliente).catch(() => [])).slice(0, 20) }, { headers: cabeceras });
}
