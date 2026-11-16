// Dónde se guardan los clientes y sus fotos. Con una base de datos conectada
// quedan guardados; sin ella se usa la memoria del proceso, válida solo para pruebas.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";
import { completar, nuevoId, type Cliente, type DatosCliente, type DatosFoto, type Foto } from "./modelo";

export type Imagen = { mime: string; bytes: Uint8Array };

export type AlmacenClientes = {
  tipo: "memoria" | "base";
  /** Todas las fichas con su número de fotos, la cambiada más recientemente primero. */
  listar(): Promise<{ cliente: Cliente; fotos: number }[]>;
  leer(id: string): Promise<Cliente | null>;
  crear(datos: DatosCliente): Promise<Cliente>;
  guardar(id: string, datos: DatosCliente): Promise<Cliente | null>;
  /** Borra el cliente y todas sus fotos. */
  borrar(id: string): Promise<boolean>;
  fotos(cliente: string): Promise<Foto[]>;
  imagen(id: string): Promise<Imagen | null>;
  anadirFoto(cliente: string, datos: DatosFoto, imagen: Imagen): Promise<Foto | null>;
  cambiarFoto(id: string, datos: DatosFoto): Promise<Foto | null>;
  borrarFoto(id: string): Promise<boolean>;
};

export function clientesEnMemoria(reloj: () => number = Date.now): AlmacenClientes {
  const clientes = new Map<string, Cliente>();
  const fotos = new Map<string, Foto & { imagen: Imagen }>();
  const sinImagen = ({ imagen: _, ...f }: Foto & { imagen: Imagen }): Foto => f;
  const deCliente = (id: string) => [...fotos.values()].filter((f) => f.cliente === id);
  return {
    tipo: "memoria",
    async listar() {
      return [...clientes.values()].sort((a, b) => b.actualizado - a.actualizado).map((c) => ({ cliente: c, fotos: deCliente(c.id).length }));
    },
    async leer(id) {
      return clientes.get(id) ?? null;
    },
    async crear(datos) {
      const t = reloj();
      const c: Cliente = { ...datos, id: nuevoId(), creado: t, actualizado: t };
      clientes.set(c.id, c);
      return c;
    },
    async guardar(id, datos) {
      const antes = clientes.get(id);
      if (!antes) return null;
      const c: Cliente = { ...datos, id, creado: antes.creado, actualizado: reloj() };
      clientes.set(id, c);
      return c;
    },
    async borrar(id) {
      for (const f of deCliente(id)) fotos.delete(f.id);
      return clientes.delete(id);
    },
    async fotos(cliente) {
      return deCliente(cliente).sort((a, b) => a.creada - b.creada).map(sinImagen);
    },
    async imagen(id) {
      return fotos.get(id)?.imagen ?? null;
    },
    async anadirFoto(cliente, datos, imagen) {
      if (!clientes.has(cliente)) return null;
      const f = { ...datos, id: nuevoId(), cliente, mime: imagen.mime, tamano: imagen.bytes.length, creada: reloj(), imagen };
      fotos.set(f.id, f);
      return sinImagen(f);
    },
    async cambiarFoto(id, datos) {
      const f = fotos.get(id);
      if (!f) return null;
      Object.assign(f, datos);
      return sinImagen(f);
    },
    async borrarFoto(id) {
      return fotos.delete(id);
    },
  };
}

const TABLAS = [
  `create table if not exists gradiox_clientes (
    id uuid primary key,
    datos jsonb not null,
    creado bigint not null,
    actualizado bigint not null
  )`,
  `create table if not exists gradiox_fotos (
    id uuid primary key,
    cliente uuid not null references gradiox_clientes (id) on delete cascade,
    instalacion text not null default '',
    punto text not null default '',
    tipo text not null,
    pie text not null default '',
    mime text not null,
    tamano integer not null,
    creada bigint not null,
    imagen bytea not null
  )`,
  "create index if not exists gradiox_fotos_cliente on gradiox_fotos (cliente, creada)",
];

type FilaCliente = { id: string; datos: DatosCliente; creado: string; actualizado: string };
type FilaFoto = Omit<Foto, "creada"> & { creada: string };
const cliente = (f: FilaCliente): Cliente => ({ ...completar(f.datos), id: f.id, creado: Number(f.creado), actualizado: Number(f.actualizado) });
const foto = (f: FilaFoto): Foto => ({ ...f, creada: Number(f.creada) });
const CAMPOS_FOTO = "id, cliente, instalacion, punto, tipo, pie, mime, tamano, creada";

export function clientesPostgres(url: string, reloj: () => number = Date.now): AlmacenClientes & { cerrar(): Promise<void> } {
  const pool = new Pool(opcionesBase(url));
  let lista: Promise<unknown> | undefined;
  // Las tablas se crean solas la primera vez. Si falla, se reintenta en la siguiente llamada.
  const preparada = () =>
    (lista ??= (async () => {
      for (const t of TABLAS) await pool.query(t);
    })().catch((e) => {
      lista = undefined;
      throw e;
    }));

  return {
    tipo: "base",
    async listar() {
      await preparada();
      const r = await pool.query<FilaCliente & { fotos: string }>(
        "select c.id, c.datos, c.creado, c.actualizado, (select count(*) from gradiox_fotos f where f.cliente = c.id) as fotos from gradiox_clientes c order by c.actualizado desc",
      );
      return r.rows.map((f) => ({ cliente: cliente(f), fotos: Number(f.fotos) }));
    },
    async leer(id) {
      await preparada();
      const r = await pool.query<FilaCliente>("select id, datos, creado, actualizado from gradiox_clientes where id = $1", [id]);
      return r.rows[0] ? cliente(r.rows[0]) : null;
    },
    async crear(datos) {
      await preparada();
      const t = reloj();
      const id = nuevoId();
      await pool.query("insert into gradiox_clientes (id, datos, creado, actualizado) values ($1, $2::jsonb, $3, $3)", [id, JSON.stringify(datos), t]);
      return { ...datos, id, creado: t, actualizado: t };
    },
    async guardar(id, datos) {
      await preparada();
      const r = await pool.query<FilaCliente>("update gradiox_clientes set datos = $2::jsonb, actualizado = $3 where id = $1 returning id, datos, creado, actualizado", [id, JSON.stringify(datos), reloj()]);
      return r.rows[0] ? cliente(r.rows[0]) : null;
    },
    async borrar(id) {
      await preparada();
      const r = await pool.query("delete from gradiox_clientes where id = $1", [id]);
      return (r.rowCount ?? 0) > 0;
    },
    async fotos(idCliente) {
      await preparada();
      const r = await pool.query<FilaFoto>(`select ${CAMPOS_FOTO} from gradiox_fotos where cliente = $1 order by creada`, [idCliente]);
      return r.rows.map(foto);
    },
    async imagen(id) {
      await preparada();
      const r = await pool.query<{ mime: string; imagen: Buffer }>("select mime, imagen from gradiox_fotos where id = $1", [id]);
      return r.rows[0] ? { mime: r.rows[0].mime, bytes: new Uint8Array(r.rows[0].imagen) } : null;
    },
    async anadirFoto(idCliente, datos, imagen) {
      await preparada();
      const r = await pool.query<FilaFoto>(
        `insert into gradiox_fotos (id, cliente, instalacion, punto, tipo, pie, mime, tamano, creada, imagen)
         select $1, c.id, $3, $4, $5, $6, $7, $8, $9, $10 from gradiox_clientes c where c.id = $2
         returning ${CAMPOS_FOTO}`,
        [nuevoId(), idCliente, datos.instalacion, datos.punto, datos.tipo, datos.pie, imagen.mime, imagen.bytes.length, reloj(), Buffer.from(imagen.bytes)],
      );
      return r.rows[0] ? foto(r.rows[0]) : null;
    },
    async cambiarFoto(id, datos) {
      await preparada();
      const r = await pool.query<FilaFoto>(`update gradiox_fotos set instalacion = $2, punto = $3, tipo = $4, pie = $5 where id = $1 returning ${CAMPOS_FOTO}`, [id, datos.instalacion, datos.punto, datos.tipo, datos.pie]);
      return r.rows[0] ? foto(r.rows[0]) : null;
    },
    async borrarFoto(id) {
      await preparada();
      const r = await pool.query("delete from gradiox_fotos where id = $1", [id]);
      return (r.rowCount ?? 0) > 0;
    },
    cerrar: () => pool.end(),
  };
}

const global = globalThis as { __gradioxClientes?: AlmacenClientes };
/** Uno solo por proceso. */
export function almacenClientes(): AlmacenClientes {
  if (global.__gradioxClientes) return global.__gradioxClientes;
  const url = direccionBase();
  return (global.__gradioxClientes = url ? clientesPostgres(url) : clientesEnMemoria());
}
