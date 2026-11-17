// Lo que puede ver y cambiar quien abre el enlace de una ficha técnica desde
// fuera del panel: solo los datos técnicos de esa instalación. Nada del resto
// del cliente, ni notas internas, ni otros clientes.

import { INTERNET, type Cliente, type Foto, type Instalacion, type Internet } from "./modelo";
import { validarTecnica, type Tecnica } from "./tecnica";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Los datos de la ficha técnica que se pueden rellenar desde el enlace. */
export type TecnicaExterna = Pick<Tecnica, "gobierno" | "cpu" | "via" | "direccion" | "acceso" | "usuario" | "permiso" | "enchufar" | "senales" | "observaciones">;
export type FichaExterna = {
  empresa: string;
  instalacion: string;
  automata: string;
  programador: string;
  informatica: string;
  internet: Internet;
  tecnica: TecnicaExterna;
  camaras: { id: string; nombre: string }[];
};
export type CambiosExternos = Pick<FichaExterna, "automata" | "programador" | "informatica" | "internet" | "tecnica">;
export type DocumentoExterno = Pick<Foto, "id" | "pie" | "tamano" | "creada">;

const parte = (t: Tecnica): TecnicaExterna => ({ gobierno: t.gobierno, cpu: t.cpu, via: t.via, direccion: t.direccion, acceso: t.acceso, usuario: t.usuario, permiso: t.permiso, enchufar: t.enchufar, senales: t.senales, observaciones: t.observaciones });

export const instalacionDeEnlace = (c: Cliente, enlace: string): Instalacion | undefined => (enlace ? c.instalaciones.find((i) => i.tecnica.enlace === enlace) : undefined);

export const vistaExterna = (c: Cliente, i: Instalacion): FichaExterna => ({
  empresa: c.nombre,
  instalacion: i.nombre,
  automata: i.automata,
  programador: i.programador,
  informatica: i.informatica,
  internet: i.internet,
  tecnica: parte(i.tecnica),
  camaras: i.puntos.map((p, n) => ({ id: p.id, nombre: p.nombre || `Cámara ${n + 1}` })),
});

export const documentoExterno = (f: Foto): DocumentoExterno => ({ id: f.id, pie: f.pie, tamano: f.tamano, creada: f.creada });

/** Aplica a la instalación lo que llega del enlace. Todo lo demás se queda como estaba. */
export function aplicarExterno(i: Instalacion, cuerpo: unknown, t: number): Instalacion {
  const c = objeto(cuerpo);
  const nueva = validarTecnica(c.tecnica);
  const camaras = new Set(i.puntos.map((p) => p.id));
  return {
    ...i,
    automata: texto(c.automata, 240),
    programador: texto(c.programador, 240),
    informatica: texto(c.informatica, 240),
    internet: typeof c.internet === "string" && c.internet in INTERNET ? (c.internet as Internet) : i.internet,
    tecnica: { ...i.tecnica, ...parte(nueva), senales: nueva.senales.map((s) => (camaras.has(s.punto) ? s : { ...s, punto: "" })), externa: t },
  };
}

/**
 * Si desde el enlace se ha rellenado algo después de que el panel abriera la ficha,
 * lo del enlace no se pisa: se conserva lo guardado en esos datos.
 */
export function conservarExterno(enviada: Instalacion, guardada: Instalacion | undefined): { instalacion: Instalacion; desfasada: boolean } {
  if (!guardada || guardada.tecnica.externa <= enviada.tecnica.externa) return { instalacion: enviada, desfasada: false };
  return {
    desfasada: true,
    instalacion: { ...enviada, automata: guardada.automata, programador: guardada.programador, informatica: guardada.informatica, internet: guardada.internet, tecnica: { ...enviada.tecnica, ...parte(guardada.tecnica), externa: guardada.tecnica.externa } },
  };
}

export const MAX_DOCUMENTOS_ENLACE = 40;
