import { MAX_FOTO, MIMES_DOCUMENTO, MIMES_FOTO, esId, validarDatosFoto } from "@/clientes/modelo";
import { ErrorClientes, conClientes } from "@/clientes/rutas";

export const dynamic = "force-dynamic";

// Sube una foto a la ficha de un cliente. El navegador la reduce antes de enviarla.
export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formulario = await peticion.formData().catch(() => null);
  return conClientes(async (a) => {
    const archivo = formulario?.get("foto");
    if (!esId(id) || !(archivo instanceof Blob)) throw new ErrorClientes("Falta la foto");
    const datos = validarDatosFoto(Object.fromEntries(["instalacion", "punto", "tipo", "pie"].map((k) => [k, formulario?.get(k)])));
    // Un documento de la ficha técnica se guarda igual que una foto, con su nombre en el pie.
    if (datos.tipo === "documento") {
      // Algunos navegadores no dicen el tipo de un CSV o de una hoja de cálculo: entonces vale la extensión.
      const extension = archivo instanceof File ? (archivo.name.split(".").pop() ?? "").toLowerCase() : "";
      const porNombre = (!archivo.type || archivo.type === "application/octet-stream") && ["pdf", "csv", "txt", "xlsx", "xls", "xml"].includes(extension);
      if (![...MIMES_DOCUMENTO, ...MIMES_FOTO].includes(archivo.type) && !porNombre) throw new ErrorClientes("Solo se admiten PDF, hojas de cálculo, CSV, texto o fotos");
    } else if (!MIMES_FOTO.includes(archivo.type)) throw new ErrorClientes("Solo se admiten fotos JPEG, PNG o WebP");
    if (archivo.size === 0 || archivo.size > MAX_FOTO) throw new ErrorClientes(datos.tipo === "documento" ? "El documento pesa demasiado (máximo 4 MB)" : "La foto pesa demasiado (máximo 4 MB)", 413);
    const foto = await a.anadirFoto(id, datos, { mime: archivo.type || "application/octet-stream", bytes: new Uint8Array(await archivo.arrayBuffer()) });
    if (!foto) throw new ErrorClientes("Ese cliente no existe", 404);
    return { foto };
  });
}
