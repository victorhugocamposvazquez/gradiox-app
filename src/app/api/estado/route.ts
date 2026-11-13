import { NextResponse } from "next/server";

// Latido del servidor: sirve para saber que Gradiox contesta, cuánto tarda y
// si el reloj de este dispositivo va con el del servidor.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ hora: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
