// Quién hace cada petición a la app y qué instalaciones puede ver.

import { GALLETA, credenciales, leerSesion } from "../lib/sesion";
import type { Pasarela } from "../pasarelas/modelo";
import { almacenAccesos, type AlmacenAccesos } from "./almacen";
import { sinHuella, type Acceso } from "./modelo";

export type Quien = { tipo: "equipo" } | { tipo: "cliente"; acceso: Acceso };

/** El valor de una galleta en una petición. */
export function galleta(peticion: Request, nombre: string): string | undefined {
  for (const trozo of (peticion.headers.get("cookie") ?? "").split(";")) {
    const i = trozo.indexOf("=");
    if (i > 0 && trozo.slice(0, i).trim() === nombre) return decodeURIComponent(trozo.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * Quién está dentro. Para un usuario de cliente se mira además en la base de
 * datos que siga activo y que no le hayan cambiado la contraseña: si no, es
 * como si no tuviera sesión.
 */
export async function quienEs(peticion: Request, a: AlmacenAccesos = almacenAccesos(), ahora = Date.now()): Promise<Quien | null> {
  const c = credenciales();
  if (!c) return null;
  const s = await leerSesion(galleta(peticion, GALLETA), c, ahora);
  if (!s) return null;
  if (s.tipo === "equipo") return s;
  const acceso = await a.leer(s.id);
  if (!acceso || !acceso.activo || acceso.version !== s.version) return null;
  return { tipo: "cliente", acceso: sinHuella(acceso) };
}

/** Si quien pregunta puede ver esta instalación. */
export const puedeVer = (q: Quien, p: Pick<Pasarela, "cliente">) => q.tipo === "equipo" || (!!p.cliente && p.cliente === q.acceso.cliente);
/** Si ve la nave de demostración y los ejemplos. */
export const veDemo = (q: Quien) => q.tipo === "equipo" || q.acceso.demo;
