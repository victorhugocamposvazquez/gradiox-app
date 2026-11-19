import { almacenAccesos } from "@/accesos/almacen";
import { conClientes } from "@/clientes/rutas";

// Los usuarios de clientes que han pedido una contraseña nueva desde la entrada de la app.
export const dynamic = "force-dynamic";

export const GET = () =>
  conClientes(async (c) => {
    const [pendientes, clientes] = await Promise.all([almacenAccesos().pendientes(), c.listar()]);
    const nombres = new Map(clientes.map((x) => [x.cliente.id, x.cliente.nombre]));
    return { pendientes: pendientes.map((a) => ({ id: a.id, usuario: a.usuario, nombre: a.nombre, cliente: a.cliente, nombreCliente: nombres.get(a.cliente) ?? "", cuando: a.pideClave })) };
  });
