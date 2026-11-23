// Las partes de la ficha de un cliente en ops. La ficha técnica es una más:
// vive en su propia dirección, pero se ve y se elige como pestaña del cliente.

export type Pestana = "resumen" | "datos" | "instalaciones" | "app" | "historial";
export const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "datos", texto: "Datos y visita" },
  { id: "instalaciones", texto: "Instalaciones y cámaras" },
  { id: "app", texto: "Acceso a la app" },
  { id: "historial", texto: "Historial" },
];

/** Los nombres de antes (enlaces guardados, la hoja de ruta) llevan a la pestaña donde está ahora lo suyo. */
const ANTES: Record<string, Pestana> = { empresa: "datos", visita: "datos", instalacion: "instalaciones", seguimiento: "resumen" };

export function pestanaPedida(x: string | null): Pestana | null {
  if (!x) return null;
  if (PESTANAS.some((p) => p.id === x)) return x as Pestana;
  return ANTES[x] ?? null;
}

/** En qué pestaña se rellena lo que falta de cada paso del alta. */
export const PESTANA_DE_FALTA: Record<"empresa" | "instalacion" | "visita", Pestana> = { empresa: "datos", visita: "datos", instalacion: "instalaciones" };
