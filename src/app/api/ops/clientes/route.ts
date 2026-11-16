import { apunte, resumir, validarCliente } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson, lecturasActuales } from "@/clientes/rutas";

// Clientes de Gradiox (zona interna). Solo con sesión iniciada.
export const dynamic = "force-dynamic";

export const GET = () =>
  conClientes(async (a) => {
    const [fichas, lecturas] = await Promise.all([a.listar(), lecturasActuales()]);
    const ahora = Date.now();
    return { guardado: a.tipo, ahora, clientes: fichas.map((f) => resumir(f.cliente, f.fotos, lecturas, ahora)) };
  });

export async function POST(peticion: Request) {
  const v = validarCliente(await cuerpoJson(peticion));
  return conClientes(async (a) => {
    if ("error" in v) throw new ErrorClientes(v.error);
    return { cliente: await a.crear({ ...v, historial: [apunte("Alta del cliente.", Date.now(), true)] }) };
  });
}
