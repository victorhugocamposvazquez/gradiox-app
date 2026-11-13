"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChipEstado } from "@/components/piezas";
import { duracion, hora } from "@/lib/formato";
import { CAMARAS, anticipos, eventos } from "@/lib/sim";
import { useDemo } from "@/lib/store";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;

export default function Avisos() {
  const { ahora, ajustes, atendidas, atender } = useDemo();
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const sucesos = useMemo(() => (minuto === null ? [] : eventos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  const antes = useMemo(() => (minuto === null ? [] : anticipos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Repasando el histórico…</p>;
  const clave = (e: { camaraId: string; desde: number }) => `${e.camaraId}-${e.desde}`;
  const pendientes = sucesos.filter((e) => e.estado === "error" && !atendidas[clave(e)]).length;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Avisos</h1>
          <p className="gx-sub">Lo que ha pasado en las últimas 24 horas y lo que conviene mirar antes de que falle</p>
        </div>
        <Link href="/avisos/fallos" className="gx-boton secundario">Fallos típicos e histórico</Link>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta">
          <div className="gx-fila">
            <h2>Últimas 24 horas</h2>
            {pendientes > 0 && <span className="gx-chip error">{pendientes} {pendientes === 1 ? "alarma sin atender" : "alarmas sin atender"}</span>}
          </div>
          {sucesos.length === 0 ? (
            <p className="gx-vacio">Ningún aviso. Todas las cámaras han estado en su sitio.</p>
          ) : (
            <ul className="gx-lista">
              {sucesos.slice(0, 40).map((e) => {
                const sigue = ahora - e.hasta < 120_000;
                const atendida = atendidas[clave(e)];
                return (
                  <li key={clave(e)} className={e.estado === "error" ? "gx-suceso" : undefined}>
                    <span>
                      <Link href={`/camaras/${e.camaraId}`} style={{ fontWeight: 500 }}>{nombre(e.camaraId)}</Link> · {e.motivo}
                      <small>A las {hora(e.desde)} · {sigue ? `sigue, lleva ${duracion(e.hasta - e.desde)}` : `duró ${duracion(e.hasta - e.desde)}`}</small>
                      {e.estado === "error" && atendida && <small>Atendida a las {hora(atendida)}</small>}
                      {e.estado === "error" && (
                        <span className="gx-acciones">
                          {!atendida && <button type="button" className="gx-boton secundario" onClick={() => atender(clave(e))}>Marcar como atendida</button>}
                          <Link href={`/mantenimiento?equipo=${e.camaraId}-comp&tipo=Avería&nota=${encodeURIComponent(`${e.motivo} a las ${hora(e.desde)}.`)}`} className="gx-boton secundario">Apuntar en el libro</Link>
                        </span>
                      )}
                    </span>
                    <ChipEstado estado={e.estado === "error" && atendida ? "aviso" : e.estado} texto={e.estado === "error" ? (atendida ? "Atendida" : "Alarma") : "Aviso"} />
                  </li>
                );
              })}
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
                    <Link href={`/camaras/${a.camaraId}`} style={{ fontWeight: 500 }}>{nombre(a.camaraId)}</Link> · {a.titulo}
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
