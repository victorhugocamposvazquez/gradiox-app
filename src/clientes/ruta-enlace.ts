import type { AlmacenClientes } from "./almacen";
import { instalacionDeEnlace } from "./externo";
import { ErrorClientes } from "./rutas";
import { esEnlace } from "./tecnica";

/** Encuentra la instalación de un enlace. Si la clave no vale o el enlace está apagado, responde igual: no existe. */
export async function deEnlace(a: AlmacenClientes, enlace: string) {
  const cliente = esEnlace(enlace) ? await a.porEnlace(enlace) : null;
  const instalacion = cliente ? instalacionDeEnlace(cliente, enlace) : undefined;
  if (!cliente || !instalacion) throw new ErrorClientes("Este enlace no existe o se ha desactivado", 404);
  return { cliente, instalacion };
}
