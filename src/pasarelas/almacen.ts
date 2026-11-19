// Dónde se guardan las pasarelas de prueba y lo que entregan. Con base de datos
// queda guardado; sin ella, en la memoria del proceso, válida solo para pruebas.

import { Pool } from "pg";
import { opcionesBase } from "../conexion/base";
import { direccionBase } from "../conexion/servidor";
import { DIA, HORA, resumir, tramos, type Clase, type ResumenVariable, type Tramo } from "../historicos/modelo";
import { CONTROL_MS, DIAS_DETALLE, VIGENCIA_MS, soloCambios, type Previa } from "./ahorro";
import type { Contacto, DatosPasarela, LecturaOpc, Pasarela } from "./modelo";
import type { Actuacion } from "../actua/actuacion";
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
  /** Para los históricos: qué variables tienen lecturas guardadas, de qué clase son y entre qué instantes. */
  variablesLeidas(id: string): Promise<VariableLeida[]>;
  /** Para los históricos: el resumen de cada variable entre dos instantes (en horas en punto). */
  resumenLecturas(id: string, desde: number, hasta: number): Promise<ResumenVariable[]>;
  /** Para los históricos: una variable entre dos instantes, repartida en ratos de `tramoMs`. */
  serieLecturas(id: string, variable: string, desde: number, hasta: number, tramoMs: number): Promise<Tramo[]>;
  /** Cuánto hay guardado de una instalación: lecturas en detalle, horas resumidas y órdenes. */
  guardado(id: string): Promise<Guardado>;
  /** Lo que ocupa la base de datos entera, en bytes; sin base de datos no se sabe. */
  espacioTotal(): Promise<number | null>;
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
  /** Guarda una actuación nueva o su último estado. Nunca se borran: son el registro de lo que Gradiox ha cambiado para ahorrar. */
  guardarActuacion(id: string, a: Actuacion): Promise<void>;
  /** De la más reciente a la más antigua. */
  actuaciones(id: string, soloActivas?: boolean): Promise<Actuacion[]>;
};
/** Lo que ocupa lo guardado de una instalación. `bytes` es una estimación a partir del tamaño medio de cada fila; sin base de datos no se sabe. */
export type Guardado = { lecturas: number; primera: number | null; ultima: number | null; /** Lecturas guardadas en las últimas 24 horas. */ ultimoDia: number; horas: number; ordenes: number; bytes: number | null; /** Lo que ocupa de media una lectura guardada, con sus índices. */ bytesLectura: number | null };
export type VariableLeida = { v: string; clase: Clase; primera: number; ultima: number };

export function pasarelasEnMemoria(reloj: () => number = Date.now): AlmacenPasarelas {
  const todas = new Map<string, Pasarela & { huella: string }>();
  const lecturas = new Map<string, Map<string, UltimaLectura[]>>();
  const ordenes = new Map<string, Orden[]>();
  const actuaciones = new Map<string, Actuacion[]>();
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
      actuaciones.delete(id);
      return todas.delete(id);
    },
    async contactar(id, contacto) {
      const p = todas.get(id);
      if (p) p.contacto = contacto;
    },
    async anotar(id, lote, simulada) {
      const mias = lecturas.get(id) ?? new Map<string, UltimaLectura[]>();
      lecturas.set(id, mias);
      if (!lote.length) return;
      // Igual que con base de datos: solo se guarda lo que cambia y una lectura de control cada cierto tiempo.
      const minT = Math.min(...lote.map((l) => l.t));
      const previas = new Map<string, Previa>();
      for (const [v, serie] of mias) {
        const p = serie.findLast((x) => x.t < minT && x.t >= minT - CONTROL_MS);
        if (p) previas.set(v, p);
      }
      for (const l of soloCambios(lote, previas)) {
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
    async guardado(id) {
      const todas = [...(lecturas.get(id)?.values() ?? [])].flat();
      const dia = reloj() - DIA;
      return { lecturas: todas.length, primera: todas.length ? Math.min(...todas.map((l) => l.t)) : null, ultima: todas.length ? Math.max(...todas.map((l) => l.t)) : null, ultimoDia: todas.filter((l) => l.t >= dia).length, horas: 0, ordenes: (ordenes.get(id) ?? []).length, bytes: null, bytesLectura: null };
    },
    async espacioTotal() {
      return null;
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
    async guardarActuacion(id, a) {
      const lista = (actuaciones.get(id) ?? []).filter((x) => x.id !== a.id);
      actuaciones.set(id, [...lista, structuredClone(a)]);
    },
    async actuaciones(id, soloActivas = false) {
      return (actuaciones.get(id) ?? [])
        .filter((a) => !soloActivas || a.estado === "aplicada")
        .sort((a, b) => b.aplicada - a.aplicada)
        .map((a) => structuredClone(a));
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
  // Los históricos no recorren las lecturas una a una: leen este resumen por horas, que se va rellenando solo
  // y que no se borra nunca. Todo cuenta por tiempo: `ms` es el tiempo de la hora con dato, `suma` el valor
  // por el tiempo que duró y `si_ms` el tiempo en «sí».
  "drop table if exists gradiox_lecturas_hora",
  `create table if not exists gradiox_resumen_hora (
    pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
    variable text not null,
    hora bigint not null,
    n integer not null,
    ms bigint not null,
    minimo double precision,
    maximo double precision,
    suma double precision not null default 0,
    si_ms bigint not null default 0,
    arranques integer not null default 0,
    hecha timestamptz not null default now(),
    primary key (pasarela, variable, hora)
  )`,
  "alter table gradiox_resumen_hora enable row level security",
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
  // Una fila por actuación para ahorrar. Tampoco se borra: dice qué cambió Gradiox, cuánto esperaba ahorrar y cómo acabó.
  `create table if not exists gradiox_actuaciones (
    id text primary key,
    pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
    estado text not null,
    aplicada bigint not null,
    datos jsonb not null
  )`,
  "create index if not exists gradiox_actuaciones_pasarela on gradiox_actuaciones (pasarela, aplicada desc)",
  "alter table gradiox_actuaciones enable row level security",
];

/**
 * Las lecturas de una instalación repartidas en ratos de `paso`, contando por
 * tiempo: cada lectura vale hasta la siguiente de su variable, como mucho
 * VIGENCIA_MS y nunca más allá de ahora. Parámetros: $1 instalación, $2 desde,
 * $3 hasta, $4 ahora y, si `filtro` lo usa, $5.
 */
const repartidas = (paso: number, filtro = "") => `
  with p as (
    select variable, t, num, bo, lag(bo) over w as previo, least(lead(t) over w, t + ${VIGENCIA_MS}, $4::bigint) as fin
    from (
      select variable, t,
        case when jsonb_typeof(valor) = 'number' then (valor #>> '{}')::float8 end as num,
        case when jsonb_typeof(valor) = 'boolean' then (valor #>> '{}')::boolean end as bo
      from gradiox_lecturas_opc where pasarela = $1 and t >= $2::bigint - ${VIGENCIA_MS} and t < $3::bigint ${filtro}
    ) c
    where num is not null or bo is not null
    window w as (partition by variable order by t)
  )
  select variable, g as b,
    (count(*) filter (where t >= g and t >= $2::bigint))::int as n,
    sum(least(fin, g + ${paso}, $3::bigint) - greatest(t, g, $2::bigint))::float8 as ms,
    min(num) as minimo, max(num) as maximo,
    coalesce(sum(num * (least(fin, g + ${paso}, $3::bigint) - greatest(t, g, $2::bigint))), 0) as suma,
    coalesce(sum(least(fin, g + ${paso}, $3::bigint) - greatest(t, g, $2::bigint)) filter (where bo), 0)::float8 as si_ms,
    (count(*) filter (where bo and previo = false and t >= g and t >= $2::bigint))::int as arranques
  from p, generate_series((greatest(t, $2::bigint) / ${paso}) * ${paso}, ((least(fin, $3::bigint) - 1) / ${paso}) * ${paso}, ${paso}::bigint) g
  where least(fin, $3::bigint) > greatest(t, $2::bigint)
  group by variable, g`;
type FilaTramo = { b: string; n: number; ms: number; minimo: number | null; maximo: number | null; suma: number; si_ms: number; arranques: number };
const tramo = (f: FilaTramo): Tramo =>
  f.minimo !== null
    ? { t: Number(f.b), n: f.n, ms: f.ms, min: f.minimo, max: f.maximo, media: f.suma / f.ms, activa: null, arranques: 0 }
    : { t: Number(f.b), n: f.n, ms: f.ms, min: null, max: null, media: null, activa: f.si_ms / f.ms, arranques: f.arranques };

/** Horas que se resumen de una vez, y tiempo que se le dedica como mucho en una consulta. */
const HORAS_POR_TANDA = 6;
const TOPE_RESUMIR_MS = 6000;
const REPOSO_RESUMIR_MS = 60_000;
/** Cada cuánto se mira si hay detalle viejo que borrar. */
const REPOSO_LIMPIAR_MS = HORA;

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
  /** La hora más antigua de la que todavía se guarda el detalle. */
  const limiteDetalle = (ahora: number) => Math.floor((ahora - DIAS_DETALLE * DIA) / HORA) * HORA;
  // Pone al día el resumen por horas: desde la última hora resumida (o desde la
  // lectura atrasada más antigua que haya llegado después) hasta ahora. Si hay
  // mucho pendiente no lo hace todo de una vez: sigue en la siguiente consulta.
  // No vuelve sobre horas cuyo detalle ya se ha borrado: lo atrasado de más de DIAS_DETALLE días no se
  // guarda, y lo que sí entra es siempre posterior a cualquier borrado. Devuelve si quedó al día.
  const resumidas = new Map<string, number>();
  async function resumirHoras(id: string): Promise<boolean> {
    const ahora = reloj();
    if (ahora - (resumidas.get(id) ?? 0) < REPOSO_RESUMIR_MS) return true;
    const m = (await pool.query<{ hora: string | null; hecha: Date | null }>("select max(hora) as hora, max(hecha) as hecha from gradiox_resumen_hora where pasarela = $1", [id])).rows[0];
    const r = m.hecha
      ? await pool.query<{ t: string | null }>("select min(t) as t from gradiox_lecturas_opc where pasarela = $1 and recibida > $2::timestamptz - interval '2 minutes'", [id, m.hecha])
      : await pool.query<{ t: string | null }>("select min(t) as t from gradiox_lecturas_opc where pasarela = $1", [id]);
    const desde = Math.min(m.hora === null ? Infinity : Number(m.hora), r.rows[0].t === null ? Infinity : Number(r.rows[0].t));
    if (!Number.isFinite(desde)) return true;
    const empezado = Date.now();
    let hora = Math.floor(desde / HORA) * HORA;
    while (hora <= ahora) {
      const fin = hora + HORAS_POR_TANDA * HORA;
      await pool.query(
        `insert into gradiox_resumen_hora (pasarela, variable, hora, n, ms, minimo, maximo, suma, si_ms, arranques)
         select $1, variable, b, n, ms, minimo, maximo, suma, si_ms, arranques from (${repartidas(HORA)}) r
         on conflict (pasarela, variable, hora) do update set n = excluded.n, ms = excluded.ms, minimo = excluded.minimo, maximo = excluded.maximo, suma = excluded.suma, si_ms = excluded.si_ms, arranques = excluded.arranques, hecha = now()`,
        [id, hora, fin, ahora],
      );
      hora = fin;
      if (Date.now() - empezado > TOPE_RESUMIR_MS) return false;
    }
    resumidas.set(id, ahora);
    return true;
  }
  // Borra el detalle de más de DIAS_DETALLE días, pero solo cuando el resumen por horas está al día:
  // así nunca se pierde nada que no haya quedado resumido. Se mira como mucho una vez por hora.
  const limpiadas = new Map<string, number>();
  async function limpiar(id: string) {
    const ahora = reloj();
    if (ahora - (limpiadas.get(id) ?? 0) < REPOSO_LIMPIAR_MS) return;
    limpiadas.set(id, ahora);
    resumidas.delete(id);
    if (!(await resumirHoras(id))) {
      limpiadas.delete(id);
      return;
    }
    // Se deja un margen de VIGENCIA_MS: la primera hora que se conserva necesita la lectura que venía valiendo al empezar.
    await pool.query("delete from gradiox_lecturas_opc where pasarela = $1 and t < $2", [id, limiteDetalle(ahora) - VIGENCIA_MS]);
  }
  return {
    tipo: "base",
    async variablesLeidas(id) {
      await preparada();
      await resumirHoras(id);
      const r = await pool.query<{ variable: string; numero: boolean; primera: string; ultima: string }>(
        "select variable, bool_or(minimo is not null) as numero, min(hora) as primera, max(hora) as ultima from gradiox_resumen_hora where pasarela = $1 group by variable order by variable",
        [id],
      );
      return r.rows.map((f) => ({ v: f.variable, clase: f.numero ? "numero" : "sino", primera: Number(f.primera), ultima: Number(f.ultima) + HORA }));
    },
    async resumenLecturas(id, desde, hasta) {
      await preparada();
      await resumirHoras(id);
      const r = await pool.query<{ variable: string; n: string; ms: number; minimo: number | null; maximo: number | null; suma: number; si_ms: number; arranques: string; pendiente: number | null }>(
        `select variable, sum(n) as n, sum(ms)::float8 as ms, min(minimo) as minimo, max(maximo) as maximo, sum(suma) as suma, sum(si_ms)::float8 as si_ms, sum(arranques) as arranques,
           case when count(*) filter (where minimo is not null) >= 3 then regr_slope(suma / nullif(ms, 0), hora) filter (where minimo is not null) * 86400000 end as pendiente
         from gradiox_resumen_hora where pasarela = $1 and hora >= $2 and hora < $3 and ms > 0 group by variable`,
        [id, desde, hasta],
      );
      return r.rows.map((f): ResumenVariable =>
        f.minimo !== null
          ? { v: f.variable, clase: "numero", n: Number(f.n), ms: f.ms, min: f.minimo, max: f.maximo, media: f.suma / f.ms, activa: null, arranques: 0, pendiente: f.pendiente }
          : { v: f.variable, clase: "sino", n: Number(f.n), ms: f.ms, min: null, max: null, media: null, activa: f.si_ms / f.ms, arranques: Number(f.arranques), pendiente: null },
      );
    },
    async serieLecturas(id, variable, desde, hasta, tramoMs) {
      await preparada();
      const paso = Math.max(60_000, Math.round(tramoMs));
      // Los ratos de una hora o más salen del resumen por horas, que es lo que queda cuando el detalle ya se ha borrado.
      if (paso >= HORA && paso % HORA === 0) {
        await resumirHoras(id);
        const r = await pool.query<FilaTramo>(
          `select (hora / ${paso}) * ${paso} as b, sum(n)::int as n, sum(ms)::float8 as ms, min(minimo) as minimo, max(maximo) as maximo, sum(suma) as suma, sum(si_ms)::float8 as si_ms, sum(arranques)::int as arranques
           from gradiox_resumen_hora where pasarela = $1 and variable = $2 and hora >= $3 and hora < $4 and ms > 0 group by b order by b`,
          [id, variable, desde, hasta],
        );
        return r.rows.map(tramo);
      }
      const r = await pool.query<FilaTramo>(`${repartidas(paso, "and variable = $5")} order by b`, [id, desde, hasta, reloj(), variable]);
      return r.rows.map(tramo);
    },
    async guardado(id) {
      await preparada();
      const r = await pool.query<{ lecturas: string; primera: string | null; ultima: string | null; dia: string; horas: string; ordenes: string; por_lectura: string | null; por_hora: string | null }>(
        `select l.lecturas, l.primera, l.ultima, d.dia, h.horas, o.ordenes,
           (select pg_total_relation_size('gradiox_lecturas_opc') / nullif(count(*), 0) from gradiox_lecturas_opc) as por_lectura,
           (select pg_total_relation_size('gradiox_resumen_hora') / nullif(count(*), 0) from gradiox_resumen_hora) as por_hora
         from (select count(*) as lecturas, min(t) as primera, max(t) as ultima from gradiox_lecturas_opc where pasarela = $1) l,
              (select count(*) as dia from gradiox_lecturas_opc where pasarela = $1 and t >= $2) d,
              (select count(*) as horas from gradiox_resumen_hora where pasarela = $1) h,
              (select count(*) as ordenes from gradiox_ordenes_opc where pasarela = $1) o`,
        [id, reloj() - DIA],
      );
      const f = r.rows[0];
      const porLectura = f.por_lectura === null ? null : Number(f.por_lectura);
      return {
        lecturas: Number(f.lecturas),
        primera: f.primera === null ? null : Number(f.primera),
        ultima: f.ultima === null ? null : Number(f.ultima),
        ultimoDia: Number(f.dia),
        horas: Number(f.horas),
        ordenes: Number(f.ordenes),
        bytes: Number(f.lecturas) * (porLectura ?? 0) + Number(f.horas) * Number(f.por_hora ?? 0),
        bytesLectura: porLectura,
      };
    },
    async espacioTotal() {
      await preparada();
      return Number((await pool.query<{ b: string }>("select pg_database_size(current_database()) as b")).rows[0].b);
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
    async anotar(id, entregado, simulada) {
      // Lo de hace más de DIAS_DETALLE días ya no se guarda en detalle.
      const viejo = limiteDetalle(reloj());
      const reciente = entregado.filter((l) => l.t >= viejo);
      if (!reciente.length) return;
      await preparada();
      // Solo se guarda lo que cambia respecto a la última lectura guardada de cada variable (ver ahorro.ts).
      const minT = Math.min(...reciente.map((l) => l.t));
      const antes = await pool.query<{ variable: string; t: string; valor: LecturaOpc["x"]; incidencia: string | null }>(
        "select distinct on (variable) variable, t, valor, incidencia from gradiox_lecturas_opc where pasarela = $1 and variable = any($2::text[]) and t >= $3 and t < $4 order by variable, t desc",
        [id, [...new Set(reciente.map((l) => l.v))], minT - CONTROL_MS, minT],
      );
      const lote = soloCambios(reciente, new Map(antes.rows.map((f) => [f.variable, { t: Number(f.t), x: f.valor, ...(f.incidencia ? { c: f.incidencia } : {}) }])));
      if (lote.length)
        await pool.query(

        `insert into gradiox_lecturas_opc (pasarela, variable, t, valor, incidencia, simulada)
         select $1, l.v, l.t, l.x, l.c, $3
         from jsonb_to_recordset($2::jsonb) as l(v text, t bigint, x jsonb, c text)
         on conflict do nothing`,
        [id, JSON.stringify(lote.map((l) => ({ v: l.v, t: l.t, x: l.x, c: l.c ?? null }))), simulada],
        );
      // Lo recién guardado tiene que entrar en el resumen por horas en la siguiente consulta.
      resumidas.delete(id);
      await limpiar(id);
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
    async guardarActuacion(id, a) {
      await preparada();
      await pool.query(
        `insert into gradiox_actuaciones (id, pasarela, estado, aplicada, datos) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set estado = excluded.estado, datos = excluded.datos`,
        [a.id, id, a.estado, a.aplicada, JSON.stringify(a)],
      );
    },
    async actuaciones(id, soloActivas = false) {
      await preparada();
      const r = await pool.query<{ datos: Actuacion }>(
        "select datos from gradiox_actuaciones where pasarela = $1 and ($2::boolean is false or estado = 'aplicada') order by aplicada desc limit 200",
        [id, soloActivas],
      );
      return r.rows.map((f) => f.datos);
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
