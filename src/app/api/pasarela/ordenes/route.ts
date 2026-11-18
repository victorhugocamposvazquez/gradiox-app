import { darOrdenes, recibirResultados } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Órdenes al PLC para el programa de pasarela: las recoge (GET) y cuenta cómo han ido (POST). Lleva el token de su instalación.
export const dynamic = "force-dynamic";

export const GET = (peticion: Request) => atender((a) => darOrdenes(peticion, a));
export const POST = (peticion: Request) => atender((a) => recibirResultados(peticion, a));
