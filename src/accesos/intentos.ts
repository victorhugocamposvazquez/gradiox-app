// Freno a quien prueba contraseñas: tras varios fallos seguidos con un mismo
// usuario, ese usuario no puede entrar durante un rato, aunque la contraseña
// siguiente sea la buena. Vale para la app y para el panel interno.

import { almacenAjustes, type AlmacenAjustes } from "../ajustes/almacen";

export const MAX_FALLOS = 8;
export const VENTANA_MS = 15 * 60_000;
export const BLOQUEO_MS = 15 * 60_000;

type Cuenta = { n: number; desde: number; hasta: number };
const clave = (zona: string, usuario: string) => `intentos:${zona}:${usuario.toLowerCase().slice(0, 80)}`;

/** Hasta cuándo está frenado ese usuario, o 0 si puede intentarlo. */
export async function frenadoHasta(zona: string, usuario: string, ahora = Date.now(), a: AlmacenAjustes = almacenAjustes()): Promise<number> {
  if (!usuario) return 0;
  const c = await a.leer<Cuenta>(clave(zona, usuario)).catch(() => null);
  return c && c.hasta > ahora ? c.hasta : 0;
}

/** Apunta un fallo. Devuelve hasta cuándo queda frenado, o 0 si todavía no. */
export async function apuntarFallo(zona: string, usuario: string, ahora = Date.now(), a: AlmacenAjustes = almacenAjustes()): Promise<number> {
  if (!usuario) return 0;
  try {
    const k = clave(zona, usuario);
    const c = await a.leer<Cuenta>(k);
    const viva = c && ahora - c.desde < VENTANA_MS;
    const n = (viva ? c.n : 0) + 1;
    const hasta = n >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0;
    await a.guardar(k, { n: hasta ? 0 : n, desde: viva ? c.desde : ahora, hasta });
    return hasta;
  } catch {
    return 0;
  }
}

/** Al entrar bien se olvida la cuenta de fallos. */
export async function olvidarFallos(zona: string, usuario: string, a: AlmacenAjustes = almacenAjustes()): Promise<void> {
  if (!usuario) return;
  await a.guardar(clave(zona, usuario), { n: 0, desde: 0, hasta: 0 }).catch(() => undefined);
}

export const textoFreno = (hasta: number, ahora = Date.now()) => `Demasiados intentos fallidos. Por seguridad, este usuario no puede entrar durante ${Math.max(1, Math.ceil((hasta - ahora) / 60_000))} min.`;
