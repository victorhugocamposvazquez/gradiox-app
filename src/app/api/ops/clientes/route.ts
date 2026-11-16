import { validarCliente } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";

// Clientes de Gradiox (zona interna). Solo con sesión iniciada.
export const dynamic = "force-dynamic";

export const GET = () => conClientes(async (a) => ({ guardado: a.tipo, clientes: await a.listar() }));

export async function POST(peticion: Request) {
  const v = validarCliente(await cuerpoJson(peticion));
  return conClientes(async (a) => {
    if ("error" in v) throw new ErrorClientes(v.error);
    return { cliente: await a.crear(v) };
  });
}
