import { NextResponse } from "next/server";
import { almacen } from "@/conexion/almacen";

// Últimas lecturas reales recibidas de una pasarela. Solo con sesión iniciada.
export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const pasarela = new URL(peticion.url).searchParams.get("pasarela") ?? "";
  if (!/^[a-z0-9-]{1,60}$/.test(pasarela)) return NextResponse.json({ error: "Falta el identificador de la pasarela" }, { status: 400 });
  return NextResponse.json({ medidas: await almacen().ultimas(pasarela) }, { headers: { "Cache-Control": "no-store" } });
}
