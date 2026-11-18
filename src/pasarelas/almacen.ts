// Dónde se guardan las pasarelas de prueba y lo que entregan. Con base de datos
// queda guardado; sin ella, en la memoria del proceso, válida solo para pruebas.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";
import { HORA, resumir, tramos, type Clase, type ResumenVariable, type Tramo } from "../historicos/modelo";
import type { Contacto, DatosPasarela, LecturaOpc, Pasarela } from "./modelo";

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
  /** Para los históricos: qué variables tienen lecturas guardadas, de qué clase son y entre qué instantes. */
  variablesLeidas(id: string): Promise<VariableLeida[]>;
  /** Para los históricos: el resumen de cada variable entre dos instantes (en horas en punto). */
  resumenLecturas(id: string, desde: number, hasta: number): Promise<ResumenVariable[]>;
  /** Para los históricos: una variable entre dos instantes, repartida en ratos de `tramoMs`. */
  serieLecturas(id: string, variable: string, desde: number, hasta: number, tramoMs: number): Promise<Tramo[]>;
};
export type VariableLeida = { v: string; clase: Clase; primera: number; ultima: number };

export function pasarelasEnMemoria(reloj: () => number = Date.now): AlmacenPasarelas {
  const todas = new Map<string, Pasarela & { huella: string }>();
  const lecturas = new Map<string, Map<string, UltimaLectura[]>>();
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
    async variablesLeidas(id) {
      const out: VariableLeida[] = [];
      for (const [v, s] of lecturas.get(id) ?? []) {
        const clase: Clase | null = s.some((l) => typeof l.x === "number") ? "numero" : s.some((l) => typeof l.x === "boolean") ? "sino" : null;
        if (clase) out.push({ v, clase, primera: s[0].t, ultima: s[s.length - 1].t });
      }
      return out.sort((a, b) => a.v.localeCompare(b.v));
    },
    async resumenLecturas(id, desde, hasta) {
      return [...(lecturas.get(id) ?? [])].map(([v, s]) => resumir(v, s, desde, hasta)).filter((r) => r !== null);
    },
    async serieLecturas(id, variable, desde, hasta, tramoMs) {
      return tramos(lecturas.get(id)?.get(variable) ?? [], desde, hasta, tramoMs);
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
  // Para saber qué ha llegado desde la última vez que se resumió, aunque sean lecturas atrasadas.
  "create index if not exists gradiox_lecturas_opc_recibida on gradiox_lecturas_opc using brin (recibida)",
  // Y para coger un tramo de horas de una instalación sin recorrer todas sus lecturas.
  "create index if not exists gradiox_lecturas_opc_t on gradiox_lecturas_opc using brin (t)",
  // Los históricos no recorren las lecturas una a una: leen este resumen por horas, que se va rellenando solo.
  `create table if not exists gradiox_lecturas_hora (
    pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
    variable text not null,
    hora bigint not null,
    n integer not null,
    minimo double precision,
    maximo double precision,
    suma double precision not null default 0,
    si integer not null default 0,
    no integer not null default 0,
    arranques integer not null default 0,
    hecha timestamptz not null default now(),
    primary key (pasarela, variable, hora)
  )`,
  "alter table gradiox_lecturas_hora enable row level security",
];

// Cada lectura, convertida a número o a sí/no, con el sí/no anterior de su variable al lado.
const LECTURAS_CLARAS = `
  select variable, t,
    case when jsonb_typeof(valor) = 'number' then (valor #>> '{}')::float8 end as num,
    case when jsonb_typeof(valor) = 'boolean' then (valor #>> '{}')::boolean end as bo,
    lag(case when jsonb_typeof(valor) = 'boolean' then (valor #>> '{}')::boolean end) over (partition by variable order by t) as previo
  from gradiox_lecturas_opc`;
const CUENTAS = "count(num)::int as n, min(num) as minimo, max(num) as maximo, coalesce(sum(num), 0) as suma, (count(*) filter (where bo))::int as si, (count(*) filter (where not bo))::int as no, (count(*) filter (where bo and previo = false))::int as arranques";

/** Horas que se resumen de una vez, y tiempo que se le dedica como mucho en una consulta. */
const HORAS_POR_TANDA = 6;
const TOPE_RESUMIR_MS = 6000;
const REPOSO_RESUMIR_MS = 60_000;

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
  // Pone al día el resumen por horas: desde la última hora resumida (o desde la
  // lectura atrasada más antigua que haya llegado después) hasta ahora. Si hay
  // mucho pendiente no lo hace todo de una vez: sigue en la siguiente consulta.
  const resumidas = new Map<string, number>();
  async function resumirHoras(id: string) {
    const ahora = reloj();
    if (ahora - (resumidas.get(id) ?? 0) < REPOSO_RESUMIR_MS) return;
    const m = (await pool.query<{ hora: string | null; hecha: Date | null }>("select max(hora) as hora, max(hecha) as hecha from gradiox_lecturas_hora where pasarela = $1", [id])).rows[0];
    const r = m.hecha
      ? await pool.query<{ t: string | null }>("select min(t) as t from gradiox_lecturas_opc where pasarela = $1 and recibida > $2::timestamptz - interval '2 minutes'", [id, m.hecha])
      : await pool.query<{ t: string | null }>("select min(t) as t from gradiox_lecturas_opc where pasarela = $1", [id]);
    const desde = Math.min(m.hora === null ? Infinity : Number(m.hora), r.rows[0].t === null ? Infinity : Number(r.rows[0].t));
    if (!Number.isFinite(desde)) return;
    const empezado = Date.now();
    let hora = Math.floor(desde / HORA) * HORA;
    while (hora <= ahora) {
      const fin = hora + HORAS_POR_TANDA * HORA;
      await pool.query(
        `insert into gradiox_lecturas_hora (pasarela, variable, hora, n, minimo, maximo, suma, si, no, arranques)
         select $1, variable, (t / ${HORA}) * ${HORA}, ${CUENTAS}
         from (${LECTURAS_CLARAS} where pasarela = $1 and t >= $2 and t < $3) l
         group by variable, (t / ${HORA}) * ${HORA}
         having count(num) + count(bo) > 0
         on conflict (pasarela, variable, hora) do update set n = excluded.n, minimo = excluded.minimo, maximo = excluded.maximo, suma = excluded.suma, si = excluded.si, no = excluded.no, arranques = excluded.arranques, hecha = now()`,
        [id, hora, fin],
      );
      hora = fin;
      if (Date.now() - empezado > TOPE_RESUMIR_MS) return;
    }
    resumidas.set(id, ahora);
  }
  return {
    tipo: "base",
    async variablesLeidas(id) {
      await preparada();
      await resumirHoras(id);
      const r = await pool.query<{ variable: string; numero: boolean; primera: string; ultima: string }>(
        "select variable, sum(n) > 0 as numero, min(hora) as primera, max(hora) as ultima from gradiox_lecturas_hora where pasarela = $1 group by variable order by variable",
        [id],
      );
      return r.rows.map((f) => ({ v: f.variable, clase: f.numero ? "numero" : "sino", primera: Number(f.primera), ultima: Number(f.ultima) + HORA }));
    },
    async resumenLecturas(id, desde, hasta) {
      await preparada();
      await resumirHoras(id);
      const r = await pool.query<{ variable: string; n: string; minimo: number | null; maximo: number | null; suma: number; si: string; no: string; arranques: string; pendiente: number | null }>(
        `select variable, sum(n) as n, min(minimo) as minimo, max(maximo) as maximo, sum(suma) as suma, sum(si) as si, sum(no) as no, sum(arranques) as arranques,
           case when count(*) filter (where n > 0) >= 3 then regr_slope(suma / nullif(n, 0), hora) * 86400000 end as pendiente
         from gradiox_lecturas_hora where pasarela = $1 and hora >= $2 and hora < $3 group by variable`,
        [id, desde, hasta],
      );
      return r.rows.map((f): ResumenVariable => {
        const n = Number(f.n);
        const si = Number(f.si);
        const no = Number(f.no);
        return n > 0
          ? { v: f.variable, clase: "numero", n, min: f.minimo, max: f.maximo, media: f.suma / n, activa: null, arranques: 0, pendiente: f.pendiente }
          : { v: f.variable, clase: "sino", n: si + no, min: null, max: null, media: null, activa: si / Math.max(1, si + no), arranques: Number(f.arranques), pendiente: null };
      });
    },
    async serieLecturas(id, variable, desde, hasta, tramoMs) {
      await preparada();
      const paso = Math.max(1000, Math.round(tramoMs));
      const r = await pool.query<{ b: string; n: number; minimo: number | null; maximo: number | null; suma: number; si: number; no: number; arranques: number }>(
        `select (t / ${paso}) * ${paso} as b, ${CUENTAS}
         from (${LECTURAS_CLARAS} where pasarela = $1 and variable = $2 and t >= $3 and t < $4) l
         group by b having count(num) + count(bo) > 0 order by b`,
        [id, variable, desde, hasta],
      );
      return r.rows.map((f): Tramo =>
        f.n > 0
          ? { t: Number(f.b), n: f.n, min: f.minimo, max: f.maximo, media: f.suma / f.n, activa: null, arranques: 0 }
          : { t: Number(f.b), n: f.si + f.no, min: null, max: null, media: null, activa: f.si / (f.si + f.no), arranques: f.arranques },
      );
    },
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
