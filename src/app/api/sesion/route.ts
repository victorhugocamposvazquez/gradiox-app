import { NextResponse } from "next/server";
import { DURA_SESION_S, GALLETA, crearSesion, credenciales, iguales } from "@/lib/sesion";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Entrar: comprueba usuario y contraseña y deja la galleta de sesión. */
export async function POST(peticion: Request) {
  const c = credenciales();
  if (!c) return NextResponse.json({ error: "El acceso no está configurado en el servidor." }, { status: 503 });
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
  respuesta.cookies.set(GALLETA, await crearSesion(c), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURA_SESION_S,
  });
  return respuesta;
}

/** Salir: borra la galleta. */
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(GALLETA, "", { httpOnly: true, path: "/", maxAge: 0 });
  return respuesta;
}
