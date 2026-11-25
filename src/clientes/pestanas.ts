// Las partes de la ficha de un cliente en ops. La ficha técnica es una más:
// vive en su propia dirección, pero se ve y se elige como pestaña del cliente.

export type Pestana = "resumen" | "datos" | "instalaciones" | "app" | "historial";
export const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "datos", texto: "Datos y visita" },
  { id: "instalaciones", texto: "Instalaciones" },
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

/** Las pestañas de una instalación. Las marcadas «conectada» solo salen cuando tiene su conexión. */
export type PestanaNave = "rendimiento" | "planes" | "lecturas" | "ordenes" | "historicos" | "visita" | "tecnica" | "conexion" | "ajustes";
export type Zona = "trabaja" | "ver" | "preparar" | "mas";
/** Rótulo de cada zona, como en la maqueta de ops: primero cómo trabaja, luego ver y actuar, y preparar. */
export const ZONAS: Record<Exclude<Zona, "mas">, string> = { trabaja: "Cómo trabaja", ver: "Ver y actuar", preparar: "Preparar" };
/**
 * Las pestañas de una instalación por zonas. «Preparar» va al final si ya lee y al
 * principio si no (eso lo decide la página). Las de «Cómo trabaja» y «Ver y actuar» se
 * ven siempre, aunque aún no lea, para que se sepa dónde están y qué falta. Los ajustes
 * de la conexión van aparte, en «⋯». Los ids antiguos se conservan para no romper enlaces.
 */
export const PESTANAS_NAVE: { id: PestanaNave; texto: string; tramo: Zona; conectada?: boolean }[] = [
  { id: "rendimiento", texto: "Rendimiento", tramo: "trabaja" },
  { id: "planes", texto: "Planes", tramo: "trabaja" },
  { id: "lecturas", texto: "Leer", tramo: "ver" },
  { id: "ordenes", texto: "Actuar a mano", tramo: "ver" },
  { id: "historicos", texto: "Historia", tramo: "ver" },
  { id: "visita", texto: "Cámaras y visita", tramo: "preparar" },
  { id: "tecnica", texto: "Ficha técnica", tramo: "preparar" },
  { id: "conexion", texto: "Conexión", tramo: "preparar" },
  { id: "ajustes", texto: "Ajustes de la conexión", tramo: "mas", conectada: true },
];
/** Los nombres de antes (enlaces guardados, la página antigua de cada conexión) llevan a donde está ahora lo suyo. */
export function pestanaNave(x: string | null): PestanaNave | null {
  if (x === "puesta") return "conexion";
  if (x === "ficha") return "tecnica";
  // Los datos guardados están dentro de Historia.
  if (x === "datos") return "historicos";
  // El ahorro por tarifa es el primer plan.
  if (x === "ahorro") return "planes";
  return PESTANAS_NAVE.some((p) => p.id === x) ? (x as PestanaNave) : null;
}
