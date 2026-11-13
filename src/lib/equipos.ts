// Equipos y registro de mantenimiento de la instalación de demostración.

import { CAMARAS } from "./datos";

export type Equipo = { id: string; camaraId: string; nombre: string; tipo: "Compresor" | "Evaporador" | "Central"; cadaDias: number; ultimaHaceDias: number };

export const EQUIPOS: Equipo[] = [
  { id: "central", camaraId: "", nombre: "Central frigorífica", tipo: "Central", cadaDias: 90, ultimaHaceDias: 96 },
  ...CAMARAS.flatMap((c, i): Equipo[] => [
    ...(c.sinCompresor ? [] : [{ id: `${c.id}-comp`, camaraId: c.id, nombre: `Compresor de ${c.nombre}`, tipo: "Compresor" as const, cadaDias: 90, ultimaHaceDias: 20 + i * 14 }]),
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

/** Una tarea de mantenimiento con dueño y fecha. Al cerrarla pasa al libro de intervenciones. */
export type OrdenTrabajo = { id: string; equipoId: string; tipo: Intervencion["tipo"]; tarea: string; tecnico: string; fecha: string; creada: number; cerrada?: { cuando: number; nota: string } };

export type CitaTipo = "revision" | "orden" | "hecho";
/** Algo que cae en un día del calendario. */
export type Cita = { fecha: string; tipo: CitaTipo; titulo: string; detalle: string };

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Lo que cae en un mes (`mes` de 0 a 11): las revisiones que tocan, repitiendo
 * cada plazo, las órdenes de trabajo abiertas por su fecha prevista y lo ya
 * apuntado en el libro. Ordenado por fecha.
 */
export function citasDelMes(anio: number, mes: number, registro: Intervencion[], ordenes: OrdenTrabajo[], ahora: number): Cita[] {
  const desde = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  const hasta = `${anio}-${String(mes + 1).padStart(2, "0")}-31`;
  const dentro = (f: string) => f >= desde && f <= hasta;
  const out: Cita[] = [];
  for (const e of EQUIPOS) {
    let cuando = new Date(proxima(e, registro, ahora).fecha).getTime();
    // Una revisión atrasada no se repite hacia atrás: se enseña una vez, en su fecha.
    for (let i = 0; i < 40 && iso(cuando) <= hasta; i++, cuando += e.cadaDias * DIA) {
      if (dentro(iso(cuando))) out.push({ fecha: iso(cuando), tipo: "revision", titulo: e.nombre, detalle: `Revisión, cada ${e.cadaDias} días` });
    }
  }
  const nombre = (id: string) => EQUIPOS.find((e) => e.id === id)?.nombre ?? id;
  for (const o of ordenes) if (!o.cerrada && dentro(o.fecha)) out.push({ fecha: o.fecha, tipo: "orden", titulo: nombre(o.equipoId), detalle: `Orden de trabajo: ${o.tarea}${o.tecnico ? ` · ${o.tecnico}` : ""}` });
  for (const r of registro) if (dentro(r.fecha)) out.push({ fecha: r.fecha, tipo: "hecho", titulo: nombre(r.equipoId), detalle: `Hecho: ${r.tipo.toLowerCase()} · ${r.tecnico}` });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Las semanas de un mes, de lunes a domingo. Los huecos de otros meses van a null. */
export function semanasDelMes(anio: number, mes: number): (string | null)[][] {
  const dias = new Date(anio, mes + 1, 0).getDate();
  const hueco = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const celdas: (string | null)[] = [...Array<null>(hueco).fill(null)];
  for (let d = 1; d <= dias; d++) celdas.push(`${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (celdas.length % 7) celdas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}
