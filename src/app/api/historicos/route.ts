import { atenderHistoricos } from "@/historicos/ruta";

// Históricos de lo leído y lo ejecutado en las instalaciones conectadas. Solo con sesión iniciada en la app.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = (peticion: Request) => atenderHistoricos(peticion);
