// Lo que piden Hoy y Servicios al servidor: cada instalación conectada con sus
// servicios montados a partir de lo último que ha entregado su pasarela.

import type { AlmacenPasarelas } from "../pasarelas/almacen";
import { CURVA_MS, VENTANA_MS, montarInstalacion, variablesDeCurva, type InstalacionViva } from "./modelo";

export async function instalacionesVivas(a: AlmacenPasarelas, ahora: number): Promise<InstalacionViva[]> {
  const pasarelas = (await a.listar()).filter((p) => !p.anulada);
  const montadas = await Promise.all(
    pasarelas.map(async (p) => {
      const ultimas = await a.ultimas(p.id, ahora - VENTANA_MS);
      const curvas = await a.lecturasDesde(p.id, variablesDeCurva(p, ultimas), ahora - CURVA_MS);
      return montarInstalacion(p, ultimas, curvas, ahora);
    }),
  );
  // Solo las que tienen algún servicio que enseñar.
  return montadas.filter((i) => i.servicios.length > 0);
}
