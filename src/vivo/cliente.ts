"use client";

// En el navegador: qué nave se está viendo (la de demostración o una
// instalación conectada) y las instalaciones conectadas, que se piden al
// servidor cada 15 segundos mientras la pestaña está a la vista. Un único
// sondeo para toda la app, lo usen la barra de arriba, Hoy o Servicios.

import { useSyncExternalStore } from "react";
import type { InstalacionViva } from "./modelo";

export const NAVE_DEMO = "demo";
const CLAVE_NAVE = "gradiox-nave";
const CADA_MS = 15_000;

export type EstadoVivo = { instalaciones: InstalacionViva[] | null; fallo: boolean; pedida: number | null };

let estado: EstadoVivo = { instalaciones: null, fallo: false, pedida: null };
const oyentes = new Set<() => void>();
let reloj: ReturnType<typeof setInterval> | null = null;

const avisar = () => oyentes.forEach((f) => f());

async function pedir() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden" && estado.instalaciones !== null) return;
  try {
    const r = await fetch("/api/instalaciones", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const d = (await r.json()) as { instalaciones: InstalacionViva[] };
    estado = { instalaciones: d.instalaciones, fallo: false, pedida: Date.now() };
  } catch {
    estado = { instalaciones: estado.instalaciones ?? [], fallo: true, pedida: Date.now() };
  }
  avisar();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  if (!reloj) {
    void pedir();
    reloj = setInterval(pedir, CADA_MS);
    document.addEventListener("visibilitychange", alVolver);
  }
  return () => {
    oyentes.delete(f);
    if (!oyentes.size && reloj) {
      clearInterval(reloj);
      reloj = null;
      document.removeEventListener("visibilitychange", alVolver);
    }
  };
}
function alVolver() {
  if (document.visibilityState === "visible") void pedir();
}

const SIN_DATOS: EstadoVivo = { instalaciones: null, fallo: false, pedida: null };
const sinSuscribir = () => () => {};
/** `activo` en false no pregunta al servidor: para las pantallas sin sesión de la app (entrada, presentación, panel interno). */
export const useInstalaciones = (activo = true) => useSyncExternalStore(activo ? suscribir : sinSuscribir, () => (activo ? estado : SIN_DATOS), () => SIN_DATOS);

// La nave elegida se recuerda en este navegador.
const oyentesNave = new Set<() => void>();
/** La nave elegida a mano, o "" si nunca se ha elegido: entonces manda la ubicación principal. */
function leerNave() {
  try {
    return window.localStorage.getItem(CLAVE_NAVE) ?? naveEnMemoria;
  } catch {
    return naveEnMemoria;
  }
}
let naveEnMemoria = "";
export function elegirNave(id: string) {
  naveEnMemoria = id;
  try {
    window.localStorage.setItem(CLAVE_NAVE, id);
  } catch {
    // Vale solo mientras siga abierta la pestaña.
  }
  oyentesNave.forEach((f) => f());
}
function suscribirNave(f: () => void) {
  oyentesNave.add(f);
  const otraPestana = (e: StorageEvent) => e.key === CLAVE_NAVE && f();
  window.addEventListener("storage", otraPestana);
  return () => {
    oyentesNave.delete(f);
    window.removeEventListener("storage", otraPestana);
  };
}
const useNaveId = () => useSyncExternalStore(suscribirNave, leerNave, () => "");

/**
 * La instalación conectada que se está viendo, o null si es la nave de
 * demostración. La ubicación principal es la primera instalación conectada;
 * la nave de demostración queda como ubicación secundaria. Si la elegida ya no
 * existe, se vuelve a la principal. `cargando` es true mientras no se sabe.
 */
export function useNaveViva(activo = true): { id: string; viva: InstalacionViva | null; cargando: boolean; vivo: EstadoVivo } {
  const id = useNaveId();
  const vivo = useInstalaciones(activo);
  if (!activo) return { id: NAVE_DEMO, viva: null, cargando: false, vivo };
  if (id === NAVE_DEMO) return { id, viva: null, cargando: false, vivo };
  if (vivo.instalaciones === null) return { id, viva: null, cargando: true, vivo };
  const viva = vivo.instalaciones.find((i) => i.id === id) ?? vivo.instalaciones[0] ?? null;
  return { id: viva ? viva.id : NAVE_DEMO, viva, cargando: false, vivo };
}
