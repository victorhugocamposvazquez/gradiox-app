import { ErrorClientes, cuerpoJson } from "@/clientes/rutas";
import { nuevoId } from "@/clientes/modelo";
import { dias, huellaToken, nuevoToken, pasarelaVacia, resumir } from "@/pasarelas/modelo";
import { conPasarelas } from "@/pasarelas/rutas";

// Pasarelas de prueba (zona interna). Solo con sesión iniciada en el panel.
export const dynamic = "force-dynamic";

export const GET = () =>
  conPasarelas(async (a) => {
    const ahora = Date.now();
    return { guardado: a.tipo, ahora, pasarelas: (await a.listar()).map((p) => resumir(p, ahora)) };
  });

export async function POST(peticion: Request) {
  const b = ((await cuerpoJson(peticion)) ?? {}) as Record<string, unknown>;
  return conPasarelas(async (a) => {
    const ahora = Date.now();
    const token = nuevoToken();
    const datos = pasarelaVacia(typeof b.nombre === "string" ? b.nombre : "", token, ahora, dias(b.dias));
    if (!datos.nombre) throw new ErrorClientes("Falta el nombre de la instalación");
    const p = await a.crear(nuevoId(), huellaToken(token), datos);
    // El token solo se enseña ahora: después no se puede recuperar, solo cambiar por otro.
    return { pasarela: resumir(p, ahora), token };
  });
}
