import { NextResponse } from "next/server";
import { almacen } from "@/conexion/servidor";
import { recibirLote } from "@/conexion/ingesta";

// Aquí entregan las pasarelas sus lecturas. No usa la sesión de la app: cada
// envío lleva la clave de pasarela, que se configura en GRADIOX_PASARELA_CLAVE.
export const dynamic = "force-dynamic";

export async function POST(peticion: Request) {
  const r = await recibirLote(peticion, process.env.GRADIOX_PASARELA_CLAVE, almacen());
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { "Cache-Control": "no-store" } });
}
