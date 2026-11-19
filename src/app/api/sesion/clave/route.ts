import { NextResponse } from "next/server";
import { almacenAccesos } from "@/accesos/almacen";
import { LARGO_MINIMO, claveCorrecta, huellaClave } from "@/accesos/modelo";
import { quienEs } from "@/accesos/quien";
import { DURA_SESION_S, GALLETA, crearSesionCliente, credenciales } from "@/lib/sesion";

const CABECERAS = { "Cache-Control": "no-store" };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cambiar la propia contraseña, con la de ahora. Solo los usuarios de un
 * cliente: la del equipo de Gradiox se cambia en el servidor. Cierra las demás
 * sesiones abiertas de ese usuario y deja esta abierta.
 */
export async function POST(peticion: Request) {
  const c = credenciales();
  const q = await quienEs(peticion).catch(() => null);
  if (!c || !q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: CABECERAS });
  if (q.tipo !== "cliente") return NextResponse.json({ error: "La contraseña del equipo de Gradiox se cambia en el servidor (GRADIOX_CLAVE en Vercel)." }, { status: 400, headers: CABECERAS });
  const d = (await peticion.json().catch(() => ({}))) as { actual?: unknown; nueva?: unknown };
  const actual = typeof d.actual === "string" ? d.actual : "";
  const nueva = typeof d.nueva === "string" ? d.nueva : "";
  if (nueva.length < LARGO_MINIMO || nueva.length > 200) return NextResponse.json({ error: `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO} caracteres.` }, { status: 400, headers: CABECERAS });
  const a = almacenAccesos();
  const guardado = await a.leer(q.acceso.id);
  if (!guardado || !(await claveCorrecta(actual, guardado.huella))) {
    await espera(700);
    return NextResponse.json({ error: "La contraseña de ahora no es correcta." }, { status: 403, headers: CABECERAS });
  }
  const cambiado = await a.cambiar(guardado.id, { huella: await huellaClave(nueva), subirVersion: true });
  if (!cambiado) return NextResponse.json({ error: "No se ha podido cambiar" }, { status: 503, headers: CABECERAS });
  const respuesta = NextResponse.json({ ok: true }, { headers: CABECERAS });
  respuesta.cookies.set(GALLETA, await crearSesionCliente(c, cambiado.id, cambiado.version), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DURA_SESION_S });
  return respuesta;
}
