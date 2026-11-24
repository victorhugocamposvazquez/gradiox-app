import { vincular } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Lo pide el programa de pasarela con el código de conexión de 6 cifras, sin token: a cambio recibe el suyo.
export const dynamic = "force-dynamic";

export const POST = (peticion: Request) => atender((a) => vincular(peticion, a));
