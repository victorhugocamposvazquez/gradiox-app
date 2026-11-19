import { NextResponse } from "next/server";
import { almacenAccesos } from "@/accesos/almacen";
import { quienEs } from "@/accesos/quien";
import { almacenAjustes, datosEquipo } from "@/ajustes/almacen";
import { almacenClientes } from "@/clientes/almacen";
import { conApuntes, nuevoId } from "@/clientes/modelo";

const CABECERAS = { "Cache-Control": "no-store" };
const limpio = (v: unknown, largo: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, largo) : "");

/**
 * Mis datos: el propio nombre y el nombre de la empresa. El equipo de Gradiox
 * los guarda en los ajustes; el usuario de un cliente cambia su nombre en su
 * acceso y el de la empresa en la ficha del cliente (lo ven todos los de esa
 * empresa y el panel interno, con un apunte en el historial de la ficha).
 */
export async function POST(peticion: Request) {
  const q = await quienEs(peticion).catch(() => null);
  if (!q) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: CABECERAS });
  const d = (await peticion.json().catch(() => ({}))) as { nombre?: unknown; empresa?: unknown };
  const nombre = limpio(d.nombre, 120);
  const empresa = limpio(d.empresa, 120);
  if (!nombre || !empresa) return NextResponse.json({ error: "Faltan tu nombre o el de la empresa." }, { status: 400, headers: CABECERAS });
  try {
    if (q.tipo === "equipo") {
      const a = almacenAjustes();
      await a.guardar("equipo", { ...(await datosEquipo(a)), nombre, empresa });
      return NextResponse.json({ ok: true, nombre, empresa }, { headers: CABECERAS });
    }
    const cambiado = await almacenAccesos().cambiar(q.acceso.id, { nombre });
    if (!cambiado) return NextResponse.json({ error: "No se ha podido guardar." }, { status: 503, headers: CABECERAS });
    const clientes = almacenClientes();
    const ficha = await clientes.leer(q.acceso.cliente);
    if (ficha && ficha.nombre !== empresa) {
      const { id, creado, actualizado, ...datos } = ficha;
      void id;
      void creado;
      void actualizado;
      const apunte = { id: nuevoId(), t: Date.now(), texto: `${nombre} (${q.acceso.usuario}) cambió en la app el nombre de la empresa de «${ficha.nombre}» a «${empresa}».`, auto: true };
      await clientes.guardar(ficha.id, { ...datos, nombre: empresa, historial: conApuntes(ficha.historial, [apunte]) });
    }
    return NextResponse.json({ ok: true, nombre, empresa: ficha ? empresa : "" }, { headers: CABECERAS });
  } catch {
    return NextResponse.json({ error: "No se ha podido guardar. Vuelve a intentarlo en un momento." }, { status: 503, headers: CABECERAS });
  }
}
