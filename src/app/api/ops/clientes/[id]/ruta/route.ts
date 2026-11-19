import { esId } from "@/clientes/modelo";
import { rutaDeCliente } from "@/clientes/ruta-servidor";
import { ErrorClientes, conClientes } from "@/clientes/rutas";
import { visitasSoporte } from "@/clientes/soporte";
import { almacenPasarelas } from "@/pasarelas/almacen";

// La hoja de ruta de un cliente: pasos del alta, seguimiento y visitas de soporte.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conClientes(async (a) => {
    const c = esId(id) ? await a.leer(id) : null;
    if (!c) throw new ErrorClientes("Ese cliente no existe", 404);
    const todas = await almacenPasarelas().listar();
    // Lo justo de sus pasarelas para completar los pasos sin salir de la hoja de ruta.
    const pasarelas = todas.filter((p) => !p.anulada && p.cliente === id).map((p) => ({ id: p.id, nombre: p.nombre, ubicacion: p.ubicacion ?? "", variables: p.variables.length, propuestas: p.propuesta?.variables.length ?? 0, estrenada: !!p.contacto }));
    return { ahora: Date.now(), ruta: await rutaDeCliente(c, todas), pasarelas, visitas: (await visitasSoporte(id)).slice(0, 10) };
  });
}
