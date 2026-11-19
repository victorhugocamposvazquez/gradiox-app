import { NextResponse, type NextRequest } from "next/server";
import { GALLETA, GALLETA_OPS, credenciales, credencialesOps, leerSesion, sesionValida } from "@/lib/sesion";

// Hay dos zonas con entradas distintas. La app (lo que ve el cliente) usa una sesión;
// el panel interno de Gradiox, bajo /ops, usa otra, con su propio usuario.
export async function proxy(peticion: NextRequest) {
  const { pathname, search } = peticion.nextUrl;

  if (pathname === "/ops" || pathname.startsWith("/ops/") || pathname.startsWith("/api/ops/")) {
    const c = credencialesOps();
    const dentro = c ? await sesionValida(peticion.cookies.get(GALLETA_OPS)?.value, c, Date.now(), "ops") : false;
    const esEntrada = pathname === "/ops/entrar" || pathname === "/api/ops/sesion";
    if (dentro) return pathname === "/ops/entrar" ? NextResponse.redirect(new URL("/ops", peticion.url)) : NextResponse.next();
    if (esEntrada) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sin sesión en el panel interno" }, { status: 401 });
    const entrada = new URL("/ops/entrar", peticion.url);
    if (pathname !== "/ops") entrada.searchParams.set("volver", pathname + search);
    return NextResponse.redirect(entrada);
  }

  // El enlace de una ficha técnica se abre sin sesión: lo protege su clave, que se comprueba en la propia ruta.
  if (pathname.startsWith("/ficha/") || pathname.startsWith("/api/ficha/")) return NextResponse.next();

  // Sin sesión no se ve nada de la app: la portada lleva a la presentación y todo lo demás, a /login.
  const c = credenciales();
  const dentro = c ? (await leerSesion(peticion.cookies.get(GALLETA)?.value, c)) !== null : false;
  const esEntrada = pathname === "/login" || pathname === "/api/sesion" || pathname === "/api/sesion/olvido";
  // La presentación se ve sin sesión: es lo que encuentra quien llega de fuera.
  // La entrada de lecturas tampoco usa sesión: se protege con la clave de pasarela en la propia ruta.
  // Lo mismo lo que piden los programas de pasarela: cada petición lleva el token de su instalación.
  const esPublica = pathname === "/presentacion" || pathname === "/api/ingesta" || pathname.startsWith("/api/pasarela/");

  if (dentro) return pathname === "/login" ? NextResponse.redirect(new URL("/", peticion.url)) : NextResponse.next();
  if (esEntrada || esPublica) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (pathname === "/") return NextResponse.redirect(new URL("/presentacion", peticion.url));
  const entrada = new URL("/login", peticion.url);
  if (pathname !== "/") entrada.searchParams.set("volver", pathname + search);
  return NextResponse.redirect(entrada);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|panel\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|mp4|woff2?)$).*)"],
};
