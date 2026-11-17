import type { AlmacenClientes } from "@/clientes/almacen";
import { esDocumento, esId } from "@/clientes/modelo";
import { deEnlace } from "@/clientes/ruta-enlace";
import { ErrorClientes, conClientes } from "@/clientes/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ enlace: string; id: string }> };
const NO_ESTA = new ErrorClientes("Ese documento no existe", 404);

/** Solo vale un documento de la instalación de este enlace: nunca una foto ni nada de otra instalación. */
async function documento(a: AlmacenClientes, enlace: string, id: string) {
  const { cliente, instalacion } = await deEnlace(a, enlace);
  const d = esId(id) ? (await a.fotos(cliente.id)).find((f) => f.id === id && esDocumento(f) && f.instalacion === instalacion.id) : undefined;
  if (!d) throw NO_ESTA;
  return d;
}

export async function GET(_: Request, { params }: Contexto) {
  const { enlace, id } = await params;
  return conClientes(async (a) => {
    const d = await documento(a, enlace, id);
    const contenido = await a.imagen(d.id);
    if (!contenido) throw NO_ESTA;
    return new Response(contenido.bytes as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}

export async function DELETE(_: Request, { params }: Contexto) {
  const { enlace, id } = await params;
  return conClientes(async (a) => {
    const d = await documento(a, enlace, id);
    if (!(await a.borrarFoto(d.id))) throw NO_ESTA;
    return { borrado: true };
  });
}
