import { apunte, conApuntes, esId } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";

export const dynamic = "force-dynamic";

// Añade una línea escrita a mano al registro de un cliente: una llamada, un acuerdo, lo que se hizo.
export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = (await cuerpoJson(peticion)) as { texto?: unknown } | null;
  return conClientes(async (a) => {
    const texto = typeof cuerpo?.texto === "string" ? cuerpo.texto.trim() : "";
    if (!texto) throw new ErrorClientes("Falta el texto de la nota");
    const antes = esId(id) ? await a.leer(id) : null;
    if (!antes) throw new ErrorClientes("Ese cliente no existe", 404);
    const { id: _, creado: __, actualizado: ___, ...datos } = antes;
    const cliente = await a.guardar(id, { ...datos, historial: conApuntes(antes.historial, [apunte(texto, Date.now())]) });
    return { historial: cliente?.historial ?? [] };
  });
}
