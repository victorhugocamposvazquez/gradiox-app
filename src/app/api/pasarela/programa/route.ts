import { darPrograma } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// De aquí se actualiza solo el programa de pasarela. Solo se sirve a quien tiene un token en vigor,
// y el programa no acepta nada que no venga firmado por Gradiox.
export const dynamic = "force-dynamic";

export const GET = (peticion: Request) => atender((a) => darPrograma(peticion, a));
