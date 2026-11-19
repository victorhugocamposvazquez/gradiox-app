// Ajustes sueltos de Gradiox que se cambian desde la app, como el nombre y la
// empresa del usuario del equipo (que no tiene fila propia porque vive en el
// servidor). Con base de datos quedan guardados; sin ella, en la memoria.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";

export type DatosEquipo = { nombre: string; empresa: string };
export const EQUIPO_POR_DEFECTO: DatosEquipo = { nombre: "Equipo de Gradiox", empresa: "Gradiox" };

export type AlmacenAjustes = {
  tipo: "memoria" | "base";
  leer<T extends object>(clave: string): Promise<T | null>;
  guardar(clave: string, valor: object): Promise<void>;
};

export function ajustesEnMemoria(): AlmacenAjustes {
  const todos = new Map<string, string>();
  return {
    tipo: "memoria",
    async leer(clave) {
      const v = todos.get(clave);
      return v === undefined ? null : JSON.parse(v);
    },
    async guardar(clave, valor) {
      todos.set(clave, JSON.stringify(valor));
    },
  };
}

export const TABLAS_AJUSTES = [
  "create table if not exists gradiox_ajustes (clave text primary key, valor jsonb not null, actualizado bigint not null)",
  "alter table gradiox_ajustes enable row level security",
];

export function ajustesPostgres(url: string): AlmacenAjustes & { cerrar(): Promise<void> } {
  const pool = new Pool(opcionesBase(url));
  let lista: Promise<unknown> | undefined;
  const preparada = () =>
    (lista ??= (async () => {
      for (const t of TABLAS_AJUSTES) await pool.query(t);
    })().catch((e) => {
      lista = undefined;
      throw e;
    }));
  return {
    tipo: "base",
    async leer(clave) {
      await preparada();
      const r = await pool.query<{ valor: never }>("select valor from gradiox_ajustes where clave = $1", [clave]);
      return r.rows[0]?.valor ?? null;
    },
    async guardar(clave, valor) {
      await preparada();
      await pool.query(
        "insert into gradiox_ajustes (clave, valor, actualizado) values ($1, $2::jsonb, $3) on conflict (clave) do update set valor = excluded.valor, actualizado = excluded.actualizado",
        [clave, JSON.stringify(valor), Date.now()],
      );
    },
    cerrar: () => pool.end(),
  };
}

const global = globalThis as { __gradioxAjustes?: AlmacenAjustes };
/** Uno solo por proceso. */
export function almacenAjustes(): AlmacenAjustes {
  if (global.__gradioxAjustes) return global.__gradioxAjustes;
  const url = direccionBase();
  return (global.__gradioxAjustes = url ? ajustesPostgres(url) : ajustesEnMemoria());
}

/** Nombre y empresa del usuario del equipo, con lo de por defecto si no se han cambiado. */
export async function datosEquipo(a: AlmacenAjustes = almacenAjustes()): Promise<DatosEquipo> {
  const d = await a.leer<Partial<DatosEquipo>>("equipo").catch(() => null);
  return { nombre: d?.nombre || EQUIPO_POR_DEFECTO.nombre, empresa: d?.empresa || EQUIPO_POR_DEFECTO.empresa };
}
