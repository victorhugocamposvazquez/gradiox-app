import { NextResponse } from "next/server";
import { DURA_SESION_S, GALLETA_OPS, crearSesion, credencialesOps, iguales } from "@/lib/sesion";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Entrar al panel interno: usuario y contraseña propios, distintos de los de la app. */
export async function POST(peticion: Request) {
  const c = credencialesOps();
  if (!c) return NextResponse.json({ error: "El panel interno no está configurado en el servidor." }, { status: 503 });
  let datos: { usuario?: unknown; clave?: unknown };
  try {
    datos = await peticion.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const usuario = typeof datos.usuario === "string" ? datos.usuario.trim() : "";
  const clave = typeof datos.clave === "string" ? datos.clave : "";
  const [u, k] = await Promise.all([iguales(usuario.toLowerCase(), c.usuario.toLowerCase()), iguales(clave, c.clave)]);
  if (!u || !k) {
    // Frena a quien pruebe contraseñas a mano o con un programa.
    await espera(700);
    return NextResponse.json({ error: "El usuario o la contraseña no son correctos." }, { status: 401 });
  }
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(GALLETA_OPS, await crearSesion(c, Date.now(), "ops"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURA_SESION_S,
  });
  return respuesta;
}

/** Salir del panel: borra su galleta. La sesión de la app no se toca. */
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(GALLETA_OPS, "", { httpOnly: true, path: "/", maxAge: 0 });
  return respuesta;
}
