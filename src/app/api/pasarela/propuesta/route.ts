import { recibirPropuesta } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Aquí cuenta el programa de pasarela qué lista de variables está leyendo por su cuenta. Lleva el token de su instalación.
export const dynamic = "force-dynamic";

export const POST = (peticion: Request) => atender((a) => recibirPropuesta(peticion, a));
