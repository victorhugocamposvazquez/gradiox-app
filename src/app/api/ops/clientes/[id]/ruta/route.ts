import { esId } from "@/clientes/modelo";
import { rutaDeCliente } from "@/clientes/ruta-servidor";
import { ErrorClientes, conClientes } from "@/clientes/rutas";
import { visitasSoporte } from "@/clientes/soporte";

// La hoja de ruta de un cliente: pasos del alta, seguimiento y visitas de soporte.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conClientes(async (a) => {
    const c = esId(id) ? await a.leer(id) : null;
    if (!c) throw new ErrorClientes("Ese cliente no existe", 404);
    return { ahora: Date.now(), ruta: await rutaDeCliente(c), visitas: (await visitasSoporte(id)).slice(0, 10) };
  });
}
