// Los usuarios de la app de cada cliente. Se dan de alta en el panel interno,
// dentro de la ficha del cliente, y cada uno solo ve las instalaciones de su
// cliente. La contraseña no se guarda: se guarda su huella (scrypt con sal),
// de la que no se puede sacar la contraseña.

import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

export type Acceso = {
  id: string;
  /** Ficha del cliente en el panel interno. */
  cliente: string;
  /** Con lo que entra. Siempre en minúsculas. */
  usuario: string;
  /** Quién es, en claro: «Antonio Franco». */
  nombre: string;
  /** Si ve también la nave de demostración como otra ubicación. */
  demo: boolean;
  activo: boolean;
  /** Sube al cambiar la contraseña o desactivarlo: así se cierran sus sesiones abiertas. */
  version: number;
  creado: number;
  /** Última vez que entró. */
  ultimo: number | null;
  /** Cuándo pidió desde la entrada una contraseña nueva, si todavía no se le ha dado. */
  pideClave: number | null;
};
export type AccesoGuardado = Acceso & { huella: string };

export const sinHuella = ({ huella: _, ...a }: AccesoGuardado): Acceso => a;

export const LARGO_MINIMO = 10;
export const usuarioValido = (u: string) => /^[a-z0-9][a-z0-9._@-]{2,59}$/.test(u);
export const limpiarUsuario = (u: unknown) => (typeof u === "string" ? u.trim().toLowerCase() : "");
export const nuevoIdAcceso = () => randomUUID();

/** Contraseña fácil de dictar por teléfono: sin letras que se confundan (l, 1, o, 0). */
export function nuevaClave(largo = 14): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(largo);
  let out = "";
  for (let i = 0; i < largo; i++) out += letras[b[i] % letras.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10)}`;
}

export async function huellaClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(clave, sal, 32);
  return `scrypt$${sal.toString("base64url")}$${h.toString("base64url")}`;
}

export async function claveCorrecta(clave: string, huella: string): Promise<boolean> {
  const [tipo, sal, h] = huella.split("$");
  if (tipo !== "scrypt" || !sal || !h) return false;
  const esperada = Buffer.from(h, "base64url");
  const calculada = await scrypt(clave, Buffer.from(sal, "base64url"), esperada.length);
  return calculada.length === esperada.length && timingSafeEqual(calculada, esperada);
}

/** Lo que el panel puede pedir sobre un acceso. */
export type Accion =
  | { accion: "crear"; usuario: string; nombre: string; demo: boolean }
  | { accion: "clave"; id: string }
  | { accion: "cambiar"; id: string; nombre?: string; demo?: boolean; activo?: boolean }
  | { accion: "borrar"; id: string }
  | { accion: "instalacion"; pasarela: string; suya: boolean }
  | { accion: "ubicacion"; pasarela: string; ubicacion: string };

export function leerAccion(cuerpo: unknown): Accion | { error: string } {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const id = texto(c.id, 60);
  switch (c.accion) {
    case "crear": {
      const usuario = limpiarUsuario(c.usuario);
      if (!usuarioValido(usuario)) return { error: "El usuario tiene que tener entre 3 y 60 letras, números, puntos, guiones o @, sin espacios." };
      return { accion: "crear", usuario, nombre: texto(c.nombre, 120), demo: c.demo !== false };
    }
    case "clave":
    case "borrar":
      return id ? { accion: c.accion, id } : { error: "Falta qué acceso" };
    case "cambiar":
      if (!id) return { error: "Falta qué acceso" };
      return {
        accion: "cambiar",
        id,
        ...(typeof c.nombre === "string" ? { nombre: texto(c.nombre, 120) } : {}),
        ...(typeof c.demo === "boolean" ? { demo: c.demo } : {}),
        ...(typeof c.activo === "boolean" ? { activo: c.activo } : {}),
      };
    case "instalacion": {
      const pasarela = texto(c.pasarela, 60);
      return pasarela ? { accion: "instalacion", pasarela, suya: c.suya === true } : { error: "Falta qué instalación" };
    }
    case "ubicacion": {
      const pasarela = texto(c.pasarela, 60);
      return pasarela ? { accion: "ubicacion", pasarela, ubicacion: texto(c.ubicacion, 60) } : { error: "Falta qué instalación" };
    }
  }
  return { error: "No se sabe qué hacer" };
}
