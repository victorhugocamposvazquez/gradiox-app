import { recibirLecturas } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Aquí entrega el programa de pasarela lo que lee. No usa la sesión de la app: cada envío lleva el token de su instalación.
export const dynamic = "force-dynamic";

export const POST = (peticion: Request) => atender((a) => recibirLecturas(peticion, a));
