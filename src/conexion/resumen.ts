// Lo que enseña la pantalla de lecturas reales: cada pasarela con sus equipos,
// la última medida de cada uno y la temperatura de la última hora.

import type { Almacen } from "./almacen";
import type { Medida } from "./pasarela";

export type EquipoReal = { id: string; ultima: Medida; temperaturas: { t: number; v: number }[] };
export type PasarelaReal = { id: string; ultima: number; equipos: EquipoReal[] };
export type ResumenLecturas = {
  /** Si el servidor tiene clave de pasarelas: sin ella no entra nada. */
  abierta: boolean;
  guardado: Almacen["tipo"];
  pasarelas: PasarelaReal[];
};

const HORA = 3_600_000;
const PUNTOS = 90;

export async function resumenLecturas(almacen: Almacen, abierta: boolean): Promise<ResumenLecturas> {
  const pasarelas: PasarelaReal[] = [];
  for (const p of await almacen.pasarelas()) {
    const equipos: EquipoReal[] = [];
    for (const ultima of await almacen.ultimas(p.id)) {
      const serie = (await almacen.serie(p.id, ultima.equipo, ultima.t - HORA)).flatMap((m) => (m.lectura?.temperatura === undefined ? [] : [{ t: m.t, v: m.lectura.temperatura }]));
      // Para dibujar bastan unos pocos puntos: se toma uno de cada tantos, siempre con el último.
      const paso = Math.max(1, Math.ceil(serie.length / PUNTOS));
      equipos.push({ id: ultima.equipo, ultima, temperaturas: serie.filter((_, i) => (serie.length - 1 - i) % paso === 0) });
    }
    pasarelas.push({ id: p.id, ultima: p.ultima, equipos });
  }
  return { abierta, guardado: almacen.tipo, pasarelas };
}
