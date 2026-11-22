// Lo que piden Hoy y Servicios al servidor: cada instalación conectada con sus
// servicios montados a partir de lo último que ha entregado su pasarela.

import type { AlmacenPasarelas } from "../pasarelas/almacen";
import type { Pasarela } from "../pasarelas/modelo";
import type { FichaViva } from "./conexion";
import { CURVA_MS, VENTANA_MS, montarInstalacion, variablesDeCurva, type InstalacionViva } from "./modelo";

/** Cómo se llaman el cliente y la ubicación de una instalación, según la ficha del cliente. */
export type Ubicar = (p: Pasarela) => Pick<InstalacionViva, "cliente" | "ubicacion" | "ficha"> | null;

export async function instalacionesVivas(a: AlmacenPasarelas, ahora: number, ver: (p: Pasarela) => boolean = () => true, ubicar: Ubicar = () => null): Promise<InstalacionViva[]> {
  const pasarelas = (await a.listar()).filter((p) => !p.anulada && ver(p));
  const montadas = await Promise.all(
    pasarelas.map(async (p) => {
      const ultimas = await a.ultimas(p.id, ahora - VENTANA_MS);
      const curvas = await a.lecturasDesde(p.id, variablesDeCurva(p, ultimas), ahora - CURVA_MS);
      return { ...montarInstalacion(p, ultimas, curvas, ahora), ...ubicar(p) };
    }),
  );
  // Solo las que tienen algún servicio que enseñar.
  return montadas.filter((i) => i.servicios.length > 0);
}

type FichaCliente = { id: string; nombre: string; instalaciones: { id: string; nombre: string; ficha?: FichaViva }[] };
/** Con las fichas de los clientes: el nombre del cliente y el de la ubicación (la instalación de la ficha) de cada pasarela. */
export function ubicarCon(fichas: FichaCliente[]): Ubicar {
  const porId = new Map(fichas.map((f) => [f.id, f]));
  return (p) => {
    const f = p.cliente ? porId.get(p.cliente) : undefined;
    if (!f) return null;
    const u = f.instalaciones.find((i) => i.id === p.ubicacion);
    return { ficha: u?.ficha, cliente: { id: f.id, nombre: f.nombre || "Cliente sin nombre" }, ubicacion: u ? { id: u.id, nombre: u.nombre || "Ubicación sin nombre" } : { id: p.id, nombre: p.nombre } };
  };
}
