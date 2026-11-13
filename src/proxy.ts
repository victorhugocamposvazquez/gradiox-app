import { NextResponse, type NextRequest } from "next/server";
import { GALLETA, credenciales, sesionValida } from "@/lib/sesion";

// Sin sesión no se ve nada de la app: todo lo que no sea la entrada lleva a /login.
export async function proxy(peticion: NextRequest) {
  const { pathname, search } = peticion.nextUrl;
  const c = credenciales();
  const dentro = c ? await sesionValida(peticion.cookies.get(GALLETA)?.value, c) : false;
  const esEntrada = pathname === "/login" || pathname === "/api/sesion";

  if (dentro) return pathname === "/login" ? NextResponse.redirect(new URL("/", peticion.url)) : NextResponse.next();
  if (esEntrada) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const entrada = new URL("/login", peticion.url);
  if (pathname !== "/") entrada.searchParams.set("volver", pathname + search);
  return NextResponse.redirect(entrada);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
