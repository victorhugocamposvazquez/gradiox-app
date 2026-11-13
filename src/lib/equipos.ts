// Equipos y registro de mantenimiento de la instalación de demostración.

import { CAMARAS } from "./datos";

export type Equipo = { id: string; camaraId: string; nombre: string; tipo: "Compresor" | "Evaporador" | "Central"; cadaDias: number; ultimaHaceDias: number };

export const EQUIPOS: Equipo[] = [
  { id: "central", camaraId: "", nombre: "Central frigorífica", tipo: "Central", cadaDias: 90, ultimaHaceDias: 96 },
  ...CAMARAS.flatMap((c, i): Equipo[] => [
    { id: `${c.id}-comp`, camaraId: c.id, nombre: `Compresor de ${c.nombre}`, tipo: "Compresor", cadaDias: 90, ultimaHaceDias: 20 + i * 14 },
    { id: `${c.id}-evap`, camaraId: c.id, nombre: `Evaporador de ${c.nombre}`, tipo: "Evaporador", cadaDias: 180, ultimaHaceDias: 60 + i * 21 },
  ]),
];

export type Intervencion = { id: string; equipoId: string; fecha: string; tipo: "Revisión" | "Avería" | "Control de fugas" | "Carga de refrigerante"; nota: string; tecnico: string };

const DIA = 86_400_000;
export const fechaHace = (ahora: number, dias: number) => new Date(ahora - dias * DIA).toISOString().slice(0, 10);

/** Registro de partida, con fechas relativas a hoy para que la demo no envejezca. */
export function registroInicial(ahora: number): Intervencion[] {
  return [
    { id: "i1", equipoId: "c2-evap", fecha: fechaHace(ahora, 9), tipo: "Avería", nota: "Hielo en el evaporador. Se limpia y se revisa la resistencia de desescarche.", tecnico: "Técnico de guardia" },
    { id: "i2", equipoId: "c1-comp", fecha: fechaHace(ahora, 20), tipo: "Revisión", nota: "Revisión trimestral sin incidencias.", tecnico: "Técnico de zona" },
    { id: "i3", equipoId: "central", fecha: fechaHace(ahora, 96), tipo: "Control de fugas", nota: "Sin fugas. Presiones dentro de lo normal.", tecnico: "Técnico de zona" },
  ];
}

export function proxima(e: Equipo, registro: Intervencion[], ahora: number): { dias: number; fecha: string } {
  const ultimas = registro.filter((r) => r.equipoId === e.id && r.tipo !== "Avería").map((r) => r.fecha).sort();
  const ultima = ultimas.length ? new Date(ultimas[ultimas.length - 1]).getTime() : ahora - e.ultimaHaceDias * DIA;
  const cuando = ultima + e.cadaDias * DIA;
  return { dias: Math.round((cuando - ahora) / DIA), fecha: new Date(cuando).toISOString().slice(0, 10) };
}
