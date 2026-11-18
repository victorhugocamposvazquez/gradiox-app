import { atenderHistoricos } from "@/historicos/ruta";

// Los mismos históricos, para el panel interno. Solo con sesión iniciada en el panel.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = (peticion: Request) => atenderHistoricos(peticion);
