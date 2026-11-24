// Las partes de la ficha de un cliente en ops. La ficha técnica es una más:
// vive en su propia dirección, pero se ve y se elige como pestaña del cliente.

export type Pestana = "resumen" | "datos" | "instalaciones" | "app" | "historial";
export const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "datos", texto: "Datos y visita" },
  { id: "instalaciones", texto: "Naves" },
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

/** Las pestañas de una nave. Las marcadas «conectada» solo salen cuando la nave tiene su conexión. */
export type PestanaNave = "visita" | "tecnica" | "conexion" | "lecturas" | "ordenes" | "historicos" | "datos" | "ahorro" | "ajustes";
export const PESTANAS_NAVE: { id: PestanaNave; texto: string; conectada?: boolean }[] = [
  { id: "visita", texto: "Cámaras y visita" },
  { id: "tecnica", texto: "Ficha técnica" },
  { id: "conexion", texto: "Conexión" },
  { id: "lecturas", texto: "Lecturas", conectada: true },
  { id: "ordenes", texto: "Órdenes", conectada: true },
  { id: "historicos", texto: "Históricos", conectada: true },
  { id: "datos", texto: "Datos guardados", conectada: true },
  { id: "ahorro", texto: "Ahorro", conectada: true },
  { id: "ajustes", texto: "Ajustes", conectada: true },
];
/** Las de la página antigua de cada instalación conectada se traducen a las de la nave. */
export function pestanaNave(x: string | null): PestanaNave | null {
  if (x === "puesta") return "conexion";
  if (x === "ficha") return "tecnica";
  return PESTANAS_NAVE.some((p) => p.id === x) ? (x as PestanaNave) : null;
}
