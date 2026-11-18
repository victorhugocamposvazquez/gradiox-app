import { ErrorClientes, cuerpoJson } from "@/clientes/rutas";
import { esId } from "@/clientes/modelo";
import { aplicarCambios, dias, huellaToken, nuevaRevision, nuevoToken, pistaToken } from "@/pasarelas/modelo";
import { conPasarelas } from "@/pasarelas/rutas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa pasarela no existe", 404);
    return { ahora: Date.now(), pasarela: p, lecturas: await a.ultimas(id) };
  });
}

export async function POST(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const b = ((await cuerpoJson(peticion)) ?? {}) as Record<string, unknown>;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa pasarela no existe", 404);
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const ahora = Date.now();
    switch (b.accion) {
      case "guardar": {
        const d = aplicarCambios(datos, b);
        if ("error" in d) throw new ErrorClientes(d.error);
        return { pasarela: await a.guardar(id, d) };
      }
      case "aceptar-propuesta": {
        // La lista que el programa propone pasa a ser la de la instalación.
        if (!datos.propuesta) throw new ErrorClientes("Ya no hay ninguna lista propuesta");
        const { propuesta, ...resto } = datos;
        return { pasarela: await a.guardar(id, { ...resto, propuesta: undefined, variables: propuesta.variables, perfil: propuesta.origen === "elegidas" ? "Elegidas en la planta" : resto.perfil, revision: nuevaRevision() }) };
      }
      case "descartar-propuesta":
        return { pasarela: await a.guardar(id, { ...datos, propuesta: undefined, revision: nuevaRevision() }) };
      case "anular":
        return { pasarela: await a.guardar(id, { ...datos, anulada: true }) };
      case "renovar": {
        // Token nuevo: el anterior deja de valer en el acto.
        const token = nuevoToken();
        const d = { ...datos, anulada: false, caduca: ahora + dias(b.dias) * 86_400_000, pista: pistaToken(token), revision: nuevaRevision() };
        return { pasarela: await a.guardar(id, d, huellaToken(token)), token };
      }
      case "borrar":
        await a.borrar(id);
        return { borrada: true };
      default:
        throw new ErrorClientes("No se entiende la orden");
    }
  });
}
