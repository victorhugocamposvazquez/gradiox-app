"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ORDENES, SENALES, describir, historico, type Orden, type Senal } from "@/lib/fallos";
import { hora } from "@/lib/formato";
import { CAMARAS } from "@/lib/sim";
import { useDemo } from "@/lib/store";

const DIAS = 7;
const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const cuando = (t: number, ahora: number) => {
  const dias = Math.floor((new Date(ahora).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000);
  return `${dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`} a las ${hora(t)}`;
};

export default function Fallos() {
  const { ahora, ajustes, fallos, anadirFallo, quitarFallo } = useDemo();
  const [abierto, setAbierto] = useState(false);
  const [senal, setSenal] = useState<Senal>("puerta");
  const tramo = ahora === null ? null : Math.floor(ahora / 300_000);
  const repeticiones = useMemo(() => (tramo === null ? [] : historico(fallos, tramo * 300_000, ajustes, DIAS)), [tramo, fallos, ajustes]);
  if (ahora === null) return <p className="gx-sub">Repasando el histórico…</p>;

  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    anadirFallo({
      nombre: String(d.get("nombre")).trim(),
      senal,
      umbral: SENALES[senal].unidad ? Number(d.get("umbral")) : 0,
      revisar: String(d.get("revisar") || "").trim(),
      orden: String(d.get("orden")) as Orden,
    });
    setAbierto(false);
  };
  const tope = Math.max(1, ...repeticiones.flatMap((r) => r.porDia));

  return (
    <>
      <Link href="/avisos" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Avisos
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Fallos típicos</h1>
          <p className="gx-sub">Lo que suele pasar en esta instalación, cuántas veces se repite y qué se hace cuando pasa</p>
        </div>
        {!abierto && (
          <button type="button" className="gx-boton" onClick={() => setAbierto(true)}>Añadir un fallo</button>
        )}
      </header>

      <div className="gx-pila">
        {abierto && (
          <form className="gx-tarjeta gx-pila" onSubmit={guardar}>
            <h2>Añadir un fallo típico</h2>
            <div className="gx-formulario">
              <label className="gx-campo ancho">Cómo lo llamáis
                <input type="text" name="nombre" required maxLength={60} autoComplete="off" placeholder="Por ejemplo: se hiela el desagüe" />
              </label>
              <label className="gx-campo">En qué se nota
                <select name="senal" value={senal} onChange={(e) => setSenal(e.target.value as Senal)}>
                  {(Object.keys(SENALES) as Senal[]).map((s) => <option key={s} value={s}>{SENALES[s].texto}{SENALES[s].unidad ? "…" : ""}</option>)}
                </select>
              </label>
              {SENALES[senal].unidad && (
                <label className="gx-campo">Cuánto ({SENALES[senal].unidad})
                  <input key={senal} type="number" name="umbral" required min={1} max={120} step={1} inputMode="numeric" defaultValue={SENALES[senal].porDefecto} />
                </label>
              )}
              <label className="gx-campo ancho">Qué hay que revisar
                <textarea name="revisar" rows={3} required placeholder="Lo que le dirías a quien va a mirarlo" />
              </label>
              <label className="gx-campo ancho">Qué hace el autómata mientras tanto
                <select name="orden" defaultValue="ninguna">
                  {(Object.keys(ORDENES) as Orden[]).map((o) => <option key={o} value={o}>{ORDENES[o]}</option>)}
                </select>
              </label>
            </div>
            <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
              <button type="submit" className="gx-boton">Guardar</button>
              <button type="button" className="gx-boton secundario" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="gx-dos">
          <section className="gx-tarjeta">
            <h2>Lo que más se repite, últimos {DIAS} días</h2>
            {repeticiones.length === 0 ? (
              <p className="gx-vacio">Ningún fallo de la lista se ha dado en estos {DIAS} días.</p>
            ) : (
              <ul className="gx-lista">
                {repeticiones.map((r) => (
                  <li key={r.fallo.id + r.camaraId}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{r.fallo.nombre}</strong> · <Link href={`/servicios/${r.camaraId}`} style={{ fontWeight: 500 }}>{nombre(r.camaraId)}</Link>
                      <small>{r.activo ? "Está pasando ahora" : `La última, ${cuando(r.ultima, ahora)}`}</small>
                      <span className="gx-dias" role="img" aria-label={`Veces por día, del más antiguo a hoy: ${r.porDia.join(", ")}`}>
                        {r.porDia.map((n, i) => <i key={i} style={{ height: `${n ? Math.max(18, (n / tope) * 100) : 6}%`, opacity: n ? 1 : 0.35 }} />)}
                      </span>
                      <small><b>Revisar:</b> {r.fallo.revisar}</small>
                      {r.fallo.orden !== "ninguna" && <small><b>Autómata:</b> {ORDENES[r.fallo.orden]}</small>}
                    </span>
                    <span className={`gx-chip ${r.activo ? "error" : r.veces >= 3 ? "aviso" : "neutro"}`}>{r.veces} {r.veces === 1 ? "vez" : "veces"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="gx-tarjeta">
            <h2>Fallos que vigila</h2>
            {fallos.length === 0 ? (
              <p className="gx-vacio">Aún no hay ninguno. Añade el primero con lo que más os pasa.</p>
            ) : (
              <ul className="gx-lista">
                {fallos.map((f) => (
                  <li key={f.id}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{f.nombre}</strong>
                      <small>{describir(f)}</small>
                      <small>{ORDENES[f.orden]}</small>
                    </span>
                    <button type="button" className="gx-boton secundario gx-icono" aria-label={`Quitar ${f.nombre}`} onClick={() => quitarFallo(f.id)}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <p className="gx-nota">Los fallos de partida son ejemplos. Las órdenes al autómata están simuladas: en una instalación real se mandarían solo las que el autómata admita y dentro de los límites del género.</p>
      </div>
    </>
  );
}
