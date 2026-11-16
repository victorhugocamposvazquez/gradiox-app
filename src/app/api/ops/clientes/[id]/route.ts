import { esId, validarCliente } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };
const NO_ESTA = new ErrorClientes("Ese cliente no existe", 404);

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    const cliente = esId(id) ? await a.leer(id) : null;
    if (!cliente) throw NO_ESTA;
    return { guardado: a.tipo, cliente, fotos: await a.fotos(id) };
  });
}

export async function PUT(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const v = validarCliente(await cuerpoJson(peticion));
  return conClientes(async (a) => {
    if ("error" in v) throw new ErrorClientes(v.error);
    const cliente = esId(id) ? await a.guardar(id, v) : null;
    if (!cliente) throw NO_ESTA;
    return { cliente };
  });
}

export async function DELETE(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    if (!esId(id) || !(await a.borrar(id))) throw NO_ESTA;
    return { borrado: true };
  });
}
