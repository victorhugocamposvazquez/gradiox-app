// Dónde se guardan las pasarelas de prueba y lo que entregan. Con base de datos
// queda guardado; sin ella, en la memoria del proceso, válida solo para pruebas.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";
import type { Contacto, DatosPasarela, LecturaOpc, Pasarela } from "./modelo";
import { ABIERTAS, CADUCA_MS, MOTIVO_CADUCADA, type CambioOrden, type EstadoOrden, type Orden } from "./ordenes";

export type FiltroOrdenes = { desde?: number; hasta?: number; limite?: number };

export type UltimaLectura = LecturaOpc & { simulada: boolean };

export type AlmacenPasarelas = {
  tipo: "memoria" | "base";
  listar(): Promise<Pasarela[]>;
  leer(id: string): Promise<Pasarela | null>;
  porHuella(huella: string): Promise<Pasarela | null>;
  crear(id: string, huella: string, datos: DatosPasarela): Promise<Pasarela>;
  /** Cambia los datos y, si se da, la huella del token (al renovarlo). */
  guardar(id: string, datos: DatosPasarela, huella?: string): Promise<Pasarela | null>;
  borrar(id: string): Promise<boolean>;
  contactar(id: string, contacto: Contacto): Promise<void>;
  /** Guarda un lote. Si el programa repite un envío, no se duplica. */
  anotar(id: string, lecturas: LecturaOpc[], simulada: boolean): Promise<void>;
  /** La última lectura de cada variable. */
  ultimas(id: string): Promise<UltimaLectura[]>;
  /** Apunta una orden nueva. Las órdenes no se borran ni se recortan (salvo al borrar la instalación). */
  ponerOrden(id: string, orden: Orden): Promise<void>;
  /**
   * Cambia una orden solo si está en uno de los estados dados, de una vez: así
   * el panel y el programa no se pisan. Devuelve la orden cambiada o null.
   */
  cambiarOrden(id: string, orden: string, cambio: CambioOrden, siEsta: EstadoOrden[]): Promise<Orden | null>;
  /** Pasa a caducadas las abiertas que nadie recogió a tiempo. */
  caducarOrdenes(id: string, ahora: number): Promise<void>;
  /** Las abiertas (pendientes o en el programa), de la más antigua a la más nueva. */
  ordenesAbiertas(id: string): Promise<Orden[]>;
  /** Historial por fechas de petición, de la más nueva a la más antigua. */
  ordenes(id: string, filtro?: FiltroOrdenes): Promise<Orden[]>;
};

export function pasarelasEnMemoria(reloj: () => number = Date.now): AlmacenPasarelas {
  const todas = new Map<string, Pasarela & { huella: string }>();
  const lecturas = new Map<string, Map<string, UltimaLectura[]>>();
  const ordenes = new Map<string, Orden[]>();
  const limpia = ({ huella: _, ...p }: Pasarela & { huella: string }): Pasarela => p;
  return {
    tipo: "memoria",
    async listar() {
      return [...todas.values()].sort((a, b) => b.creada - a.creada).map(limpia);
    },
    async leer(id) {
      const p = todas.get(id);
      return p ? limpia(p) : null;
    },
    async porHuella(huella) {
      const p = [...todas.values()].find((x) => x.huella === huella);
      return p ? limpia(p) : null;
    },
    async crear(id, huella, datos) {
      const t = reloj();
      const p = { ...datos, id, creada: t, actualizada: t, contacto: null, huella };
      todas.set(id, p);
      return limpia(p);
    },
    async guardar(id, datos, huella) {
      const antes = todas.get(id);
      if (!antes) return null;
      const p = { ...antes, ...datos, actualizada: reloj(), huella: huella ?? antes.huella };
      todas.set(id, p);
      return limpia(p);
    },
    async borrar(id) {
      lecturas.delete(id);
      ordenes.delete(id);
      return todas.delete(id);
    },
    async contactar(id, contacto) {
      const p = todas.get(id);
      if (p) p.contacto = contacto;
    },
    async anotar(id, lote, simulada) {
      const mias = lecturas.get(id) ?? new Map<string, UltimaLectura[]>();
      lecturas.set(id, mias);
      for (const l of lote) {
        const serie = mias.get(l.v) ?? [];
        if (serie.some((x) => x.t === l.t)) continue;
        serie.push({ ...l, simulada });
        serie.sort((a, b) => a.t - b.t);
        if (serie.length > 2000) serie.splice(0, serie.length - 2000);
        mias.set(l.v, serie);
      }
    },
    async ultimas(id) {
      return [...(lecturas.get(id)?.values() ?? [])].filter((s) => s.length).map((s) => s[s.length - 1]).sort((a, b) => a.v.localeCompare(b.v));
    },
    async ponerOrden(id, orden) {
      ordenes.set(id, [...(ordenes.get(id) ?? []), { ...orden }]);
    },
    async cambiarOrden(id, orden, cambio, siEsta) {
      const lista = ordenes.get(id) ?? [];
      const i = lista.findIndex((o) => o.id === orden && siEsta.includes(o.estado));
      if (i < 0) return null;
      lista[i] = { ...lista[i], ...cambio };
      return { ...lista[i] };
    },
    async caducarOrdenes(id, ahora) {
      for (const o of ordenes.get(id) ?? []) {
        if (ABIERTAS.includes(o.estado) && ahora - o.pedida > CADUCA_MS) Object.assign(o, { estado: "caducada", motivo: MOTIVO_CADUCADA, cambio: ahora });
      }
    },
    async ordenesAbiertas(id) {
      return (ordenes.get(id) ?? []).filter((o) => ABIERTAS.includes(o.estado)).map((o) => ({ ...o }));
    },
    async ordenes(id, filtro = {}) {
      return (ordenes.get(id) ?? [])
        .filter((o) => (filtro.desde === undefined || o.pedida >= filtro.desde) && (filtro.hasta === undefined || o.pedida <= filtro.hasta))
        .sort((a, b) => b.pedida - a.pedida)
        .slice(0, filtro.limite ?? 200)
        .map((o) => ({ ...o }));
    },
  };
}

// Las tablas llevan la seguridad por filas encendida y sin ninguna regla: solo
// entra el servidor, que se conecta como dueño. Desde fuera, con las claves
// públicas de Supabase, no se puede leer ni escribir nada en ellas.
export const TABLAS_PASARELAS = [
  `create table if not exists gradiox_pasarelas (
    id uuid primary key,
    huella text not null unique,
    datos jsonb not null,
    contacto jsonb,
    creada bigint not null,
    actualizada bigint not null
  )`,
  "alter table gradiox_pasarelas enable row level security",
  `create table if not exists gradiox_lecturas_opc (
    pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
    variable text not null,
    t bigint not null,
    valor jsonb,
    incidencia text,
    simulada boolean not null default false,
    recibida timestamptz not null default now(),
    primary key (pasarela, variable, t)
  )`,
  "alter table gradiox_lecturas_opc enable row level security",
  // Una fila por orden al PLC. Nunca se borra ni se recorta: es el registro de todo lo ejecutado.
  `create table if not exists gradiox_ordenes_opc (
    id text primary key,
    pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
    variable text not null,
    valor jsonb not null,
    antes jsonb,
    leido jsonb,
    estado text not null,
    motivo text,
    por text,
    pedida bigint not null,
    cambio bigint not null,
    simulada boolean not null default false
  )`,
  "create index if not exists gradiox_ordenes_opc_pasarela_pedida on gradiox_ordenes_opc (pasarela, pedida desc)",
  "alter table gradiox_ordenes_opc enable row level security",
];

type FilaOrden = { id: string; variable: string; valor: Orden["valor"]; antes: Orden["antes"] | null; leido: Orden["leido"] | null; estado: EstadoOrden; motivo: string | null; por: string | null; pedida: string; cambio: string; simulada: boolean };
const CAMPOS_ORDEN = "id, variable, valor, antes, leido, estado, motivo, por, pedida, cambio, simulada";
// Un valor null guardado como jsonb vuelve como null; «sin dato» se guarda como columna vacía.
const orden = (f: FilaOrden): Orden => ({
  id: f.id,
  n: f.variable,
  valor: f.valor,
  ...(f.antes !== null ? { antes: f.antes } : {}),
  ...(f.leido !== null ? { leido: f.leido } : {}),
  estado: f.estado,
  ...(f.motivo ? { motivo: f.motivo } : {}),
  ...(f.por ? { por: f.por } : {}),
  pedida: Number(f.pedida),
  cambio: Number(f.cambio),
  ...(f.simulada ? { simulada: true } : {}),
});
const jsonb = (x: unknown) => (x === undefined ? null : JSON.stringify(x));

type Fila = { id: string; datos: DatosPasarela; contacto: Contacto | null; creada: string; actualizada: string };
const pasarela = (f: Fila): Pasarela => ({ ...f.datos, id: f.id, creada: Number(f.creada), actualizada: Number(f.actualizada), contacto: f.contacto });
const CAMPOS = "id, datos, contacto, creada, actualizada";

export function pasarelasPostgres(url: string, reloj: () => number = Date.now): AlmacenPasarelas & { cerrar(): Promise<void> } {
  const pool = new Pool(opcionesBase(url));
  let lista: Promise<unknown> | undefined;
  // Las tablas se crean solas la primera vez. Si falla, se reintenta en la siguiente llamada.
  const preparada = () =>
    (lista ??= (async () => {
      for (const t of TABLAS_PASARELAS) await pool.query(t);
    })().catch((e) => {
      lista = undefined;
      throw e;
    }));
  return {
    tipo: "base",
    async listar() {
      await preparada();
      return (await pool.query<Fila>(`select ${CAMPOS} from gradiox_pasarelas order by creada desc`)).rows.map(pasarela);
    },
    async leer(id) {
      await preparada();
      const r = await pool.query<Fila>(`select ${CAMPOS} from gradiox_pasarelas where id = $1`, [id]);
      return r.rows[0] ? pasarela(r.rows[0]) : null;
    },
    async porHuella(huella) {
      await preparada();
      const r = await pool.query<Fila>(`select ${CAMPOS} from gradiox_pasarelas where huella = $1`, [huella]);
      return r.rows[0] ? pasarela(r.rows[0]) : null;
    },
    async crear(id, huella, datos) {
      await preparada();
      const t = reloj();
      const r = await pool.query<Fila>(`insert into gradiox_pasarelas (id, huella, datos, creada, actualizada) values ($1, $2, $3, $4, $4) returning ${CAMPOS}`, [id, huella, JSON.stringify(datos), t]);
      return pasarela(r.rows[0]);
    },
    async guardar(id, datos, huella) {
      await preparada();
      const r = await pool.query<Fila>(`update gradiox_pasarelas set datos = $2, actualizada = $3, huella = coalesce($4, huella) where id = $1 returning ${CAMPOS}`, [id, JSON.stringify(datos), reloj(), huella ?? null]);
      return r.rows[0] ? pasarela(r.rows[0]) : null;
    },
    async borrar(id) {
      await preparada();
      return ((await pool.query("delete from gradiox_pasarelas where id = $1", [id])).rowCount ?? 0) > 0;
    },
    async contactar(id, contacto) {
      await preparada();
      await pool.query("update gradiox_pasarelas set contacto = $2 where id = $1", [id, JSON.stringify(contacto)]);
    },
    async anotar(id, lote, simulada) {
      if (!lote.length) return;
      await preparada();
      await pool.query(
        `insert into gradiox_lecturas_opc (pasarela, variable, t, valor, incidencia, simulada)
         select $1, l.v, l.t, l.x, l.c, $3
         from jsonb_to_recordset($2::jsonb) as l(v text, t bigint, x jsonb, c text)
         on conflict do nothing`,
        [id, JSON.stringify(lote.map((l) => ({ v: l.v, t: l.t, x: l.x, c: l.c ?? null }))), simulada],
      );
    },
    async ultimas(id) {
      await preparada();
      const r = await pool.query<{ variable: string; t: string; valor: LecturaOpc["x"]; incidencia: string | null; simulada: boolean }>(
        "select distinct on (variable) variable, t, valor, incidencia, simulada from gradiox_lecturas_opc where pasarela = $1 order by variable, t desc",
        [id],
      );
      return r.rows.map((f) => ({ v: f.variable, t: Number(f.t), x: f.valor, ...(f.incidencia ? { c: f.incidencia } : {}), simulada: f.simulada }));
    },
    async ponerOrden(id, o) {
      await preparada();
      await pool.query(
        `insert into gradiox_ordenes_opc (${CAMPOS_ORDEN}, pasarela) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [o.id, o.n, JSON.stringify(o.valor), jsonb(o.antes), jsonb(o.leido), o.estado, o.motivo ?? null, o.por ?? null, o.pedida, o.cambio, o.simulada === true, id],
      );
    },
    async cambiarOrden(id, ordenId, c, siEsta) {
      await preparada();
      const r = await pool.query<FilaOrden>(
        `update gradiox_ordenes_opc set
           estado = coalesce($3, estado), motivo = coalesce($4, motivo), antes = coalesce($5::jsonb, antes),
           leido = coalesce($6::jsonb, leido), simulada = simulada or $7, cambio = $8
         where pasarela = $1 and id = $2 and estado = any($9::text[])
         returning ${CAMPOS_ORDEN}`,
        [id, ordenId, c.estado ?? null, c.motivo ?? null, jsonb(c.antes), jsonb(c.leido), c.simulada === true, c.cambio, siEsta],
      );
      return r.rows[0] ? orden(r.rows[0]) : null;
    },
    async caducarOrdenes(id, ahora) {
      await preparada();
      await pool.query(
        "update gradiox_ordenes_opc set estado = 'caducada', motivo = $3, cambio = $2 where pasarela = $1 and estado = any($5::text[]) and pedida < $4",
        [id, ahora, MOTIVO_CADUCADA, ahora - CADUCA_MS, ABIERTAS],
      );
    },
    async ordenesAbiertas(id) {
      await preparada();
      const r = await pool.query<FilaOrden>(`select ${CAMPOS_ORDEN} from gradiox_ordenes_opc where pasarela = $1 and estado = any($2::text[]) order by pedida`, [id, ABIERTAS]);
      return r.rows.map(orden);
    },
    async ordenes(id, filtro = {}) {
      await preparada();
      const r = await pool.query<FilaOrden>(
        `select ${CAMPOS_ORDEN} from gradiox_ordenes_opc
         where pasarela = $1 and ($2::bigint is null or pedida >= $2) and ($3::bigint is null or pedida <= $3)
         order by pedida desc limit $4`,
        [id, filtro.desde ?? null, filtro.hasta ?? null, Math.min(Math.max(1, filtro.limite ?? 200), 5000)],
      );
      return r.rows.map(orden);
    },
    cerrar: () => pool.end(),
  };
}

const global = globalThis as { __gradioxPasarelas?: AlmacenPasarelas };
/** Uno solo por proceso. */
export function almacenPasarelas(): AlmacenPasarelas {
  if (global.__gradioxPasarelas) return global.__gradioxPasarelas;
  const url = direccionBase();
  return (global.__gradioxPasarelas = url ? pasarelasPostgres(url) : pasarelasEnMemoria());
}
