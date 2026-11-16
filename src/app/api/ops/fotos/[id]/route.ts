import { esId, validarDatosFoto } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };
const NO_ESTA = new ErrorClientes("Esa foto no existe", 404);

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    const imagen = esId(id) ? await a.imagen(id) : null;
    if (!imagen) throw NO_ESTA;
    // Una foto no cambia nunca: el navegador puede guardarla, pero solo para quien tiene sesión.
    return new Response(imagen.bytes as BodyInit, { headers: { "Content-Type": imagen.mime, "Cache-Control": "private, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
  });
}

export async function PATCH(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const datos = validarDatosFoto(await cuerpoJson(peticion));
  return conClientes(async (a) => {
    const foto = esId(id) ? await a.cambiarFoto(id, datos) : null;
    if (!foto) throw NO_ESTA;
    return { foto };
  });
}

export async function DELETE(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (a) => {
    if (!esId(id) || !(await a.borrarFoto(id))) throw NO_ESTA;
    return { borrada: true };
  });
}
