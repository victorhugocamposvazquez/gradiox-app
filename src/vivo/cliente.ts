"use client";

// En el navegador: qué nave se está viendo (la de demostración o una
// instalación conectada) y las instalaciones conectadas, que se piden al
// servidor cada 15 segundos mientras la pestaña está a la vista. Un único
// sondeo para toda la app, lo usen la barra de arriba, Hoy o Servicios.

import { useSyncExternalStore } from "react";
import { porUbicacion, type InstalacionViva, type UbicacionViva } from "./modelo";

export const NAVE_DEMO = "demo";
const CLAVE_NAVE = "gradiox-nave";
const CADA_MS = 15_000;

export type EstadoVivo = {
  instalaciones: InstalacionViva[] | null;
  /** Las mismas, agrupadas por cliente y ubicación. */
  ubicaciones: UbicacionViva[] | null;
  /** Si quien está dentro ve también la nave de demostración. */
  demo: boolean;
  quien: "equipo" | "cliente" | null;
  fallo: boolean;
  pedida: number | null;
};

let estado: EstadoVivo = { instalaciones: null, ubicaciones: null, demo: true, quien: null, fallo: false, pedida: null };
const oyentes = new Set<() => void>();
let reloj: ReturnType<typeof setInterval> | null = null;

const avisar = () => oyentes.forEach((f) => f());

async function pedir() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden" && estado.instalaciones !== null) return;
  try {
    const r = await fetch("/api/instalaciones", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const d = (await r.json()) as { instalaciones: InstalacionViva[]; demo?: boolean; quien?: "equipo" | "cliente" };
    estado = { instalaciones: d.instalaciones, ubicaciones: porUbicacion(d.instalaciones), demo: d.demo !== false, quien: d.quien ?? null, fallo: false, pedida: Date.now() };
  } catch {
    estado = { ...estado, instalaciones: estado.instalaciones ?? [], ubicaciones: estado.ubicaciones ?? [], fallo: true, pedida: Date.now() };
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

const SIN_DATOS: EstadoVivo = { instalaciones: null, ubicaciones: null, demo: true, quien: null, fallo: false, pedida: null };
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

/** Clave de una ubicación en el selector. */
export const claveUbicacion = (u: Pick<InstalacionViva, "cliente" | "ubicacion">) => `${u.cliente?.id ?? ""}|${u.ubicacion.id}`;

/**
 * La ubicación conectada que se está viendo, con todas sus instalaciones
 * juntas, o null si es la nave de demostración. La principal es la primera
 * ubicación conectada; la nave de demostración queda como secundaria (si quien
 * está dentro puede verla). Si la elegida ya no existe, se vuelve a la
 * principal. `cargando` es true mientras no se sabe. `sinNada` es true si no
 * hay ninguna ubicación que enseñar.
 */
export function useNaveViva(activo = true): { id: string; viva: UbicacionViva | null; cargando: boolean; sinNada: boolean; vivo: EstadoVivo } {
  const id = useNaveId();
  const vivo = useInstalaciones(activo);
  if (!activo) return { id: NAVE_DEMO, viva: null, cargando: false, sinNada: false, vivo };
  if (vivo.ubicaciones === null) return { id, viva: null, cargando: true, sinNada: false, vivo };
  const ubs = vivo.ubicaciones;
  if (id === NAVE_DEMO && vivo.demo) return { id, viva: null, cargando: false, sinNada: false, vivo };
  const viva = ubs.find((u) => claveUbicacion(u) === id) ?? ubs[0] ?? null;
  return { id: viva ? claveUbicacion(viva) : NAVE_DEMO, viva, cargando: false, sinNada: !viva && !vivo.demo, vivo };
}

// Quién está dentro, para el menú de usuario. Se pregunta una vez por visita.
export type Yo = { tipo: "equipo"; demo: boolean } | { tipo: "cliente"; nombre: string; usuario: string; cliente: string; demo: boolean };
let yo: Yo | null = null;
let pidiendoYo: Promise<void> | null = null;
const oyentesYo = new Set<() => void>();
function suscribirYo(f: () => void) {
  oyentesYo.add(f);
  pidiendoYo ??= fetch("/api/sesion", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Yo>) : null))
    .then((d) => {
      yo = d;
      oyentesYo.forEach((g) => g());
    })
    .catch(() => {
      pidiendoYo = null;
    });
  return () => oyentesYo.delete(f);
}
export const useYo = (activo = true) => useSyncExternalStore(activo ? suscribirYo : sinSuscribir, () => (activo ? yo : null), () => null);
