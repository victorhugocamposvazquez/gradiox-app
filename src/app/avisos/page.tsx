"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChipEstado } from "@/components/piezas";
import { duracion, hora } from "@/lib/formato";
import { Download } from "lucide-react";
import { CAMARAS, anticipos, eventos, type Estado } from "@/lib/datos";
import { escalado } from "@/lib/guardias";
import { EQUIPOS } from "@/lib/equipos";
import { estadoAlarma, useDemo, type EstadoAlarma } from "@/lib/store";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const ROTULOS: Record<EstadoAlarma, string> = { nueva: "Nueva", vista: "Vista", curso: "En curso", resuelta: "Resuelta" };

export default function Avisos() {
  const { ahora, ajustes, atendidas, atender, seguimientos, asignar, resolver, guardias, esperaMin } = useDemo();
  const [soloAbiertas, setSoloAbiertas] = useState(false);
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const [horas, setHoras] = useState<24 | 168>(24);
  const [servicio, setServicio] = useState("");
  const [tipo, setTipo] = useState<"" | Exclude<Estado, "correcto">>("");
  // Siete días es mucho que repasar: se rehace cada cinco minutos y no cada uno.
  const tramo = minuto === null ? null : horas === 24 ? minuto : Math.floor(minuto / 5) * 5;
  const todos = useMemo(() => (tramo === null ? [] : eventos(tramo * 60_000, ajustes, horas)), [tramo, ajustes, horas]);
  const sucesos = useMemo(() => todos.filter((e) => (!servicio || e.camaraId === servicio) && (!tipo || e.estado === tipo)), [todos, servicio, tipo]);
  const antes = useMemo(() => (minuto === null ? [] : anticipos(minuto * 60_000, ajustes)), [minuto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Repasando el histórico…</p>;
  const clave = (e: { camaraId: string; desde: number }) => `${e.camaraId}-${e.desde}`;
  const de = (e: { camaraId: string; desde: number }) => estadoAlarma(atendidas[clave(e)], seguimientos[clave(e)]);
  const alarmas = sucesos.filter((e) => e.estado === "error");
  const pendientes = alarmas.filter((e) => de(e) === "nueva").length;
  const abiertas = alarmas.filter((e) => de(e) !== "resuelta").length;
  const visibles = soloAbiertas ? alarmas.filter((e) => de(e) !== "resuelta") : sucesos;
  const TOPE = 30;
  const hoy = new Date(ahora).toDateString();
  const cuando = (t: number) => (new Date(t).toDateString() === hoy ? `A las ${hora(t)}` : `El ${new Date(t).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} a las ${hora(t)}`);
  const titulo = horas === 24 ? "Últimas 24 horas" : "Últimos 7 días";
  const exportar = () => {
    const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const limpio = (v: string) => v.replace(/[;\r\n]+/g, " ");
    const filas = ["Servicio;Clase;Qué pasó;Empezó;Terminó;Minutos;Estado;Quién la lleva;Causa"];
    for (const e of visibles) {
      const seg = seguimientos[clave(e)];
      filas.push([nombre(e.camaraId), e.estado === "error" ? "Alarma" : e.estado === "sindatos" ? "Sin datos" : "Aviso", limpio(e.motivo), fecha(e.desde), fecha(e.hasta), String(Math.round((e.hasta - e.desde) / 60_000)), e.estado === "error" ? ROTULOS[de(e)] : "", limpio(seg?.quien ?? ""), limpio(seg?.causa ?? "")].join(";"));
    }
    const url = URL.createObjectURL(new Blob([`\ufeff${filas.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradiox-avisos-${horas === 24 ? "24h" : "7dias"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Avisos</h1>
          <p className="gx-sub">Lo que ha pasado y lo que conviene mirar antes de que falle</p>
        </div>
        <Link href="/avisos/fallos" className="gx-boton secundario">Fallos típicos e histórico</Link>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta">
          <div className="gx-fila">
            <h2>{titulo}</h2>
            {pendientes > 0 && <span className="gx-chip error">{pendientes} {pendientes === 1 ? "alarma nueva" : "alarmas nuevas"}</span>}
          </div>
          <div className="gx-filtros">
            <div className="gx-periodos" role="group" aria-label="Periodo">
              <button type="button" aria-pressed={horas === 24} onClick={() => setHoras(24)}>24 h</button>
              <button type="button" aria-pressed={horas === 168} onClick={() => setHoras(168)}>7 días</button>
            </div>
            <label className="gx-campo gx-enlinea">
              <select aria-label="Servicio" value={servicio} onChange={(ev) => setServicio(ev.target.value)}>
                <option value="">Todos los servicios</option>
                {CAMARAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="gx-campo gx-enlinea">
              <select aria-label="Clase de aviso" value={tipo} onChange={(ev) => setTipo(ev.target.value as typeof tipo)}>
                <option value="">Alarmas y avisos</option>
                <option value="error">Solo alarmas</option>
                <option value="aviso">Solo avisos</option>
                <option value="sindatos">Solo sin datos</option>
              </select>
            </label>
            <button type="button" className="gx-boton secundario" disabled={visibles.length === 0} onClick={exportar}>
              <Download size={18} strokeWidth={1.6} aria-hidden="true" /> Exportar
            </button>
          </div>
          {alarmas.length > 0 && (
            <div className="gx-periodos" role="group" aria-label="Qué se ve" style={{ marginTop: 12 }}>
              <button type="button" aria-pressed={!soloAbiertas} onClick={() => setSoloAbiertas(false)}>Todo</button>
              <button type="button" aria-pressed={soloAbiertas} onClick={() => setSoloAbiertas(true)}>Alarmas por resolver · {abiertas}</button>
            </div>
          )}
          {visibles.length === 0 ? (
            <p className="gx-vacio">{soloAbiertas ? "Ninguna alarma por resolver." : servicio || tipo ? "Nada con ese filtro en este periodo." : "Ningún aviso. Todos los servicios han estado en su sitio."}</p>
          ) : (
            <ul className="gx-lista">
              {visibles.slice(0, TOPE).map((e) => {
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
                      <small>{cuando(e.desde)} · {sigue ? `sigue, lleva ${duracion(e.hasta - e.desde)}` : `duró ${duracion(e.hasta - e.desde)}`}</small>
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
          {visibles.length > 0 && <p className="gx-nota" style={{ marginTop: 10 }}>{visibles.length > TOPE ? `Se ven los ${TOPE} más recientes de ${visibles.length}. El archivo exportado los lleva todos.` : `${visibles.length} en total.`}</p>}
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
