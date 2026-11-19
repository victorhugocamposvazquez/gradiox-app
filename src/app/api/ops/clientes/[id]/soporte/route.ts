import { NextResponse } from "next/server";
import { conApuntes, esId, nuevoId } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";
import { apuntarVisita } from "@/clientes/soporte";
import { DURA_SOPORTE_S, GALLETA, crearSesionSoporte, credenciales } from "@/lib/sesion";

/**
 * Visita de soporte: abre en este navegador la app tal como la ve ese cliente,
 * durante una hora y sin poder cambiar nada. Hace falta decir el motivo, y
 * queda apuntado en el historial de la ficha y en la lista que ve el cliente.
 */
export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = (await cuerpoJson(peticion)) as { motivo?: unknown } | null;
  const motivo = typeof cuerpo?.motivo === "string" ? cuerpo.motivo.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  return conClientes(async (a) => {
    const c = credenciales();
    if (!c) throw new ErrorClientes("El acceso a la app no está configurado en el servidor.", 503);
    const ficha = esId(id) ? await a.leer(id) : null;
    if (!ficha) throw new ErrorClientes("Ese cliente no existe", 404);
    if (motivo.length < 5) throw new ErrorClientes("Escribe el motivo de la visita: queda apuntado y el cliente lo puede ver.");
    const t = Date.now();
    await apuntarVisita(id, { t, motivo });
    const { id: _, creado, actualizado, ...datos } = ficha;
    void _;
    void creado;
    void actualizado;
    await a.guardar(id, { ...datos, historial: conApuntes(ficha.historial, [{ id: nuevoId(), t, texto: `Visita de soporte a su app (una hora, solo ver). Motivo: ${motivo}`, auto: true }]) });
    const respuesta = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    respuesta.cookies.set(GALLETA, await crearSesionSoporte(c, id, t), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DURA_SOPORTE_S });
    return respuesta;
  });
}
