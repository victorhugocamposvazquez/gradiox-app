import { almacenAccesos } from "@/accesos/almacen";
import { LARGO_MINIMO, huellaClave, leerAccion, nuevaClave, nuevoIdAcceso, sinHuella } from "@/accesos/modelo";
import { esId } from "@/clientes/modelo";
import { ErrorClientes, conClientes, cuerpoJson } from "@/clientes/rutas";
import { almacenPasarelas } from "@/pasarelas/almacen";
import type { Pasarela } from "@/pasarelas/modelo";
import type { AlmacenClientes } from "@/clientes/almacen";

// La app del cliente desde su ficha del panel: sus usuarios y qué instalaciones conectadas son suyas.
export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };
const NO_ESTA = new ErrorClientes("Ese cliente no existe", 404);

async function estado(c: AlmacenClientes, id: string) {
  const [accesos, pasarelas, clientes] = await Promise.all([almacenAccesos().deCliente(id), almacenPasarelas().listar(), c.listar()]);
  const nombres = new Map(clientes.map((x) => [x.cliente.id, x.cliente.nombre]));
  return {
    ahora: Date.now(),
    accesos: accesos.map(sinHuella),
    pasarelas: pasarelas
      .filter((p) => !p.anulada)
      .map((p: Pasarela) => ({ id: p.id, nombre: p.nombre, suya: p.cliente === id, ubicacion: p.cliente === id ? (p.ubicacion ?? "") : "", ...(p.cliente && p.cliente !== id ? { deOtro: nombres.get(p.cliente) ?? "otro cliente" } : {}), ultima: p.contacto?.t ?? null })),
  };
}

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conClientes(async (c) => {
    if (!esId(id) || !(await c.leer(id))) throw NO_ESTA;
    return estado(c, id);
  });
}

export async function POST(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const accion = leerAccion(await cuerpoJson(peticion));
  return conClientes(async (c) => {
    if (!esId(id) || !(await c.leer(id))) throw NO_ESTA;
    if ("error" in accion) throw new ErrorClientes(accion.error);
    const a = almacenAccesos();
    const suyo = async (acceso: string) => {
      const x = esId(acceso) ? await a.leer(acceso) : null;
      if (!x || x.cliente !== id) throw new ErrorClientes("Ese usuario no es de este cliente", 404);
      return x;
    };
    let clave: string | undefined;
    switch (accion.accion) {
      case "crear": {
        clave = nuevaClave();
        if (clave.length < LARGO_MINIMO) throw new ErrorClientes("No se ha podido crear la contraseña");
        const creado = await a.crear({ id: nuevoIdAcceso(), cliente: id, usuario: accion.usuario, nombre: accion.nombre, demo: accion.demo, activo: true, version: 1, creado: Date.now(), ultimo: null, pideClave: null, huella: await huellaClave(clave) });
        if (!creado) throw new ErrorClientes(`Ya hay alguien con el usuario «${accion.usuario}». Elige otro.`, 409);
        break;
      }
      case "clave": {
        await suyo(accion.id);
        clave = nuevaClave();
        // La contraseña anterior deja de valer y se cierran sus sesiones abiertas.
        await a.cambiar(accion.id, { huella: await huellaClave(clave), subirVersion: true });
        break;
      }
      case "cambiar": {
        const antes = await suyo(accion.id);
        await a.cambiar(accion.id, { nombre: accion.nombre, demo: accion.demo, activo: accion.activo, subirVersion: accion.activo === false && antes.activo });
        break;
      }
      case "borrar":
        await suyo(accion.id);
        await a.borrar(accion.id);
        break;
      case "instalacion": {
        const ps = almacenPasarelas();
        const p = esId(accion.pasarela) ? await ps.leer(accion.pasarela) : null;
        if (!p) throw new ErrorClientes("Esa instalación no existe", 404);
        const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
        if (accion.suya) await ps.guardar(p.id, { ...datos, cliente: id, ubicacion: p.cliente === id ? p.ubicacion : undefined });
        else if (p.cliente === id) await ps.guardar(p.id, { ...datos, cliente: undefined, ubicacion: undefined });
        break;
      }
      case "ubicacion": {
        const ps = almacenPasarelas();
        const p = esId(accion.pasarela) ? await ps.leer(accion.pasarela) : null;
        if (!p || p.cliente !== id) throw new ErrorClientes("Esa instalación no es de este cliente", 404);
        const ficha = await c.leer(id);
        if (accion.ubicacion && !ficha?.instalaciones.some((i) => i.id === accion.ubicacion)) throw new ErrorClientes("Esa ubicación no está en la ficha", 404);
        const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
        await ps.guardar(p.id, { ...datos, ubicacion: accion.ubicacion || undefined });
        break;
      }
    }
    return { ...(await estado(c, id)), ...(clave ? { clave } : {}) };
  });
}
