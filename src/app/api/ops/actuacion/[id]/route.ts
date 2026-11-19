import { ErrorClientes, cuerpoJson } from "@/clientes/rutas";
import { esId } from "@/clientes/modelo";
import { conPasarelas } from "@/pasarelas/rutas";
import { ErrorActua, aplicar, conEscribibles, deshacer, estadoActua, fichaValida, guardarActua, tarifaValida } from "@/actua/servicio";
import { detectarCamaras, montar } from "@/actua/camaras";
import { lineasEscribibles } from "@/actua/actuacion";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

/** Los fallos de la actuación son explicaciones para quien está en la pantalla, no averías del servidor. */
async function claro<T>(hacer: () => Promise<T>): Promise<T> {
  try {
    return await hacer();
  } catch (e) {
    if (e instanceof ErrorActua) throw new ErrorClientes(e.message);
    throw e;
  }
}

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa instalación no existe", 404);
    return estadoActua(a, p, Date.now());
  });
}

export async function POST(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const b = ((await cuerpoJson(peticion)) ?? {}) as Record<string, unknown>;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa instalación no existe", 404);
    const ahora = Date.now();
    const clave = typeof b.camara === "string" ? b.camara : "";
    await claro(async () => {
      switch (b.accion) {
        case "tarifa":
          if (!tarifaValida(b.tarifa)) throw new ErrorClientes("La tarifa no está completa: hace falta el tramo de cada una de las 24 horas y un precio por tramo");
          await guardarActua(a, p, { tarifa: b.tarifa });
          return;
        case "ficha": {
          const d = detectarCamaras(p.variables).find((x) => x.clave === clave);
          if (!d) throw new ErrorClientes("Esa cámara no está en la lista de esta instalación");
          if (b.ficha !== null && !fichaValida(b.ficha)) throw new ErrorClientes("Revisa la ficha: el volumen en m³ y el frío que le llega (o la potencia de su compresor) en kW");
          await guardarActua(a, p, { ficha: { clave, ficha: b.ficha } });
          return;
        }
        case "permitir": {
          // Apunta las tres consignas de la cámara en «Órdenes al PLC», con sus límites. Activar las órdenes sigue siendo aparte.
          const d = detectarCamaras(p.variables).find((x) => x.clave === clave);
          if (!d) throw new ErrorClientes("Esa cámara no está en la lista de esta instalación");
          const m = montar(d, p.actua?.camaras?.[clave], new Map((await a.ultimas(id)).map((l) => [l.v, l.x])));
          if ("falta" in m) throw new ErrorClientes(m.falta);
          await guardarActua(a, p, { escritura: conEscribibles(p, lineasEscribibles(d.vars, m.camara.suelo, m.camara.techo)) });
          return;
        }
        case "aplicar":
          await aplicar(a, p, clave, ahora);
          return;
        case "deshacer": {
          const act = (await a.actuaciones(id)).find((x) => x.id === b.actuacion);
          if (!act) throw new ErrorClientes("Esa actuación no existe");
          await deshacer(a, p, act, "deshecha", "Deshecha desde el panel", ahora);
          return;
        }
        default:
          throw new ErrorClientes("No se entiende la orden");
      }
    });
    const nueva = await a.leer(id);
    return estadoActua(a, nueva ?? p, Date.now());
  });
}
