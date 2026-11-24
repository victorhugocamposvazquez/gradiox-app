import { almacenClientes } from "@/clientes/almacen";
import { darConfiguracion } from "@/pasarelas/entrada";
import { atender } from "@/pasarelas/rutas";

// Lo pide el programa de pasarela. No usa la sesión de la app: cada petición lleva el token de su instalación.
export const dynamic = "force-dynamic";

const nombreCliente = async (id: string) => (await almacenClientes().leer(id))?.nombre ?? "";

export const GET = (peticion: Request) => atender((a) => darConfiguracion(peticion, a, Date.now(), nombreCliente));
