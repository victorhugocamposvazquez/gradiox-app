// Lo que usa el navegador para hablar con la zona de clientes.

export async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(ruta, { cache: "no-store", ...opciones });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(d.error ?? "No se ha podido completar");
  return d;
}

export const conJson = (metodo: string, cuerpo: unknown): RequestInit => ({ method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

const LADO = 1600;

/** Reduce una foto del móvil antes de subirla: lado mayor de 1600 px, en JPEG. */
export async function reducirFoto(archivo: File): Promise<Blob> {
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    const reducida = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/jpeg", 0.82));
    return reducida ?? archivo;
  } catch {
    // Si el navegador no sabe leerla, se manda tal cual y el servidor decide.
    return archivo;
  }
}
