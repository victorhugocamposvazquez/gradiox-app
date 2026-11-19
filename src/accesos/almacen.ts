// Dónde se guardan los accesos de los clientes. Con base de datos quedan
// guardados; sin ella, en la memoria del proceso, válida solo para pruebas.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";
import type { AccesoGuardado } from "./modelo";

export type CambioAcceso = Partial<Pick<AccesoGuardado, "nombre" | "demo" | "activo" | "huella">> & { subirVersion?: boolean };

export type AlmacenAccesos = {
  tipo: "memoria" | "base";
  /** Los de un cliente, del más antiguo al más nuevo. */
  deCliente(cliente: string): Promise<AccesoGuardado[]>;
  leer(id: string): Promise<AccesoGuardado | null>;
  porUsuario(usuario: string): Promise<AccesoGuardado | null>;
  /** Devuelve null si el usuario ya existe. */
  crear(a: AccesoGuardado): Promise<AccesoGuardado | null>;
  cambiar(id: string, c: CambioAcceso): Promise<AccesoGuardado | null>;
  borrar(id: string): Promise<boolean>;
  entro(id: string, t: number): Promise<void>;
  /** Apunta que ha pedido una contraseña nueva. Devuelve false si el usuario no existe. */
  pedirClave(usuario: string, t: number): Promise<boolean>;
  /** Los que han pedido contraseña nueva y no se les ha dado, de todos los clientes. */
  pendientes(): Promise<AccesoGuardado[]>;
};

export function accesosEnMemoria(): AlmacenAccesos {
  const todos = new Map<string, AccesoGuardado>();
  return {
    tipo: "memoria",
    async deCliente(cliente) {
      return [...todos.values()].filter((a) => a.cliente === cliente).sort((a, b) => a.creado - b.creado);
    },
    async leer(id) {
      return todos.get(id) ?? null;
    },
    async porUsuario(usuario) {
      return [...todos.values()].find((a) => a.usuario === usuario) ?? null;
    },
    async crear(a) {
      if ([...todos.values()].some((x) => x.usuario === a.usuario)) return null;
      todos.set(a.id, { ...a });
      return { ...a };
    },
    async cambiar(id, { subirVersion, ...c }) {
      const a = todos.get(id);
      if (!a) return null;
      const limpio = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined));
      const nuevo = { ...a, ...limpio, version: a.version + (subirVersion ? 1 : 0), pideClave: c.huella ? null : a.pideClave };
      todos.set(id, nuevo);
      return { ...nuevo };
    },
    async borrar(id) {
      return todos.delete(id);
    },
    async entro(id, t) {
      const a = todos.get(id);
      if (a) a.ultimo = t;
    },
    async pedirClave(usuario, t) {
      const a = [...todos.values()].find((x) => x.usuario === usuario);
      if (a) a.pideClave = t;
      return !!a;
    },
    async pendientes() {
      return [...todos.values()].filter((a) => a.pideClave !== null).sort((a, b) => (a.pideClave ?? 0) - (b.pideClave ?? 0));
    },
  };
}

export const TABLAS_ACCESOS = [
  `create table if not exists gradiox_accesos (
    id uuid primary key,
    cliente text not null,
    usuario text not null unique,
    nombre text not null default '',
    huella text not null,
    demo boolean not null default true,
    activo boolean not null default true,
    version integer not null default 1,
    creado bigint not null,
    ultimo bigint
  )`,
  "create index if not exists gradiox_accesos_cliente on gradiox_accesos (cliente)",
  "alter table gradiox_accesos add column if not exists pide_clave bigint",
  "alter table gradiox_accesos enable row level security",
];

type Fila = Omit<AccesoGuardado, "creado" | "ultimo" | "pideClave"> & { creado: string; ultimo: string | null; pide_clave: string | null };
const CAMPOS = "id, cliente, usuario, nombre, huella, demo, activo, version, creado, ultimo, pide_clave";
const acceso = ({ pide_clave, ...f }: Fila): AccesoGuardado => ({ ...f, creado: Number(f.creado), ultimo: f.ultimo === null ? null : Number(f.ultimo), pideClave: pide_clave === null ? null : Number(pide_clave) });

export function accesosPostgres(url: string): AlmacenAccesos & { cerrar(): Promise<void> } {
  const pool = new Pool(opcionesBase(url));
  let lista: Promise<unknown> | undefined;
  const preparada = () =>
    (lista ??= (async () => {
      for (const t of TABLAS_ACCESOS) await pool.query(t);
    })().catch((e) => {
      lista = undefined;
      throw e;
    }));
  const una = async (sql: string, p: unknown[]) => {
    await preparada();
    const r = await pool.query<Fila>(sql, p);
    return r.rows[0] ? acceso(r.rows[0]) : null;
  };
  return {
    tipo: "base",
    async deCliente(cliente) {
      await preparada();
      return (await pool.query<Fila>(`select ${CAMPOS} from gradiox_accesos where cliente = $1 order by creado`, [cliente])).rows.map(acceso);
    },
    leer: (id) => una(`select ${CAMPOS} from gradiox_accesos where id = $1`, [id]),
    porUsuario: (usuario) => una(`select ${CAMPOS} from gradiox_accesos where usuario = $1`, [usuario]),
    crear: (a) =>
      una(
        `insert into gradiox_accesos (${CAMPOS}) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (usuario) do nothing returning ${CAMPOS}`,
        [a.id, a.cliente, a.usuario, a.nombre, a.huella, a.demo, a.activo, a.version, a.creado, a.ultimo, a.pideClave],
      ),
    cambiar: (id, c) =>
      una(
        `update gradiox_accesos set nombre = coalesce($2, nombre), demo = coalesce($3, demo), activo = coalesce($4, activo), huella = coalesce($5, huella), version = version + $6, pide_clave = case when $5::text is null then pide_clave end where id = $1 returning ${CAMPOS}`,
        [id, c.nombre ?? null, c.demo ?? null, c.activo ?? null, c.huella ?? null, c.subirVersion ? 1 : 0],
      ),
    async borrar(id) {
      await preparada();
      return ((await pool.query("delete from gradiox_accesos where id = $1", [id])).rowCount ?? 0) > 0;
    },
    async entro(id, t) {
      await preparada();
      await pool.query("update gradiox_accesos set ultimo = $2 where id = $1", [id, t]);
    },
    async pedirClave(usuario, t) {
      await preparada();
      return ((await pool.query("update gradiox_accesos set pide_clave = $2 where usuario = $1", [usuario, t])).rowCount ?? 0) > 0;
    },
    async pendientes() {
      await preparada();
      return (await pool.query<Fila>(`select ${CAMPOS} from gradiox_accesos where pide_clave is not null order by pide_clave`)).rows.map(acceso);
    },
    cerrar: () => pool.end(),
  };
}

const global = globalThis as { __gradioxAccesos?: AlmacenAccesos };
/** Uno solo por proceso. */
export function almacenAccesos(): AlmacenAccesos {
  if (global.__gradioxAccesos) return global.__gradioxAccesos;
  const url = direccionBase();
  return (global.__gradioxAccesos = url ? accesosPostgres(url) : accesosEnMemoria());
}
