// El almacén que usa el servidor. Con una base de datos conectada las lecturas
// quedan guardadas; sin ella se usa la memoria del proceso, válida solo para pruebas.

import { almacenEnMemoria, type Almacen } from "./almacen";
import { almacenPostgres } from "./almacen-postgres";

/** La dirección de la base de datos, con los nombres que pone Vercel al conectar una. */
export const direccionBase = (entorno: Record<string, string | undefined> = process.env) => entorno.GRADIOX_BASE_URL || entorno.POSTGRES_URL || entorno.DATABASE_URL || undefined;

const global = globalThis as { __gradioxAlmacen?: Almacen };
/** Uno solo por proceso. */
export function almacen(): Almacen {
  if (global.__gradioxAlmacen) return global.__gradioxAlmacen;
  const url = direccionBase();
  return (global.__gradioxAlmacen = url ? almacenPostgres(url) : almacenEnMemoria());
}
