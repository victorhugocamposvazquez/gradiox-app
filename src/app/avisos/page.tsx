"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChipEstado } from "@/components/piezas";
import { duracion, hora } from "@/lib/formato";
import { CAMARAS, anticipos, eventos } from "@/lib/datos";
import { escalado } from "@/lib/guardias";
import { EQUIPOS } from "@/lib/equipos";
import { estadoAlarma, useDemo, type EstadoAlarma } from "@/lib/store";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const ROTULOS: Record<EstadoAlarma, string> = { nueva: "Nueva", vista: "Vista", curso: "En curso", resuelta: "Resuelta" };

export default function Avisos() {
  const { ahora, ajustes, atendidas, atender, seguimientos, asignar, resolver, guardias, esperaMin } = useDemo();
  const [soloAbiertas, setSoloAbiertas] = useState(false);
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const sucesos = useMemo(() => (minuto === null ? [] : eventos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  const antes = useMemo(() => (minuto === null ? [] : anticipos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Repasando el histórico…</p>;
  const clave = (e: { camaraId: string; desde: number }) => `${e.camaraId}-${e.desde}`;
  const de = (e: { camaraId: string; desde: number }) => estadoAlarma(atendidas[clave(e)], seguimientos[clave(e)]);
  const alarmas = sucesos.filter((e) => e.estado === "error");
  const pendientes = alarmas.filter((e) => de(e) === "nueva").length;
  const abiertas = alarmas.filter((e) => de(e) !== "resuelta").length;
  const visibles = soloAbiertas ? alarmas.filter((e) => de(e) !== "resuelta") : sucesos;

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
            {pendientes > 0 && <span className="gx-chip error">{pendientes} {pendientes === 1 ? "alarma nueva" : "alarmas nuevas"}</span>}
          </div>
          {alarmas.length > 0 && (
            <div className="gx-periodos" role="group" aria-label="Qué se ve" style={{ marginTop: 12 }}>
              <button type="button" aria-pressed={!soloAbiertas} onClick={() => setSoloAbiertas(false)}>Todo</button>
              <button type="button" aria-pressed={soloAbiertas} onClick={() => setSoloAbiertas(true)}>Alarmas por resolver · {abiertas}</button>
            </div>
          )}
          {visibles.length === 0 ? (
            <p className="gx-vacio">{soloAbiertas ? "Ninguna alarma por resolver." : "Ningún aviso. Todos los servicios han estado en su sitio."}</p>
          ) : (
            <ul className="gx-lista">
              {visibles.slice(0, 40).map((e) => {
                const sigue = ahora - e.hasta < 120_000;
                const k = clave(e);
                const vista = atendidas[k];
                const seg = seguimientos[k];
                const paso = de(e);
                const equipo = EQUIPOS.find((q) => q.camaraId === e.camaraId)?.id ?? "central";
                return (
                  <li key={k} className={e.estado === "error" ? "gx-suceso" : undefined}>
                    <span>
                      <Link href={`/servicios/${e.camaraId}`} style={{ fontWeight: 500 }}>{nombre(e.camaraId)}</Link> · {e.motivo}
                      <small>A las {hora(e.desde)} · {sigue ? `sigue, lleva ${duracion(e.hasta - e.desde)}` : `duró ${duracion(e.hasta - e.desde)}`}</small>
                      {e.estado === "error" && vista && <small>Vista a las {hora(vista)}{seg?.quien ? ` · la lleva ${seg.quien.toLowerCase()}${seg.desde ? ` desde las ${hora(seg.desde)}` : ""}` : ""}</small>}
                      {e.estado === "error" && seg?.resuelta && <small><b>Resuelta a las {hora(seg.resuelta)}.</b> Causa: {seg.causa}</small>}
                      {e.estado === "error" && paso === "nueva" && sigue && (() => {
                        const esc = escalado(e.desde, ahora, guardias, esperaMin);
                        return <small><b>Avisado:</b> {esc.avisados.map((g) => g.puesto).join(", ")}.{esc.siguiente ? ` Si nadie la mira, pasa a ${esc.siguiente.puesto.toLowerCase()} en ${esc.faltanMin} min.` : " Ya no queda nadie más a quien avisar."}</small>;
                      })()}
                      {e.estado === "error" && (
                        <span className="gx-acciones">
                          {paso === "nueva" && <button type="button" className="gx-boton secundario" onClick={() => atender(k)}>Marcar como vista</button>}
                          {paso === "vista" && (
                            <label className="gx-campo gx-enlinea">
                              <span className="gx-oculto">Quién la lleva</span>
                              <select value="" onChange={(ev) => ev.target.value && asignar(k, ev.target.value)}>
                                <option value="">Quién la lleva…</option>
                                {guardias.map((g) => <option key={g.id} value={g.puesto}>{g.puesto}</option>)}
                              </select>
                            </label>
                          )}
                          {paso === "curso" && (
                            <form
                              className="gx-cierre"
                              onSubmit={(ev) => {
                                ev.preventDefault();
                                const causa = String(new FormData(ev.currentTarget).get("causa") ?? "").trim();
                                if (causa) resolver(k, causa);
                              }}
                            >
                              <label className="gx-campo gx-enlinea">
                                <span className="gx-oculto">Causa</span>
                                <input type="text" name="causa" required maxLength={120} placeholder="Qué era: la causa" />
                              </label>
                              <button type="submit" className="gx-boton secundario">Dar por resuelta</button>
                            </form>
                          )}
                          <Link href={`/mantenimiento?equipo=${equipo}&tipo=Avería&nota=${encodeURIComponent(`${e.motivo} a las ${hora(e.desde)}.${seg?.causa ? ` Causa: ${seg.causa}` : ""}`)}`} className="gx-boton secundario">Apuntar en el libro</Link>
                        </span>
                      )}
                    </span>
                    <ChipEstado estado={e.estado !== "error" ? e.estado : paso === "nueva" ? "error" : paso === "resuelta" ? "correcto" : "aviso"} texto={e.estado === "error" ? ROTULOS[paso] : e.estado === "sindatos" ? "Sin datos" : "Aviso"} />
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
                    <Link href={`/servicios/${a.camaraId}`} style={{ fontWeight: 500 }}>{nombre(a.camaraId)}</Link> · {a.titulo}
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
