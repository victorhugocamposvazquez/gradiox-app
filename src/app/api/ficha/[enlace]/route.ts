import { aplicarExterno, documentoExterno, enviarExterno, vistaExterna } from "@/clientes/externo";
import { apunte, conApuntes, esDocumento } from "@/clientes/modelo";
import { deEnlace } from "@/clientes/ruta-enlace";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";

// La ficha técnica de una instalación, abierta desde su enlace. No usa sesión: la protege la clave del enlace.
export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ enlace: string }> };
const HORAS_ENTRE_APUNTES = 6;

export async function GET(_: Request, { params }: Contexto) {
  const { enlace } = await params;
  return conClientes(async (a) => {
    const { cliente, instalacion } = await deEnlace(a, enlace);
    const documentos = (await a.fotos(cliente.id)).filter((f) => esDocumento(f) && f.instalacion === instalacion.id).map(documentoExterno);
    return { ficha: vistaExterna(cliente, instalacion), documentos };
  });
}

export async function PUT(peticion: Request, { params }: Contexto) {
  const { enlace } = await params;
  const cuerpo = await cuerpoJson(peticion);
  return conClientes(async (a) => {
    const { cliente, instalacion } = await deEnlace(a, enlace);
    const ahora = Date.now();
    const nueva = aplicarExterno(instalacion, cuerpo, ahora);
    // En el registro del cliente queda constancia, sin repetirla a cada tecla.
    const reciente = ahora - instalacion.tecnica.externa < HORAS_ENTRE_APUNTES * 3_600_000;
    const historial = reciente ? cliente.historial : conApuntes(cliente.historial, [apunte(`Ficha técnica de «${instalacion.nombre || "la instalación"}» rellenada desde su enlace.`, ahora, true)]);
    const { id, creado: _c, actualizado: _a, ...datos } = cliente;
    const guardado = await a.guardar(id, { ...datos, historial, instalaciones: cliente.instalaciones.map((i) => (i.id === instalacion.id ? nueva : i)) });
    if (!guardado) throw new ErrorClientes("Este enlace no existe o se ha desactivado", 404);
    return { guardado: true };
  });
}

/** «Enviar»: guarda lo último y deja el aviso en el panel y en el registro del cliente. Se puede enviar más de una vez. */
export async function POST(peticion: Request, { params }: Contexto) {
  const { enlace } = await params;
  const cuerpo = await cuerpoJson(peticion);
  return conClientes(async (a) => {
    const { cliente, instalacion } = await deEnlace(a, enlace);
    const ahora = Date.now();
    const nueva = enviarExterno(instalacion, cuerpo, ahora);
    const otraVez = instalacion.tecnica.enviada > 0;
    const historial = conApuntes(cliente.historial, [apunte(`Ficha técnica de «${instalacion.nombre || "la instalación"}» enviada${otraVez ? " de nuevo, con cambios," : ""} por quien la rellena desde el enlace.`, ahora, true)]);
    const { id, creado: _c, actualizado: _a, ...datos } = cliente;
    const guardado = await a.guardar(id, { ...datos, historial, instalaciones: cliente.instalaciones.map((i) => (i.id === instalacion.id ? nueva : i)) });
    if (!guardado) throw new ErrorClientes("Este enlace no existe o se ha desactivado", 404);
    return { enviada: ahora };
  });
}
