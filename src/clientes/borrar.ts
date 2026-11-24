import type { AlmacenAccesos } from "../accesos/almacen";
import type { AlmacenPasarelas } from "../pasarelas/almacen";
import type { Pasarela } from "../pasarelas/modelo";

// Lo que cuelga de un cliente cuando se borra. Sus usuarios de la app se borran (si no,
// podrían seguir entrando a una app vacía). Sus conexiones NO se borran: pierden el
// cliente y la nave y quedan «sin cliente asignado» en ops, con todo lo leído, para
// asignarlas a otro o borrarlas aparte. Así borrar un cliente no se lleva lecturas por sorpresa.

const sinDueno = ({ id: _, creada: __, actualizada: ___, contacto: ____, ...datos }: Pasarela) => ({ ...datos, cliente: undefined, ubicacion: undefined });

export async function soltarCliente(cliente: string, accesos: Pick<AlmacenAccesos, "deCliente" | "borrar">, pasarelas: Pick<AlmacenPasarelas, "listar" | "guardar">) {
  const [suyos, todas] = await Promise.all([accesos.deCliente(cliente), pasarelas.listar()]);
  await Promise.all(suyos.map((a) => accesos.borrar(a.id)));
  const suyas = todas.filter((p) => p.cliente === cliente);
  await Promise.all(suyas.map((p) => pasarelas.guardar(p.id, sinDueno(p))));
  return { usuarios: suyos.length, conexiones: suyas.length };
}

/** Al borrar una nave, sus conexiones se quedan en el cliente sin nave: no se pierde lo leído. */
export async function soltarNave(cliente: string, nave: string, pasarelas: Pick<AlmacenPasarelas, "listar" | "guardar">) {
  const suyas = (await pasarelas.listar()).filter((p) => p.cliente === cliente && p.ubicacion === nave);
  await Promise.all(suyas.map(({ id, creada: _, actualizada: __, contacto: ___, ...datos }) => pasarelas.guardar(id, { ...datos, ubicacion: undefined })));
  return suyas.length;
}
