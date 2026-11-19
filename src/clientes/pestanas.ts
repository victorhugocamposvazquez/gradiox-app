// Las partes de la ficha de un cliente en ops. La ficha técnica es una más:
// vive en su propia dirección, pero se ve y se elige como pestaña del cliente.

export type Pestana = "resumen" | "empresa" | "instalacion" | "visita" | "seguimiento" | "app";
export const PESTANAS: { id: Pestana; texto: string; numero?: number }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "empresa", texto: "Empresa", numero: 1 },
  { id: "instalacion", texto: "Instalación y cámaras", numero: 2 },
  { id: "visita", texto: "Lo que dijo", numero: 3 },
  { id: "seguimiento", texto: "Seguimiento", numero: 4 },
  { id: "app", texto: "Acceso a la app" },
];
