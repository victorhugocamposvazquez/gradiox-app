// El almacén de lecturas sobre una base de datos Postgres. Lo que entra aquí
// sobrevive a los reinicios del servidor: es el histórico de verdad.

import { Pool } from "pg";
import { opcionesBase } from "./base";
import type { Almacen } from "./almacen";
import type { Medida } from "./pasarela";

const TABLA = `
create table if not exists gradiox_medidas (
  pasarela text not null,
  equipo text not null,
  t bigint not null,
  lectura jsonb,
  error text,
  recibida timestamptz not null default now(),
  primary key (pasarela, equipo, t)
)`;

type Fila = { equipo: string; t: string; lectura: Medida["lectura"]; error: string | null };
const medida = (f: Fila): Medida => ({ equipo: f.equipo, t: Number(f.t), lectura: f.lectura, ...(f.error ? { error: f.error } : {}) });

export function almacenPostgres(url: string): Almacen & { cerrar(): Promise<void> } {
  const pool = new Pool(opcionesBase(url));
  let lista: Promise<unknown> | undefined;
  // La tabla se crea sola la primera vez. Si falla, se reintenta en la siguiente llamada.
  const preparada = () => (lista ??= pool.query(TABLA).catch((e) => { lista = undefined; throw e; }));

  return {
    tipo: "base",
    async guardar(pasarela, lote) {
      if (!lote.length) return;
      await preparada();
      // Un lote entero en una sola orden. Si la pasarela repite un envío, no se duplica.
      await pool.query(
        `insert into gradiox_medidas (pasarela, equipo, t, lectura, error)
         select $1, m.equipo, m.t, m.lectura, m.error
         from jsonb_to_recordset($2::jsonb) as m(equipo text, t bigint, lectura jsonb, error text)
         on conflict do nothing`,
        [pasarela, JSON.stringify(lote.map((m) => ({ equipo: m.equipo, t: m.t, lectura: m.lectura, error: m.error ?? null })))],
      );
    },
    async ultimas(pasarela) {
      await preparada();
      const r = await pool.query<Fila>("select distinct on (equipo) equipo, t, lectura, error from gradiox_medidas where pasarela = $1 order by equipo, t desc", [pasarela]);
      return r.rows.map(medida);
    },
    async serie(pasarela, equipo, desde) {
      await preparada();
      const r = await pool.query<Fila>("select equipo, t, lectura, error from gradiox_medidas where pasarela = $1 and equipo = $2 and t >= $3 order by t", [pasarela, equipo, desde]);
      return r.rows.map(medida);
    },
    async pasarelas() {
      await preparada();
      const r = await pool.query<{ pasarela: string; ultima: string; equipos: string }>("select pasarela, max(t) as ultima, count(distinct equipo) as equipos from gradiox_medidas group by pasarela order by pasarela");
      return r.rows.map((f) => ({ id: f.pasarela, ultima: Number(f.ultima), equipos: Number(f.equipos) }));
    },
    cerrar: () => pool.end(),
  };
}
