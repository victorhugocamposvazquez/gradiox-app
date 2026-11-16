import { MAX_FOTO, MIMES_FOTO, esId, validarDatosFoto } from "@/clientes/modelo";
import { ErrorClientes, conClientes } from "@/clientes/rutas";

export const dynamic = "force-dynamic";

// Sube una foto a la ficha de un cliente. El navegador la reduce antes de enviarla.
export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formulario = await peticion.formData().catch(() => null);
  return conClientes(async (a) => {
    const archivo = formulario?.get("foto");
    if (!esId(id) || !(archivo instanceof Blob)) throw new ErrorClientes("Falta la foto");
    if (!MIMES_FOTO.includes(archivo.type)) throw new ErrorClientes("Solo se admiten fotos JPEG, PNG o WebP");
    if (archivo.size === 0 || archivo.size > MAX_FOTO) throw new ErrorClientes("La foto pesa demasiado (máximo 4 MB)", 413);
    const datos = validarDatosFoto(Object.fromEntries(["instalacion", "punto", "tipo", "pie"].map((k) => [k, formulario?.get(k)])));
    const foto = await a.anadirFoto(id, datos, { mime: archivo.type, bytes: new Uint8Array(await archivo.arrayBuffer()) });
    if (!foto) throw new ErrorClientes("Ese cliente no existe", 404);
    return { foto };
  });
}
