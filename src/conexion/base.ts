// Cómo se abre la conexión con la base de datos Postgres (Supabase en producción).

import type { PoolConfig } from "pg";

const LOCALES = ["localhost", "127.0.0.1", "::1", "[::1]"];

/**
 * Fuera de este ordenador la conexión va siempre cifrada. Si el servidor tiene
 * GRADIOX_BASE_CA (el certificado de la autoridad de la base, en texto), además se
 * comprueba que el otro lado es quien dice ser; sin él, se cifra sin comprobarlo.
 */
export function opcionesBase(url: string, entorno: Record<string, string | undefined> = process.env): PoolConfig {
  let local = false;
  let limpia = url;
  try {
    const u = new URL(url);
    local = LOCALES.includes(u.hostname);
    // El modo de cifrado lo decide este programa, no la dirección: así no depende de cómo la copie cada uno.
    for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) u.searchParams.delete(k);
    limpia = u.toString();
  } catch {
    // Si no es una dirección válida, se deja tal cual y fallará al conectar con su explicación.
  }
  const ca = entorno.GRADIOX_BASE_CA?.trim();
  // Pocas conexiones: en un servidor por funciones cada copia abre las suyas.
  return { connectionString: limpia, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000, ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } };
}
