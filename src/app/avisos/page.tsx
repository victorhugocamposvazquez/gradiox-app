"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChipEstado } from "@/components/piezas";
import { duracion, hora } from "@/lib/formato";
import { CAMARAS, anticipos, eventos } from "@/lib/sim";
import { useDemo } from "@/lib/store";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;

export default function Avisos() {
  const { ahora, ajustes } = useDemo();
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const sucesos = useMemo(() => (minuto === null ? [] : eventos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  const antes = useMemo(() => (minuto === null ? [] : anticipos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Repasando el histórico…</p>;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Avisos</h1>
          <p className="gx-sub">Lo que ha pasado en las últimas 24 horas y lo que conviene mirar antes de que falle</p>
        </div>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta">
          <h2>Últimas 24 horas</h2>
          {sucesos.length === 0 ? (
            <p className="gx-vacio">Ningún aviso. Todas las cámaras han estado en su sitio.</p>
          ) : (
            <ul className="gx-lista">
              {sucesos.slice(0, 40).map((e) => (
                <li key={`${e.camaraId}-${e.desde}`}>
                  <span>
                    <Link href={`/camaras/${e.camaraId}`} style={{ fontWeight: 600 }}>{nombre(e.camaraId)}</Link> · {e.motivo}
                    <small>A las {hora(e.desde)} · duró {duracion(e.hasta - e.desde)}</small>
                  </span>
                  <ChipEstado estado={e.estado} texto={e.estado === "error" ? "Alarma" : "Aviso"} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gx-tarjeta">
          <h2>Para anticiparse</h2>
          {antes.length === 0 ? (
            <p className="gx-vacio">Nada que revisar por ahora.</p>
          ) : (
            <ul className="gx-lista">
              {antes.map((a) => (
                <li key={a.camaraId + a.titulo}>
                  <span>
                    <Link href={`/camaras/${a.camaraId}`} style={{ fontWeight: 600 }}>{nombre(a.camaraId)}</Link> · {a.titulo}
                    <small>{a.detalle}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
