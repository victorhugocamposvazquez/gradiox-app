import { cambios, conApuntes, esId, validarCliente } from "@/clientes/modelo";
import { conservarExterno } from "@/clientes/externo";
import { ErrorClientes, conClientes, cuerpoJson, lecturasActuales } from "@/clientes/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };
const NO_ESTA = new ErrorClientes("Ese cliente no existe", 404);

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    const cliente = esId(id) ? await a.leer(id) : null;
    if (!cliente) throw NO_ESTA;
    const [fotos, lecturas] = await Promise.all([a.fotos(id), lecturasActuales()]);
    return { guardado: a.tipo, ahora: Date.now(), cliente, fotos, lecturas };
  });
}

export async function PUT(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const v = validarCliente(await cuerpoJson(peticion));
  return conClientes(async (a) => {
    if ("error" in v) throw new ErrorClientes(v.error);
    const antes = esId(id) ? await a.leer(id) : null;
    if (!antes) throw NO_ESTA;
    // El registro lo lleva el servidor: lo que mande el navegador no lo pisa, y los cambios de estado se apuntan solos.
    // Lo que se haya rellenado desde el enlace de una ficha técnica mientras el panel estaba abierto no se pisa.
    const cruce = v.instalaciones.map((i) => conservarExterno(i, antes.instalaciones.find((x) => x.id === i.id)));
    const datos = { ...v, instalaciones: cruce.map((x) => x.instalacion) };
    const cliente = await a.guardar(id, { ...datos, historial: conApuntes(antes.historial, cambios(antes, datos, Date.now())) });
    if (!cliente) throw NO_ESTA;
    return cruce.some((x) => x.desfasada) ? { historial: cliente.historial, cliente } : { historial: cliente.historial };
  });
}

export async function DELETE(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    if (!esId(id) || !(await a.borrar(id))) throw NO_ESTA;
    return { borrado: true };
  });
}
