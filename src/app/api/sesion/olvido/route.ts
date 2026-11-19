import { NextResponse } from "next/server";
import { almacenAccesos } from "@/accesos/almacen";
import { limpiarUsuario, usuarioValido } from "@/accesos/modelo";

const CABECERAS = { "Cache-Control": "no-store" };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * «He olvidado la contraseña»: se apunta para que Gradiox le dé una nueva
 * desde el panel interno. Contesta lo mismo exista o no el usuario, para no
 * dejar averiguar quién tiene cuenta. No usa sesión.
 */
export async function POST(peticion: Request) {
  const d = (await peticion.json().catch(() => ({}))) as { usuario?: unknown };
  const usuario = limpiarUsuario(d.usuario);
  if (!usuarioValido(usuario)) return NextResponse.json({ error: "Escribe tu usuario." }, { status: 400, headers: CABECERAS });
  try {
    await almacenAccesos().pedirClave(usuario, Date.now());
  } catch {
    return NextResponse.json({ error: "No se ha podido apuntar. Vuelve a intentarlo en un momento." }, { status: 503, headers: CABECERAS });
  }
  await espera(400);
  return NextResponse.json({ ok: true, texto: "Apuntado. Si el usuario existe, Gradiox te dará una contraseña nueva en cuanto lo vea." }, { headers: CABECERAS });
}
