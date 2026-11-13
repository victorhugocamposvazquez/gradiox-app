"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { GraficaComparada, MuestraTrazo, TRAZOS } from "@/components/piezas";
import { PERIODOS, historia, type Periodo } from "@/lib/analisis";
import { gradosC } from "@/lib/formato";
import { CAMARAS } from "@/lib/datos";
import { useDemo } from "@/lib/store";

const MAXIMO = TRAZOS.length;

export default function Comparar() {
  const { ahora, ajustes } = useDemo();
  const [elegidos, setElegidos] = useState<string[]>([CAMARAS[0].id, CAMARAS[1].id]);
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const tramo = minuto === null ? null : Math.floor(minuto / PERIODOS[periodo].pasoMin) * PERIODOS[periodo].pasoMin;
  const series = useMemo(
    () => (tramo === null ? [] : elegidos.map((id) => CAMARAS.find((c) => c.id === id)).filter((c) => c !== undefined).map((c) => ({ c, nombre: c.nombre, historia: historia(c, tramo * 60_000, ajustes, periodo) }))),
    [tramo, ajustes, periodo, elegidos],
  );
  if (ahora === null) return <p className="gx-sub">Leyendo los servicios…</p>;

  const cambiar = (id: string) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length < MAXIMO ? [...e, id] : e));
  const cifra = (v: number | null) => (v === null ? "Sin datos" : gradosC(Math.round(v * 10) / 10));
  const resumen = series.map((s) => {
    const vivos = s.historia.puntos.filter((p) => p.temp !== null);
    const media = vivos.length ? vivos.reduce((a, p) => a + (p.temp as number), 0) / vivos.length : null;
    return { ...s, media, min: vivos.length ? Math.min(...vivos.map((p) => p.min as number)) : null, max: vivos.length ? Math.max(...vivos.map((p) => p.max as number)) : null, alarmas: s.historia.marcas.filter((m) => m.tipo === "alarma").length };
  });

  return (
    <>
      <Link href="/servicios" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Servicios
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Comparar servicios</h1>
          <p className="gx-sub">Para ver si algo le pasa a un servicio o a todos a la vez</p>
        </div>
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <h2>Qué servicios, hasta {MAXIMO}</h2>
          <div className="gx-elegir" role="group" aria-label="Servicios que se comparan">
            {CAMARAS.map((c) => (
              <label key={c.id}>
                <input type="checkbox" checked={elegidos.includes(c.id)} disabled={!elegidos.includes(c.id) && elegidos.length >= MAXIMO} onChange={() => cambiar(c.id)} />
                {c.nombre}
              </label>
            ))}
          </div>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <h2>{PERIODOS[periodo].titulo}</h2>
            <div className="gx-periodos" role="group" aria-label="Periodo de la gráfica">
              {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
                <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>{PERIODOS[p].texto}</button>
              ))}
            </div>
          </div>
          {series.length === 0 ? (
            <p className="gx-vacio">Elige al menos un servicio para ver su temperatura.</p>
          ) : (
            <>
              <GraficaComparada series={series} titulo={PERIODOS[periodo].titulo} />
              <table className="gx-tabla">
                <thead>
                  <tr><th scope="col">Servicio</th><th scope="col">Media</th><th scope="col">Mínima</th><th scope="col">Máxima</th><th scope="col">Alarmas</th></tr>
                </thead>
                <tbody>
                  {resumen.map((s, i) => (
                    <tr key={s.c.id}>
                      <td><MuestraTrazo i={i} /><Link href={`/servicios/${s.c.id}`} style={{ fontWeight: 500 }}>{s.nombre}</Link></td>
                      <td>{cifra(s.media)}</td>
                      <td>{cifra(s.min)}</td>
                      <td>{cifra(s.max)}</td>
                      <td>{s.alarmas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="gx-nota">Todas las líneas comparten el eje de temperatura. Si suben a la vez, mira la central o la luz; si sube una sola, mira ese servicio.</p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
