// Sistema: una lista de comprobaciones de toda la cadena, de la sonda al
// teléfono de quien está de guardia. Cada una dice si está bien, si hay que
// mirarla o si falla, y a dónde ir. Lo que hoy es simulado se dice como tal:
// no cuenta ni como bien ni como mal.

import type { Permiso } from "./dispositivo";

export type Nivel = "bien" | "mirar" | "mal" | "simulado";
export type Grupo = "cadena" | "avisar" | "dispositivo" | "pendiente";
export type Comprobacion = { id: string; grupo: Grupo; nivel: Nivel; titulo: string; detalle: string; href?: string };

export const GRUPOS: Record<Grupo, { titulo: string; detalle: string }> = {
  cadena: { titulo: "De la instalación al programa", detalle: "Por dónde llegan las lecturas" },
  avisar: { titulo: "Avisar a las personas", detalle: "Que una alarma llegue a alguien" },
  dispositivo: { titulo: "Este dispositivo", detalle: "Lo que depende de tu ordenador o tu móvil" },
  pendiente: { titulo: "Trabajo pendiente", detalle: "Lo que está esperando a alguien" },
};

export type Entrada = {
  fuente: { nombre: string; simulada: boolean };
  pasarelaCaida: boolean;
  automatas: number;
  automatasCaidos: number;
  servicios: number;
  serviciosMudos: number;
  /** Segundos desde la última lectura que llegó. */
  ultimaLecturaS: number;
  sondeoS: number;
  precio: { real: boolean; leido: number | null };
  /** null mientras no se ha preguntado; `ms` null si no contesta. */
  servidor: { ms: number | null; desfaseS: number | null } | null;
  enLinea: boolean;
  guardado: boolean;
  permiso: Permiso;
  trabajador: boolean | null;
  tiposActivos: number;
  tiposTotales: number;
  guardias: number;
  esperaMin: number;
  alarmas: number;
  alarmasNuevas: number;
  revisionesVencidas: number;
  ordenesAbiertas: number;
  ordenesAtrasadas: number;
  fallos: number;
  fallosAuto: number;
  horaTexto: (t: number) => string;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function comprobaciones(e: Entrada): Comprobacion[] {
  const out: Comprobacion[] = [];
  const pon = (c: Comprobacion) => out.push(c);

  pon({
    id: "fuente", grupo: "cadena", nivel: e.fuente.simulada ? "simulado" : "bien", titulo: "Origen de los datos",
    detalle: e.fuente.simulada ? "Simulación. No hay ninguna instalación conectada: temperaturas, puertas y compresores son de demostración." : `Llegan de ${e.fuente.nombre}.`,
  });
  pon({
    id: "pasarela", grupo: "cadena", nivel: e.pasarelaCaida ? "mal" : "bien", titulo: "Pasarela de la nave", href: "/conexiones",
    detalle: e.pasarelaCaida ? "No responde. Sin ella no llega nada de ningún autómata." : "Responde.",
  });
  const autoBien = e.pasarelaCaida ? 0 : e.automatas - e.automatasCaidos;
  pon({
    id: "automatas", grupo: "cadena", nivel: autoBien === e.automatas ? "bien" : "mal", titulo: "Autómatas", href: "/conexiones",
    detalle: `${autoBien} de ${e.automatas} conectados.${autoBien < e.automatas && !e.pasarelaCaida ? " Revisar alimentación y cable del que falta." : ""}`,
  });
  pon({
    id: "servicios", grupo: "cadena", nivel: e.serviciosMudos ? "mal" : "bien", titulo: "Servicios con datos", href: "/servicios",
    detalle: e.serviciosMudos ? `${plural(e.serviciosMudos, "servicio no manda", "servicios no mandan")} datos. Lo que se ve de ellos es la última lectura.` : `Los ${e.servicios} mandan datos.`,
  });
  const tarde = e.ultimaLecturaS > e.sondeoS * 3;
  pon({
    id: "ritmo", grupo: "cadena", nivel: e.serviciosMudos === e.servicios ? "mal" : tarde ? "mirar" : "bien", titulo: "Lecturas al día", href: "/conexiones",
    detalle: e.serviciosMudos === e.servicios ? "No llega ninguna lectura." : `Última lectura hace ${e.ultimaLecturaS} s. Se lee cada ${e.sondeoS} s.`,
  });
  pon({
    id: "precio", grupo: "cadena", nivel: e.precio.real ? "bien" : "mirar", titulo: "Precio de la luz", href: "/luz",
    detalle: e.precio.real ? `Real: PVPC de Red Eléctrica${e.precio.leido ? `, leído a las ${e.horaTexto(e.precio.leido)}` : ""}.` : "No se ha podido leer el de Red Eléctrica. El plan de luz usa un precio simulado.",
  });
  pon({
    id: "servidor", grupo: "cadena", nivel: e.servidor === null ? "mirar" : e.servidor.ms === null ? "mal" : e.servidor.ms > 2000 ? "mirar" : "bien", titulo: "Servidor de Gradiox",
    detalle: e.servidor === null ? "Preguntando…" : e.servidor.ms === null ? "No contesta. Puede ser tu conexión o el servidor." : `Contesta en ${e.servidor.ms} ms.`,
  });

  const permisos: Record<Permiso, [Nivel, string]> = {
    granted: ["bien", "Este dispositivo deja mostrar notificaciones."],
    default: ["mirar", "Aún no se ha dado permiso para notificar en este dispositivo."],
    denied: ["mal", "Las notificaciones están bloqueadas en este navegador. Se cambia en los ajustes del sitio."],
    sinsoporte: ["mirar", "Este navegador no sabe mostrar notificaciones. En iPhone hay que añadir Gradiox a la pantalla de inicio."],
  };
  pon({ id: "permiso", grupo: "avisar", nivel: permisos[e.permiso][0], titulo: "Notificaciones en este dispositivo", detalle: permisos[e.permiso][1], href: "/notificaciones" });
  pon({
    id: "tipos", grupo: "avisar", nivel: e.tiposActivos === 0 ? "mal" : "bien", titulo: "Qué se notifica", href: "/notificaciones",
    detalle: e.tiposActivos === 0 ? "Todo está apagado: no interrumpiría ni una alarma." : `${e.tiposActivos} de ${e.tiposTotales} clases de aviso activadas.`,
  });
  pon({
    id: "guardias", grupo: "avisar", nivel: e.guardias === 0 ? "mal" : "simulado", titulo: "Guardias y escalado", href: "/notificaciones",
    detalle: e.guardias === 0 ? "No hay nadie en la lista de guardias." : `${plural(e.guardias, "puesto", "puestos")} en la cadena, ${e.esperaMin} min de espera entre uno y otro. Simulado: hoy no se manda ningún SMS ni se llama a nadie.`,
  });
  pon({ id: "cerrada", grupo: "avisar", nivel: "mirar", titulo: "Avisos con Gradiox cerrado", detalle: "No llegan. Hace falta un servidor que vigile cuando nadie tiene el programa abierto; es lo primero que pide una instalación real." });

  pon({ id: "linea", grupo: "dispositivo", nivel: e.enLinea ? "bien" : "mal", titulo: "Conexión a internet", detalle: e.enLinea ? "Este dispositivo tiene conexión." : "Este dispositivo está sin conexión. Lo que ves puede estar parado." });
  const desfase = e.servidor?.desfaseS ?? null;
  pon({
    id: "reloj", grupo: "dispositivo", nivel: desfase === null ? "mirar" : Math.abs(desfase) > 120 ? "mal" : Math.abs(desfase) > 30 ? "mirar" : "bien", titulo: "Reloj",
    detalle: desfase === null ? "Sin comparar todavía con el del servidor." : Math.abs(desfase) <= 2 ? "Va con el del servidor." : `Va ${Math.abs(desfase)} s ${desfase > 0 ? "adelantado" : "atrasado"} respecto al servidor.${Math.abs(desfase) > 30 ? " Las horas de avisos y lecturas saldrían movidas." : ""}`,
  });
  pon({ id: "guardado", grupo: "dispositivo", nivel: e.guardado ? "bien" : "mirar", titulo: "Memoria del navegador", detalle: e.guardado ? "Guarda ajustes, notificaciones y lo apuntado en este dispositivo." : "No se puede guardar: al cerrar se pierde lo cambiado. Pasa en ventanas privadas." });
  pon({
    id: "trabajador", grupo: "dispositivo", nivel: e.trabajador ? "bien" : "mirar", titulo: "Avisos en segundo plano", href: "/notificaciones",
    detalle: e.trabajador === null ? "Comprobando…" : e.trabajador ? "Preparado para avisar con la pestaña en segundo plano." : "Sin preparar. Se activa al dar permiso de notificaciones.",
  });

  pon({
    id: "alarmas", grupo: "pendiente", nivel: e.alarmas ? "mal" : "bien", titulo: "Alarmas", href: "/avisos",
    detalle: e.alarmas ? `${plural(e.alarmas, "servicio en alarma", "servicios en alarma")} ahora mismo.` : "Ningún servicio en alarma.",
  });
  pon({
    id: "nuevas", grupo: "pendiente", nivel: e.alarmasNuevas ? "mirar" : "bien", titulo: "Alarmas sin mirar", href: "/avisos",
    detalle: e.alarmasNuevas ? `${plural(e.alarmasNuevas, "alarma de las últimas 24 horas", "alarmas de las últimas 24 horas")} que nadie ha marcado como vista.` : "Todas las de las últimas 24 horas están vistas.",
  });
  pon({
    id: "revisiones", grupo: "pendiente", nivel: e.revisionesVencidas ? "mirar" : "bien", titulo: "Revisiones de mantenimiento", href: "/mantenimiento",
    detalle: e.revisionesVencidas ? `${plural(e.revisionesVencidas, "revisión vencida", "revisiones vencidas")}.` : "Ninguna vencida.",
  });
  pon({
    id: "ordenes", grupo: "pendiente", nivel: e.ordenesAtrasadas ? "mirar" : "bien", titulo: "Órdenes de trabajo", href: "/mantenimiento",
    detalle: e.ordenesAtrasadas ? `${plural(e.ordenesAtrasadas, "orden atrasada", "órdenes atrasadas")} de ${e.ordenesAbiertas} abiertas.` : e.ordenesAbiertas ? `${plural(e.ordenesAbiertas, "abierta", "abiertas")}, ninguna atrasada.` : "Ninguna abierta.",
  });
  pon({
    id: "fallos", grupo: "pendiente", nivel: e.fallos ? "bien" : "mirar", titulo: "Fallos típicos", href: "/avisos/fallos",
    detalle: e.fallos ? `${plural(e.fallos, "fallo vigilado", "fallos vigilados")}; ${e.fallosAuto ? `${e.fallosAuto} con orden automática` : "ninguno con orden automática"}.` : "La lista está vacía: el programa no reconoce ningún fallo conocido.",
  });
  return out;
}

export type Resumen = { nivel: Exclude<Nivel, "simulado">; bien: number; mirar: number; mal: number; cuentan: number };
/** Lo simulado no cuenta. */
export function resumen(lista: Comprobacion[]): Resumen {
  const n = (x: Nivel) => lista.filter((c) => c.nivel === x).length;
  const mal = n("mal");
  const mirar = n("mirar");
  return { nivel: mal ? "mal" : mirar ? "mirar" : "bien", bien: n("bien"), mirar, mal, cuentan: lista.length - n("simulado") };
}
