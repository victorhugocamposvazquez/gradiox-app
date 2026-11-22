// Las visitas de soporte: cada vez que alguien de Gradiox entra desde el panel
// a ver la app como la ve un cliente, queda apuntado con su motivo. El cliente
// puede ver la lista desde su app.

import { almacenAjustes, type AlmacenAjustes } from "../ajustes/almacen";

export type VisitaSoporte = { t: number; motivo: string };
const MAX = 100;
const clave = (cliente: string) => `soporte:${cliente}`;

export async function visitasSoporte(cliente: string, a: AlmacenAjustes = almacenAjustes()): Promise<VisitaSoporte[]> {
  return (await a.leer<{ visitas: VisitaSoporte[] }>(clave(cliente)))?.visitas ?? [];
}

export async function apuntarVisita(cliente: string, v: VisitaSoporte, a: AlmacenAjustes = almacenAjustes()): Promise<void> {
  await a.guardar(clave(cliente), { visitas: [v, ...(await visitasSoporte(cliente, a))].slice(0, MAX) });
}
