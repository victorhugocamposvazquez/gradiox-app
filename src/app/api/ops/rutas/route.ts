import { rutaDeCliente, versionesPublicadas } from "@/clientes/ruta-servidor";
import { conClientes } from "@/clientes/rutas";
import { almacenPasarelas } from "@/pasarelas/almacen";

// La hoja de ruta de todos los clientes, resumida, para la portada del panel.
export const dynamic = "force-dynamic";

export async function GET() {
  return conClientes(async (a) => {
    const [fichas, pasarelas, pub] = await Promise.all([a.listar(), almacenPasarelas().listar(), versionesPublicadas()]);
    const ahora = Date.now();
    const rutas = await Promise.all(
      fichas.map(async ({ cliente: c }) => {
        const r = await rutaDeCliente(c, pasarelas, pub, ahora);
        return { id: c.id, nombre: c.nombre, hechos: r.hechos, total: r.alta.length, siguiente: r.siguiente?.accion ?? null, paso: r.siguiente ? r.alta.findIndex((x) => x.id === r.siguiente!.id) + 1 : 0, enMarcha: r.enMarcha, mal: r.seguimiento.filter((x) => x.nivel === "mal").map((x) => x.detalle), mirar: r.seguimiento.filter((x) => x.nivel === "mirar").length };
      }),
    );
    return { ahora, rutas };
  });
}
