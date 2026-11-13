import { NextResponse, type NextRequest } from "next/server";
import { GALLETA, credenciales, sesionValida } from "@/lib/sesion";

// Sin sesión no se ve nada de la app: la portada lleva a la presentación y todo lo demás, a /login.
export async function proxy(peticion: NextRequest) {
  const { pathname, search } = peticion.nextUrl;
  const c = credenciales();
  const dentro = c ? await sesionValida(peticion.cookies.get(GALLETA)?.value, c) : false;
  const esEntrada = pathname === "/login" || pathname === "/api/sesion";
  // La presentación se ve sin sesión: es lo que encuentra quien llega de fuera.
  const esPublica = pathname === "/presentacion";

  if (dentro) return pathname === "/login" ? NextResponse.redirect(new URL("/", peticion.url)) : NextResponse.next();
  if (esEntrada || esPublica) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (pathname === "/") return NextResponse.redirect(new URL("/presentacion", peticion.url));
  const entrada = new URL("/login", peticion.url);
  if (pathname !== "/") entrada.searchParams.set("volver", pathname + search);
  return NextResponse.redirect(entrada);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
