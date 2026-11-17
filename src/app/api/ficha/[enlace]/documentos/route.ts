import { MAX_DOCUMENTOS_ENLACE, documentoExterno } from "@/clientes/externo";
import { MAX_FOTO, MIMES_DOCUMENTO, MIMES_FOTO, esDocumento } from "@/clientes/modelo";
import { deEnlace } from "@/clientes/ruta-enlace";
import { ErrorClientes, conClientes } from "@/clientes/rutas";

export const dynamic = "force-dynamic";

// Sube un documento a la ficha técnica desde su enlace.
export async function POST(peticion: Request, { params }: { params: Promise<{ enlace: string }> }) {
  const { enlace } = await params;
  const formulario = await peticion.formData().catch(() => null);
  return conClientes(async (a) => {
    const { cliente, instalacion } = await deEnlace(a, enlace);
    const archivo = formulario?.get("documento");
    if (!(archivo instanceof File)) throw new ErrorClientes("Falta el documento");
    const extension = (archivo.name.split(".").pop() ?? "").toLowerCase();
    const porNombre = (!archivo.type || archivo.type === "application/octet-stream") && ["pdf", "csv", "txt", "xlsx", "xls", "xml"].includes(extension);
    if (![...MIMES_DOCUMENTO, ...MIMES_FOTO].includes(archivo.type) && !porNombre) throw new ErrorClientes("Solo se admiten PDF, hojas de cálculo, CSV, XML, texto o imágenes");
    if (archivo.size === 0 || archivo.size > MAX_FOTO) throw new ErrorClientes("El documento pesa demasiado (máximo 4 MB)", 413);
    const hay = (await a.fotos(cliente.id)).filter((f) => esDocumento(f) && f.instalacion === instalacion.id).length;
    if (hay >= MAX_DOCUMENTOS_ENLACE) throw new ErrorClientes(`Esta ficha ya tiene ${MAX_DOCUMENTOS_ENLACE} documentos`);
    const foto = await a.anadirFoto(cliente.id, { instalacion: instalacion.id, punto: "", tipo: "documento", pie: archivo.name.trim().slice(0, 240) }, { mime: archivo.type || "application/octet-stream", bytes: new Uint8Array(await archivo.arrayBuffer()) });
    if (!foto) throw new ErrorClientes("Este enlace no existe o se ha desactivado", 404);
    return { documento: documentoExterno(foto) };
  });
}
