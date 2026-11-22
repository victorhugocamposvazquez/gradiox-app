// Junta lo que hace falta para la hoja de ruta de un cliente.

import { almacenAccesos } from "../accesos/almacen";
import { sinHuella } from "../accesos/modelo";
import { almacenPasarelas } from "../pasarelas/almacen";
import { carpetaPublicado, leerPublicado } from "../pasarelas/entrada";
import type { Pasarela } from "../pasarelas/modelo";
import type { Cliente } from "./modelo";
import { rutaDe, type Ruta } from "./ruta";

export async function versionesPublicadas(): Promise<Record<string, string>> {
  return Object.fromEntries(Object.entries(await leerPublicado(carpetaPublicado())).map(([k, v]) => [k, v.version]));
}

export async function rutaDeCliente(c: Cliente, todas?: Pasarela[], publicada?: Record<string, string>, ahora = Date.now()): Promise<Ruta> {
  const [pasarelas, accesos, pub] = await Promise.all([todas ?? almacenPasarelas().listar(), almacenAccesos().deCliente(c.id), publicada ?? versionesPublicadas()]);
  return rutaDe(c, pasarelas.filter((p) => !p.anulada && p.cliente === c.id), accesos.map(sinHuella), ahora, pub);
}
