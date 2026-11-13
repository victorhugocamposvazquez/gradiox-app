// Notificaciones: lo que cambia de un momento al siguiente. Se compara una «foto»
// de la instalación con la anterior y cada cambio importante da una notificación.
// Hoy la comparación se hace en el navegador, mientras Gradiox está abierto. Con
// un servidor que vigile, esta misma función serviría para avisar con la app cerrada.

import { ORDENES, fallosAhora, type FalloTipico } from "./fallos";
import { AUTOMATAS, CAMARAS, PASARELA, leer, type Ajustes, type Estado } from "./sim";

export type TipoNoti = "alarma" | "conexion" | "fallo" | "aviso" | "recuperado";
export type Noti = { id: string; cuando: number; tipo: TipoNoti; titulo: string; texto: string; href: string; leida: boolean };
export type Preferencias = Record<TipoNoti, boolean> & { sonido: boolean };

/** Qué interrumpe de partida: lo grave sí, lo que se arregla solo no. */
export const PREFERENCIAS_INICIALES: Preferencias = { alarma: true, conexion: true, fallo: true, aviso: false, recuperado: false, sonido: false };

export const TIPOS: Record<TipoNoti, { nombre: string; detalle: string }> = {
  alarma: { nombre: "Alarmas", detalle: "Un servicio pasa su límite o se para el compresor" },
  conexion: { nombre: "Conexiones", detalle: "Un autómata o la pasarela dejan de contestar" },
  fallo: { nombre: "Fallos típicos", detalle: "Se reconoce uno de los fallos de vuestra lista" },
  aviso: { nombre: "Avisos", detalle: "Algo se sale de lo normal sin llegar a alarma" },
  recuperado: { nombre: "Vuelta a la normalidad", detalle: "Una alarma se resuelve o vuelve la conexión" },
};

export const MAXIMO = 60;

export type Foto = {
  camaras: Record<string, { estado: Estado; motivo: string }>;
  /** Equipos sin conexión. */
  caidos: string[];
  /** Fallos típicos activos, como `fallo|servicio`. */
  fallos: string[];
};

export function foto(t: number, aj: Ajustes, fallos: FalloTipico[]): Foto {
  const camaras: Foto["camaras"] = {};
  const activos: string[] = [];
  for (const c of CAMARAS) {
    const l = leer(c, t, aj);
    camaras[c.id] = { estado: l.estado, motivo: l.motivo };
    for (const f of fallosAhora(fallos, c, l)) activos.push(`${f.id}|${c.id}`);
  }
  const cortes = aj.cortes ?? {};
  const caidos = [PASARELA, ...AUTOMATAS].filter((e) => cortes[e.id] !== undefined && cortes[e.id] <= t).map((e) => e.id);
  return { camaras, caidos, fallos: activos };
}

const servicios = (n: number) => `${n} ${n === 1 ? "servicio" : "servicios"}`;

/** Lo que ha pasado entre dos fotos. No repite lo que ya estaba pasando en la primera. */
export function novedades(antes: Foto, ahora: Foto, t: number, fallos: FalloTipico[]): Noti[] {
  const lista: Omit<Noti, "leida">[] = [];
  const equipo = (id: string) => (id === PASARELA.id ? PASARELA.nombre : (AUTOMATAS.find((a) => a.id === id)?.nombre ?? id));
  const alcance = (id: string) => (id === PASARELA.id ? CAMARAS.length : (AUTOMATAS.find((a) => a.id === id)?.camaras.length ?? 0));

  for (const id of ahora.caidos) {
    if (antes.caidos.includes(id)) continue;
    lista.push({ id: `conexion:${id}:${t}`, cuando: t, tipo: "conexion", titulo: `${equipo(id)} sin conexión`, texto: `${servicios(alcance(id))} sin datos. La última temperatura puede no ser la de ahora.`, href: "/conexiones" });
  }
  for (const id of antes.caidos) {
    if (ahora.caidos.includes(id)) continue;
    lista.push({ id: `vuelve:${id}:${t}`, cuando: t, tipo: "recuperado", titulo: `${equipo(id)} vuelve a contestar`, texto: "Las lecturas llegan otra vez.", href: "/conexiones" });
  }

  for (const c of CAMARAS) {
    const a = antes.camaras[c.id]?.estado;
    const b = ahora.camaras[c.id];
    if (!a || !b || a === b.estado) continue;
    const href = `/servicios/${c.id}`;
    if (b.estado === "error") lista.push({ id: `alarma:${c.id}:${t}`, cuando: t, tipo: "alarma", titulo: `Alarma en ${c.nombre}`, texto: b.motivo, href });
    else if (b.estado === "aviso" && a === "correcto") lista.push({ id: `aviso:${c.id}:${t}`, cuando: t, tipo: "aviso", titulo: `Aviso en ${c.nombre}`, texto: b.motivo, href });
    else if (b.estado === "correcto" && (a === "error" || a === "aviso")) lista.push({ id: `bien:${c.id}:${t}`, cuando: t, tipo: "recuperado", titulo: `${c.nombre} vuelve a estar bien`, texto: a === "error" ? "La alarma se ha resuelto." : "El aviso se ha resuelto.", href });
  }

  for (const clave of ahora.fallos) {
    if (antes.fallos.includes(clave)) continue;
    const [falloId, camaraId] = clave.split("|");
    const f = fallos.find((x) => x.id === falloId);
    const c = CAMARAS.find((x) => x.id === camaraId);
    if (!f || !c) continue;
    const orden = f.orden === "ninguna" ? "" : ` Orden prevista: ${ORDENES[f.orden].toLowerCase()}.`;
    lista.push({ id: `fallo:${clave}:${t}`, cuando: t, tipo: "fallo", titulo: `${f.nombre} en ${c.nombre}`, texto: `${f.revisar}${orden}`, href: `/servicios/${c.id}` });
  }

  return lista.map((n) => ({ ...n, leida: false }));
}

/** Añade las nuevas arriba, sin duplicar y sin pasar del máximo. */
export function apilar(actuales: Noti[], nuevas: Noti[]): Noti[] {
  const vistos = new Set(actuales.map((n) => n.id));
  return [...nuevas.filter((n) => !vistos.has(n.id)).reverse(), ...actuales].slice(0, MAXIMO);
}
