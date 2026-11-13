// Acceso con un usuario y una contraseña que se configuran en el servidor
// (variables GRADIOX_USUARIO y GRADIOX_CLAVE). No hay base de datos: la sesión
// es una galleta firmada con la propia contraseña, así que cambiarla cierra
// todas las sesiones abiertas.

export const GALLETA = "gx_sesion";
export const DURA_SESION_S = 7 * 24 * 3600;

const codificar = new TextEncoder();

async function firmar(clave: string, texto: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", codificar.encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", llave, codificar.encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara dos textos sin que el tiempo de respuesta delate cuánto se parecen. */
export async function iguales(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([firmar("gradiox-comparar", a), firmar("gradiox-comparar", b)]);
  let distinto = 0;
  for (let i = 0; i < x.length; i++) distinto |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return distinto === 0;
}

export type Credenciales = { usuario: string; clave: string };

/** Lo configurado en el servidor, o null si falta alguna de las dos variables. */
export function credenciales(): Credenciales | null {
  const usuario = process.env.GRADIOX_USUARIO?.trim();
  const clave = process.env.GRADIOX_CLAVE;
  return usuario && clave ? { usuario, clave } : null;
}

export async function crearSesion(c: Credenciales, ahora = Date.now()): Promise<string> {
  const caduca = ahora + DURA_SESION_S * 1000;
  return `${caduca}.${await firmar(c.clave, `${c.usuario}|${caduca}`)}`;
}

export async function sesionValida(galleta: string | undefined, c: Credenciales, ahora = Date.now()): Promise<boolean> {
  if (!galleta) return false;
  const [caduca, firma] = galleta.split(".");
  if (!firma || !/^\d+$/.test(caduca) || Number(caduca) < ahora) return false;
  return iguales(firma, await firmar(c.clave, `${c.usuario}|${caduca}`));
}

/** Solo se vuelve a rutas de la propia app: nada de direcciones de fuera. */
export const destinoSeguro = (volver: string | null | undefined) => (volver && /^\/(?![/\\])/.test(volver) && !volver.startsWith("/login") ? volver : "/");
