import { NextResponse } from "next/server";
import { puedeVer, quienEs, veDemo } from "@/accesos/quien";
import { almacenPasarelas } from "@/pasarelas/almacen";
import { almacenClientes } from "@/clientes/almacen";
import { instalacionesVivas, ubicarCon } from "@/vivo/consulta";

// Las instalaciones conectadas con sus servicios en vivo, para Hoy y Servicios. Solo con sesión iniciada en la app;
// el usuario de un cliente solo recibe las de su cliente. `demo` dice si ve también la nave de demostración.
export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const cabeceras = { "Cache-Control": "no-store" };
  try {
    const q = await quienEs(peticion);
    if (!q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cabeceras });
    const ahora = Date.now();
    // Sin las fichas de clientes se sigue enseñando todo, cada instalación como su propia ubicación.
    const fichas = (await almacenClientes().listar().catch(() => [])).map(({ cliente: c }) => ({ id: c.id, nombre: c.nombre, instalaciones: c.instalaciones.map((i) => ({ id: i.id, nombre: i.nombre })) }));
    const instalaciones = await instalacionesVivas(almacenPasarelas(), ahora, (p) => puedeVer(q, p), ubicarCon(fichas));
    return NextResponse.json({ ahora, demo: veDemo(q), quien: q.tipo, instalaciones }, { headers: cabeceras });
  } catch {
    return NextResponse.json({ error: "No se han podido leer las instalaciones conectadas" }, { status: 503, headers: cabeceras });
  }
}
