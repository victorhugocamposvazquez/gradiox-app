// Acceso a la app. Hay dos clases de usuario:
// - El del equipo de Gradiox, que se configura en el servidor (GRADIOX_USUARIO
//   y GRADIOX_CLAVE) y lo ve todo.
// - Los de cada cliente, que se dan de alta en el panel interno (src/accesos)
//   y solo ven las instalaciones de su cliente.
// La sesión es una galleta firmada con GRADIOX_CLAVE: cambiarla cierra todas
// las sesiones abiertas, también las de los clientes. La de un cliente lleva
// además su número de versión, que sube al cambiarle la contraseña o
// desactivarlo, y eso se comprueba en la base de datos en cada consulta.

export const GALLETA = "gx_sesion";
/** La sesión del panel interno es otra: entrar en la app no da paso al panel, ni al revés. */
export const GALLETA_OPS = "gx_ops";
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

/** El usuario del panel interno (GRADIOX_OPS_USUARIO y GRADIOX_OPS_CLAVE), o null si no está puesto. */
export function credencialesOps(): Credenciales | null {
  const usuario = process.env.GRADIOX_OPS_USUARIO?.trim();
  const clave = process.env.GRADIOX_OPS_CLAVE;
  return usuario && clave ? { usuario, clave } : null;
}

export type Ambito = "app" | "ops";
// Cada ámbito firma un texto distinto: una galleta de la app no vale para el panel aunque coincidieran las contraseñas.
const aFirmar = (c: Credenciales, caduca: number | string, ambito: Ambito) => (ambito === "ops" ? `ops|${c.usuario}|${caduca}` : `${c.usuario}|${caduca}`);

export async function crearSesion(c: Credenciales, ahora = Date.now(), ambito: Ambito = "app"): Promise<string> {
  const caduca = ahora + DURA_SESION_S * 1000;
  return `${caduca}.${await firmar(c.clave, aFirmar(c, caduca, ambito))}`;
}

export async function sesionValida(galleta: string | undefined, c: Credenciales, ahora = Date.now(), ambito: Ambito = "app"): Promise<boolean> {
  if (!galleta) return false;
  const [caduca, firma] = galleta.split(".");
  if (!firma || !/^\d+$/.test(caduca) || Number(caduca) < ahora) return false;
  return iguales(firma, await firmar(c.clave, aFirmar(c, caduca, ambito)));
}

export type Sesion = { tipo: "equipo" } | { tipo: "cliente"; id: string; version: number };
const aFirmarCliente = (id: string, version: number | string, caduca: number | string) => `cliente|${id}|${version}|${caduca}`;

/** La galleta de un usuario de cliente: «c.<acceso>.<versión>.<caduca>.<firma>». */
export async function crearSesionCliente(c: Credenciales, id: string, version: number, ahora = Date.now()): Promise<string> {
  const caduca = ahora + DURA_SESION_S * 1000;
  return `c.${id}.${version}.${caduca}.${await firmar(c.clave, aFirmarCliente(id, version, caduca))}`;
}

/** Quién está dentro según la galleta, sin mirar la base de datos. null si no vale. */
export async function leerSesion(galleta: string | undefined, c: Credenciales, ahora = Date.now()): Promise<Sesion | null> {
  if (!galleta) return null;
  if (!galleta.startsWith("c.")) return (await sesionValida(galleta, c, ahora, "app")) ? { tipo: "equipo" } : null;
  const [, id, version, caduca, firma] = galleta.split(".");
  if (!firma || !/^[0-9a-f-]{36}$/.test(id) || !/^\d+$/.test(version) || !/^\d+$/.test(caduca) || Number(caduca) < ahora) return null;
  return (await iguales(firma, await firmar(c.clave, aFirmarCliente(id, version, caduca)))) ? { tipo: "cliente", id, version: Number(version) } : null;
}

/** Solo se vuelve a rutas de la propia app: nada de direcciones de fuera. */
export const destinoSeguro = (volver: string | null | undefined) => (volver && /^\/(?![/\\])/.test(volver) && !volver.startsWith("/login") ? volver : "/");
/** Lo mismo para el panel interno: solo se vuelve a una pantalla del panel. */
export const destinoOps = (volver: string | null | undefined) => (volver && /^\/ops(\/|$)/.test(volver) && !volver.startsWith("/ops/entrar") ? volver : "/ops");
