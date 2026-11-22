import { NextResponse } from "next/server";
import { puedeVer, quienEs } from "@/accesos/quien";
import { atenderHistoricos } from "@/historicos/ruta";

// Históricos de lo leído y lo ejecutado en las instalaciones conectadas. Solo con sesión iniciada en la app;
// el usuario de un cliente solo ve las instalaciones de su cliente.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(peticion: Request) {
  const q = await quienEs(peticion).catch(() => null);
  if (!q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return atenderHistoricos(peticion, (p) => puedeVer(q, p));
}
