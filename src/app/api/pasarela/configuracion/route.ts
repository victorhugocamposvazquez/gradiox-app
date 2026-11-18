import { darConfiguracion } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Lo pide el programa de pasarela. No usa la sesión de la app: cada petición lleva el token de su instalación.
export const dynamic = "force-dynamic";

export const GET = (peticion: Request) => atender((a) => darConfiguracion(peticion, a));
