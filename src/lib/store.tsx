"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { registroInicial, type FichaEquipo, type Intervencion, type OrdenTrabajo } from "./equipos";
import type { Corte } from "./conexiones";
import { PUNTOS_RONDA, type Marca, type Relevo } from "./turno";
import type { Recepcion } from "./recepcion";
import { FALLOS_INICIALES, ORDENES, type FalloTipico, type OrdenDada } from "./fallos";
import { GUARDIAS_INICIALES, type Guardia } from "./guardias";
import { usarPreciosReales } from "./luz";
import { PREFERENCIAS_INICIALES, apilar, type Noti, type Preferencias } from "./notificaciones";
import { AJUSTES_INICIALES, CAMARAS, type Ajustes, type Averia } from "./datos";

/** Quién lleva una alarma y cómo se cerró. Simulado: lo apunta quien usa la pantalla. */
export type Seguimiento = { quien?: string; desde?: number; resuelta?: number; causa?: string };
/** Algo que conviene saber de un servicio y no es una avería. */
export type NotaServicio = { id: string; cuando: number; texto: string };
export type EstadoAlarma = "nueva" | "vista" | "curso" | "resuelta";
export const estadoAlarma = (vista: number | undefined, s: Seguimiento | undefined): EstadoAlarma => (s?.resuelta ? "resuelta" : s?.quien ? "curso" : vista ? "vista" : "nueva");

/** `atendidas` guarda cuándo se atendió cada alarma, por cámara e instante de inicio. */
type Guardado = { ajustes: Ajustes; registro: Intervencion[] | null; atendidas: Record<string, number>; fallos: FalloTipico[] | null; notis: Noti[]; preferencias: Preferencias; ordenes: OrdenDada[]; refuerzos: Record<string, number | null>; guardias: Guardia[]; esperaMin: number; seguimientos: Record<string, Seguimiento>; trabajos: OrdenTrabajo[]; cortesPasados: Corte[]; fichas: Record<string, FichaEquipo>; notas: Record<string, NotaServicio[]>; relevos: Relevo[]; rondas: Record<string, Record<string, Marca>>; puntosRonda: string[] | null; recepciones: Recepcion[] };
const INICIAL: Guardado = { ajustes: AJUSTES_INICIALES, registro: null, atendidas: {}, fallos: null, notis: [], preferencias: PREFERENCIAS_INICIALES, ordenes: [], refuerzos: {}, guardias: GUARDIAS_INICIALES, esperaMin: 10, seguimientos: {}, trabajos: [], cortesPasados: [], fichas: {}, notas: {}, relevos: [], rondas: {}, puntosRonda: null, recepciones: [] };
type Demo = {
  /** Instante actual; null hasta que la página se monta en el navegador. */
  ahora: number | null;
  ajustes: Ajustes;
  registro: Intervencion[];
  atendidas: Record<string, number>;
  atender: (clave: string) => void;
  /** Por alarma: quién la lleva, desde cuándo, y la causa al cerrarla. */
  seguimientos: Record<string, Seguimiento>;
  asignar: (clave: string, quien: string) => void;
  resolver: (clave: string, causa: string) => void;
  fallos: FalloTipico[];
  anadirFallo: (f: Omit<FalloTipico, "id">) => void;
  quitarFallo: (id: string) => void;
  /** `haceMin` adelanta la avería, para que la demostración no tenga que esperar. */
  simularAveria: (camaraId: string, tipo: Averia["tipo"], haceMin?: number) => void;
  quitarAveria: (camaraId: string) => void;
  cambiarConsigna: (camaraId: string, valor: number) => void;
  activarPlan: (activo: boolean) => void;
  cortarConexion: (id: string) => void;
  restablecerConexion: (id: string) => void;
  apuntar: (i: Omit<Intervencion, "id">) => void;
  /** Órdenes de trabajo de mantenimiento, la más nueva primero. */
  trabajos: OrdenTrabajo[];
  crearTrabajo: (o: Omit<OrdenTrabajo, "id" | "creada" | "cerrada">) => void;
  /** Cierra la orden y la apunta en el libro de intervenciones. */
  cerrarTrabajo: (id: string, nota: string, fecha: string) => void;
  /** Datos de placa por equipo, escritos a mano. */
  fichas: Record<string, FichaEquipo>;
  guardarFicha: (equipoId: string, f: FichaEquipo) => void;
  /** Notas por servicio, la más nueva primero. */
  notas: Record<string, NotaServicio[]>;
  anotarServicio: (camaraId: string, texto: string) => void;
  borrarNota: (camaraId: string, id: string) => void;
  /** Relevos de turno dados, el último primero. */
  recepciones: Recepcion[];
  apuntarRecepcion: (r: Omit<Recepcion, "id" | "cuando">) => void;
  borrarRecepcion: (id: string) => void;
  relevos: Relevo[];
  darRelevo: (quien: string, turno: string, resumen: string) => void;
  /** Ronda diaria: por fecha (AAAA-MM-DD), lo marcado en cada punto. */
  rondas: Record<string, Record<string, Marca>>;
  puntosRonda: string[];
  marcarRonda: (fecha: string, punto: string, ok: boolean, nota?: string) => void;
  anadirPunto: (punto: string) => void;
  quitarPunto: (punto: string) => void;
  /** Cortes de conexión ya terminados, el más reciente primero. */
  cortesPasados: Corte[];
  notis: Noti[];
  preferencias: Preferencias;
  /** Órdenes dadas al autómata, la última primero. */
  ordenes: OrdenDada[];
  /** Servicios con la consigna reforzada por una orden, y la consigna que tenían. */
  refuerzos: Record<string, number | null>;
  /** A quién se avisa, por orden, y cuántos minutos se espera antes de pasar al siguiente. */
  guardias: Guardia[];
  esperaMin: number;
  cambiarGuardia: (id: string, cambio: Partial<Guardia>) => void;
  cambiarEspera: (min: number) => void;
  /** true cuando el precio de la luz de hoy es el real y no el simulado. */
  precioReal: boolean;
  /** Cuándo se leyó por última vez el precio real. null si no se ha conseguido. */
  precioLeido: number | null;
  /** true cuando ya se conoce el precio real de mañana. */
  precioManana: boolean;
  ordenar: (falloId: string, camaraId: string, auto?: boolean) => void;
  quitarRefuerzo: (camaraId: string) => void;
  automatizar: (falloId: string, auto: boolean) => void;
  anotar: (nuevas: Noti[]) => void;
  marcarLeidas: (id?: string) => void;
  vaciarNotis: () => void;
  preferir: (cambio: Partial<Preferencias>) => void;
  reiniciar: () => void;
};

const CLAVE = "gradiox-demo-v1";
const Contexto = createContext<Demo | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [estado, setEstado] = useState<Guardado>(INICIAL);
  const [precioReal, setPrecioReal] = useState(false);
  const [precioLeido, setPrecioLeido] = useState<number | null>(null);
  const [precioManana, setPrecioManana] = useState(false);

  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE);
      if (crudo) setEstado({ ...INICIAL, ...(JSON.parse(crudo) as Partial<Guardado>) });
    } catch {
      // Sin almacenamiento la demo funciona igual, solo que no recuerda.
    }
    setAhora(Date.now());
    // El precio real de hoy, si se consigue. Si no, se queda el simulado.
    // En la entrada aún no hay sesión, así que no se pide. Se vuelve a leer
    // cada media hora: así entra solo el del día siguiente.
    const pedir = (ruta: string) =>
      fetch(ruta)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { dia?: string; valores?: number[] } | null) => {
          if (!d?.dia || !Array.isArray(d.valores) || d.valores.length !== 24) return false;
          usarPreciosReales(d.dia, d.valores);
          return true;
        })
        .catch(() => false);
    const leerPrecio = async () => {
      if (["/login", "/presentacion"].includes(window.location.pathname)) return;
      if (await pedir("/api/precio")) {
        setPrecioReal(true);
        setPrecioLeido(Date.now());
        setAhora(Date.now() + 2);
      }
      // El de mañana sale por la tarde; antes de eso no hay nada que leer.
      if (new Date().getHours() >= 13) setPrecioManana(await pedir("/api/precio?dia=manana"));
      else setPrecioManana(false);
    };
    void leerPrecio();
    const cadaMedia = window.setInterval(leerPrecio, 30 * 60_000);
    const id = window.setInterval(() => setAhora(Date.now()), 2000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(cadaMedia);
    };
  }, []);

  const guardar = useCallback((cambio: (g: Guardado) => Guardado) => {
    setEstado((previo) => {
      const nuevo = cambio(previo);
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
      } catch {
        // Ver arriba.
      }
      return nuevo;
    });
  }, []);

  const valor = useMemo<Demo>(() => {
    const registro = estado.registro ?? registroInicial(ahora ?? 0);
    const fallos = estado.fallos ?? FALLOS_INICIALES;
    const conAjustes = (f: (a: Ajustes) => Ajustes) => {
      guardar((g) => ({ ...g, ajustes: f(g.ajustes) }));
      // Que el cambio se vea al momento, sin esperar al siguiente tic.
      setAhora(Date.now() + 1);
    };
    return {
      ahora,
      ajustes: estado.ajustes,
      registro,
      atendidas: estado.atendidas,
      fallos,
      anadirFallo: (f) => guardar((g) => ({ ...g, fallos: [...(g.fallos ?? FALLOS_INICIALES), { ...f, id: `f${Date.now()}` }] })),
      quitarFallo: (id) => guardar((g) => ({ ...g, fallos: (g.fallos ?? FALLOS_INICIALES).filter((f) => f.id !== id) })),
      atender: (clave) => guardar((g) => ({ ...g, atendidas: { ...g.atendidas, [clave]: Date.now() } })),
      seguimientos: estado.seguimientos ?? {},
      asignar: (clave, quien) =>
        guardar((g) => ({ ...g, atendidas: { ...g.atendidas, [clave]: g.atendidas[clave] ?? Date.now() }, seguimientos: { ...(g.seguimientos ?? {}), [clave]: { ...(g.seguimientos ?? {})[clave], quien, desde: Date.now() } } })),
      resolver: (clave, causa) =>
        guardar((g) => ({ ...g, atendidas: { ...g.atendidas, [clave]: g.atendidas[clave] ?? Date.now() }, seguimientos: { ...(g.seguimientos ?? {}), [clave]: { ...(g.seguimientos ?? {})[clave], resuelta: Date.now(), causa } } })),
      simularAveria: (id, tipo, haceMin = 0) => conAjustes((a) => ({ ...a, averias: { ...a.averias, [id]: { tipo, desde: Date.now() - haceMin * 60_000 } } })),
      quitarAveria: (id) =>
        conAjustes((a) => {
          const averias = { ...a.averias };
          delete averias[id];
          return { ...a, averias };
        }),
      cambiarConsigna: (id, v) => conAjustes((a) => ({ ...a, consignas: { ...a.consignas, [id]: v } })),
      activarPlan: (activo) => conAjustes((a) => ({ ...a, planActivo: activo })),
      cortarConexion: (id) => conAjustes((a) => ({ ...a, cortes: { ...(a.cortes ?? {}), [id]: Date.now() } })),
      restablecerConexion: (id) => {
        guardar((g) => {
          const cortes = { ...(g.ajustes.cortes ?? {}) };
          const desde = cortes[id];
          if (desde === undefined) return g;
          delete cortes[id];
          const hasta = Date.now();
          return { ...g, ajustes: { ...g.ajustes, cortes }, cortesPasados: [{ id: `k${hasta}`, equipoId: id, desde, hasta }, ...(g.cortesPasados ?? [])].slice(0, 50) };
        });
        setAhora(Date.now() + 1);
      },
      trabajos: estado.trabajos ?? [],
      crearTrabajo: (o) => guardar((g) => ({ ...g, trabajos: [{ ...o, id: `t${Date.now()}`, creada: Date.now() }, ...(g.trabajos ?? [])] })),
      cerrarTrabajo: (id, nota, fecha) =>
        guardar((g) => {
          const o = (g.trabajos ?? []).find((x) => x.id === id);
          if (!o || o.cerrada) return g;
          const hecho: Intervencion = { id: `i${Date.now()}`, equipoId: o.equipoId, fecha, tipo: o.tipo, nota: `${o.tarea}${nota ? ` ${nota}` : ""}`, tecnico: o.tecnico || "Sin indicar" };
          return { ...g, trabajos: (g.trabajos ?? []).map((x) => (x.id === id ? { ...x, cerrada: { cuando: Date.now(), nota } } : x)), registro: [hecho, ...(g.registro ?? registroInicial(Date.now()))] };
        }),
      cortesPasados: estado.cortesPasados ?? [],
      recepciones: estado.recepciones ?? [],
      apuntarRecepcion: (r) => guardar((g) => ({ ...g, recepciones: [{ ...r, id: `e${Date.now()}`, cuando: Date.now() }, ...(g.recepciones ?? [])].slice(0, 200) })),
      borrarRecepcion: (id) => guardar((g) => ({ ...g, recepciones: (g.recepciones ?? []).filter((r) => r.id !== id) })),
      relevos: estado.relevos ?? [],
      darRelevo: (quien, turno, resumen) => guardar((g) => ({ ...g, relevos: [{ id: `r${Date.now()}`, cuando: Date.now(), quien, turno, resumen }, ...(g.relevos ?? [])].slice(0, 30) })),
      rondas: estado.rondas ?? {},
      puntosRonda: estado.puntosRonda ?? PUNTOS_RONDA,
      marcarRonda: (fecha, punto, ok, nota = "") => guardar((g) => ({ ...g, rondas: { ...(g.rondas ?? {}), [fecha]: { ...((g.rondas ?? {})[fecha] ?? {}), [punto]: { ok, nota, cuando: Date.now() } } } })),
      anadirPunto: (punto) => guardar((g) => ((g.puntosRonda ?? PUNTOS_RONDA).includes(punto) ? g : { ...g, puntosRonda: [...(g.puntosRonda ?? PUNTOS_RONDA), punto] })),
      quitarPunto: (punto) => guardar((g) => ({ ...g, puntosRonda: (g.puntosRonda ?? PUNTOS_RONDA).filter((p) => p !== punto) })),
      fichas: estado.fichas ?? {},
      guardarFicha: (equipoId, f) => guardar((g) => ({ ...g, fichas: { ...(g.fichas ?? {}), [equipoId]: f } })),
      notas: estado.notas ?? {},
      anotarServicio: (camaraId, texto) => guardar((g) => ({ ...g, notas: { ...(g.notas ?? {}), [camaraId]: [{ id: `n${Date.now()}`, cuando: Date.now(), texto }, ...((g.notas ?? {})[camaraId] ?? [])].slice(0, 30) } })),
      borrarNota: (camaraId, id) => guardar((g) => ({ ...g, notas: { ...(g.notas ?? {}), [camaraId]: ((g.notas ?? {})[camaraId] ?? []).filter((n) => n.id !== id) } })),
      apuntar: (i) => guardar((g) => ({ ...g, registro: [{ ...i, id: `i${Date.now()}` }, ...(g.registro ?? registroInicial(Date.now()))] })),
      guardias: estado.guardias ?? GUARDIAS_INICIALES,
      esperaMin: estado.esperaMin ?? 10,
      cambiarGuardia: (id, cambio) => guardar((g) => ({ ...g, guardias: (g.guardias ?? GUARDIAS_INICIALES).map((x) => (x.id === id ? { ...x, ...cambio } : x)) })),
      cambiarEspera: (min) => guardar((g) => ({ ...g, esperaMin: Math.min(120, Math.max(1, Math.round(min) || 10)) })),
      precioReal,
      precioLeido,
      precioManana,
      ordenes: estado.ordenes ?? [],
      refuerzos: estado.refuerzos ?? {},
      automatizar: (falloId, auto) => guardar((g) => ({ ...g, fallos: (g.fallos ?? FALLOS_INICIALES).map((f) => (f.id === falloId ? { ...f, auto } : f)) })),
      quitarRefuerzo: (camaraId) => {
        guardar((g) => {
          const refuerzos = { ...(g.refuerzos ?? {}) };
          if (!(camaraId in refuerzos)) return g;
          const previa = refuerzos[camaraId];
          delete refuerzos[camaraId];
          const consignas = { ...g.ajustes.consignas };
          if (previa === null) delete consignas[camaraId];
          else consignas[camaraId] = previa;
          return { ...g, refuerzos, ajustes: { ...g.ajustes, consignas } };
        });
        setAhora(Date.now() + 1);
      },
      ordenar: (falloId, camaraId, auto = false) => {
        guardar((g) => {
          const f = (g.fallos ?? FALLOS_INICIALES).find((x) => x.id === falloId);
          const c = CAMARAS.find((x) => x.id === camaraId);
          if (!f || !c || f.orden === "ninguna") return g;
          const t = Date.now();
          const aj = { ...g.ajustes, averias: { ...g.ajustes.averias }, consignas: { ...g.ajustes.consignas } };
          let refuerzos = g.refuerzos ?? {};
          let resultado = "";
          const averia = aj.averias[camaraId];
          if (f.orden === "rearme") {
            if (averia?.tipo === "compresor") delete aj.averias[camaraId];
            resultado = averia?.tipo === "compresor" ? "El compresor vuelve a marchar." : "No había nada que rearmar.";
          } else if (f.orden === "avisador") {
            if (averia?.tipo === "puerta") delete aj.averias[camaraId];
            resultado = averia?.tipo === "puerta" ? "Suena el avisador y se cierra la puerta." : "Suena el avisador de la puerta.";
          } else if (f.orden === "reforzar") {
            if (camaraId in refuerzos) resultado = "La consigna ya estaba reforzada.";
            else {
              const previa = aj.consignas[camaraId] ?? null;
              aj.consignas[camaraId] = (previa ?? c.consigna) - 2;
              refuerzos = { ...refuerzos, [camaraId]: previa };
              resultado = "Consigna 2 °C más baja hasta que pase.";
            }
          } else {
            aj.desescarches = { ...(aj.desescarches ?? {}), [camaraId]: t };
            resultado = "Desescarche extra en marcha.";
          }
          const dada: OrdenDada = { id: `o${t}`, cuando: t, camaraId, falloId, fallo: f.nombre, orden: f.orden, resultado, auto };
          const noti: Noti = { id: `orden:${dada.id}:${camaraId}`, cuando: t, tipo: "orden", titulo: `${auto ? "El autómata actúa" : "Orden enviada"} en ${c.nombre}`, texto: `${ORDENES[f.orden]}. ${resultado}`, href: `/servicios/${camaraId}`, leida: false };
          return { ...g, ajustes: aj, refuerzos, ordenes: [dada, ...(g.ordenes ?? [])].slice(0, 40), notis: apilar(g.notis ?? [], [noti]) };
        });
        setAhora(Date.now() + 1);
      },
      notis: estado.notis,
      preferencias: { ...PREFERENCIAS_INICIALES, ...estado.preferencias },
      anotar: (nuevas) => guardar((g) => ({ ...g, notis: apilar(g.notis ?? [], nuevas) })),
      marcarLeidas: (id) => guardar((g) => ({ ...g, notis: (g.notis ?? []).map((n) => (id === undefined || n.id === id ? { ...n, leida: true } : n)) })),
      vaciarNotis: () => guardar((g) => ({ ...g, notis: [] })),
      preferir: (cambio) => guardar((g) => ({ ...g, preferencias: { ...PREFERENCIAS_INICIALES, ...g.preferencias, ...cambio } })),
      reiniciar: () => guardar(() => INICIAL),
    };
  }, [ahora, estado, guardar, precioReal, precioLeido, precioManana]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDemo(): Demo {
  const d = useContext(Contexto);
  if (!d) throw new Error("useDemo se usa dentro de DemoProvider");
  return d;
}
