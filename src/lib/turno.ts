// Turnos, relevo y ronda diaria. Los horarios y los puntos de la ronda son de
// ejemplo: cada nave pondría los suyos.

export type Turno = { nombre: string; desde: number; hasta: number };
const HORAS = [
  { nombre: "Turno de mañana", de: 6, a: 14 },
  { nombre: "Turno de tarde", de: 14, a: 22 },
  { nombre: "Turno de noche", de: 22, a: 30 },
];

/** El turno en el que cae el instante `t`, con su inicio y su fin. La noche cruza la medianoche. */
export function turnoDe(t: number): Turno {
  const d = new Date(t);
  const h = d.getHours();
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (h < 6 ? 1 : 0)).getTime();
  const hh = h < 6 ? h + 24 : h;
  const x = HORAS.find((q) => hh >= q.de && hh < q.a) ?? HORAS[0];
  return { nombre: x.nombre, desde: base + x.de * 3_600_000, hasta: base + x.a * 3_600_000 };
}

export const PUNTOS_RONDA = ["Gomas y cierres de las puertas", "Hielo en los evaporadores", "Desagües de desescarche", "Cortinas del muelle", "Ruidos o vibraciones en la sala de máquinas", "Género bien colocado, sin tapar la salida de aire"];

/** Lo que alguien ha mirado a mano en un punto de la ronda. */
export type Marca = { ok: boolean; nota: string; cuando: number };
export type Relevo = { id: string; cuando: number; quien: string; turno: string; resumen: string };

export const fechaLocal = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type Avance = { hechos: number; total: number; aMirar: number };
export function avanceRonda(puntos: string[], marcas: Record<string, Marca> | undefined): Avance {
  const m = marcas ?? {};
  return { hechos: puntos.filter((p) => m[p]).length, total: puntos.length, aMirar: puntos.filter((p) => m[p] && !m[p].ok).length };
}

/** Sin acentos ni mayúsculas, para buscar sin preocuparse de cómo se escribe. */
export const llano = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export type Hallazgo = { grupo: string; titulo: string; detalle: string; href: string };
/** Los hallazgos cuyo título o detalle contienen todas las palabras buscadas. */
export function buscar(todo: Hallazgo[], consulta: string): Hallazgo[] {
  const palabras = llano(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  return todo.filter((h) => {
    const texto = llano(`${h.titulo} ${h.detalle} ${h.grupo}`);
    return palabras.every((p) => texto.includes(p));
  });
}
