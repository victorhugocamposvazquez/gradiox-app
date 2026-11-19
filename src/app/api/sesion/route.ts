import { NextResponse } from "next/server";
import { almacenAccesos } from "@/accesos/almacen";
import { claveCorrecta, huellaClave, limpiarUsuario } from "@/accesos/modelo";
import { quienEs } from "@/accesos/quien";
import { almacenClientes } from "@/clientes/almacen";
import { DURA_SESION_S, GALLETA, crearSesion, crearSesionCliente, credenciales, iguales } from "@/lib/sesion";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = { "Cache-Control": "no-store" };
// Para que un usuario que no existe tarde lo mismo que una contraseña mal puesta.
let huellaFalsa: Promise<string> | undefined;

/** Quién está dentro: el equipo de Gradiox o el usuario de un cliente, con el nombre de su cliente. */
export async function GET(peticion: Request) {
  try {
    const q = await quienEs(peticion);
    if (!q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: CABECERAS });
    if (q.tipo === "equipo") return NextResponse.json({ tipo: "equipo", demo: true }, { headers: CABECERAS });
    const cliente = await almacenClientes().leer(q.acceso.cliente).catch(() => null);
    return NextResponse.json({ tipo: "cliente", nombre: q.acceso.nombre || q.acceso.usuario, usuario: q.acceso.usuario, cliente: cliente?.nombre ?? "", demo: q.acceso.demo }, { headers: CABECERAS });
  } catch {
    return NextResponse.json({ error: "No se ha podido comprobar la sesión" }, { status: 503, headers: CABECERAS });
  }
}

/**
 * Entrar: primero se mira si es el usuario del equipo de Gradiox (el del
 * servidor); si no, el de un cliente dado de alta en el panel interno.
 */
export async function POST(peticion: Request) {
  const c = credenciales();
  if (!c) return NextResponse.json({ error: "El acceso no está configurado en el servidor." }, { status: 503 });
  let datos: { usuario?: unknown; clave?: unknown };
  try {
    datos = await peticion.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const usuario = limpiarUsuario(datos.usuario);
  const clave = typeof datos.clave === "string" ? datos.clave : "";
  const opciones = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: DURA_SESION_S };

  const [u, k] = await Promise.all([iguales(usuario, c.usuario.toLowerCase()), iguales(clave, c.clave)]);
  if (u && k) {
    const respuesta = NextResponse.json({ ok: true });
    respuesta.cookies.set(GALLETA, await crearSesion(c), opciones);
    return respuesta;
  }

  if (usuario && clave && !u) {
    try {
      const a = almacenAccesos();
      const acceso = await a.porUsuario(usuario);
      const vale = acceso ? await claveCorrecta(clave, acceso.huella) : await claveCorrecta(clave, await (huellaFalsa ??= huellaClave("no-existe")));
      if (acceso && vale && acceso.activo) {
        const ahora = Date.now();
        await a.entro(acceso.id, ahora);
        const respuesta = NextResponse.json({ ok: true });
        respuesta.cookies.set(GALLETA, await crearSesionCliente(c, acceso.id, acceso.version, ahora), opciones);
        return respuesta;
      }
      if (acceso && vale && !acceso.activo) {
        await espera(700);
        return NextResponse.json({ error: "Este usuario está desactivado. Pide a Gradiox que lo vuelva a activar." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "No se ha podido comprobar el usuario. Vuelve a intentarlo en un momento." }, { status: 503 });
    }
  }
  // Frena a quien pruebe contraseñas a mano o con un programa.
  await espera(700);
  return NextResponse.json({ error: "El usuario o la contraseña no son correctos." }, { status: 401 });
}

/** Salir: borra la galleta. */
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(GALLETA, "", { httpOnly: true, path: "/", maxAge: 0 });
  return respuesta;
}
