"use client";

import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { EQUIPOS, citasDelMes, fechaHace, proxima, semanasDelMes, type CitaTipo, type Intervencion } from "@/lib/equipos";
import { dia } from "@/lib/formato";
import { useDemo } from "@/lib/store";

const TIPOS: Intervencion["tipo"][] = ["Revisión", "Avería", "Control de fugas", "Carga de refrigerante"];
const equipo = (id: string) => EQUIPOS.find((e) => e.id === id)?.nombre ?? id;
type Formulario = "ninguno" | "intervencion" | "orden";
type Vista = "lista" | "calendario";
const CLAVE_VISTA = "gradiox-vista-mantenimiento";
const ROTULO_CITA: Record<CitaTipo, string> = { revision: "Revisión que toca", orden: "Orden de trabajo", hecho: "Hecho" };
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

export default function Mantenimiento() {
  const { ahora, registro, apuntar, trabajos, crearTrabajo, cerrarTrabajo } = useDemo();
  const [abierto, setAbierto] = useState<Formulario>("ninguno");
  const [previo, setPrevio] = useState({ equipo: EQUIPOS[0].id, tipo: TIPOS[0] as string, nota: "" });
  const [vista, setVista] = useState<Vista>("lista");
  const [mes, setMes] = useState<{ anio: number; mes: number } | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState<string | null>(null);
  // Desde una alarma se llega con el equipo y el motivo ya puestos.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === "calendario") setVista("calendario");
    } catch {
      // Sin almacenamiento se queda en lista.
    }
    const q = new URLSearchParams(window.location.search);
    const equipoId = q.get("equipo");
    if (!equipoId || !EQUIPOS.some((e) => e.id === equipoId)) return;
    const tipo = q.get("tipo") ?? "";
    setPrevio({ equipo: equipoId, tipo: (TIPOS as string[]).includes(tipo) ? tipo : "Avería", nota: q.get("nota") ?? "" });
    setAbierto(q.get("orden") ? "orden" : "intervencion");
  }, []);
  if (ahora === null) return <p className="gx-sub">Abriendo el libro de mantenimiento…</p>;

  const hoy = fechaHace(ahora, 0);
  const pendientes = EQUIPOS.map((e) => ({ e, p: proxima(e, registro, ahora) })).sort((a, b) => a.p.dias - b.p.dias);
  const abiertas = trabajos.filter((o) => !o.cerrada).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cerradas = trabajos.filter((o) => o.cerrada).slice(0, 5);
  const elegirVista = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ver arriba.
    }
  };
  const m = mes ?? { anio: new Date(ahora).getFullYear(), mes: new Date(ahora).getMonth() };
  const mover = (n: number) => {
    const d = new Date(m.anio, m.mes + n, 1);
    setMes({ anio: d.getFullYear(), mes: d.getMonth() });
    setElegido(null);
  };
  const citas = citasDelMes(m.anio, m.mes, registro, trabajos, ahora);
  const delDia = (f: string) => citas.filter((c) => c.fecha === f);
  const crudo = new Date(m.anio, m.mes, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const nombreMes = crudo.charAt(0).toUpperCase() + crudo.slice(1);
  const enLista = elegido ? delDia(elegido) : citas;

  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    const comun = { equipoId: String(d.get("equipo")), tipo: String(d.get("tipo")) as Intervencion["tipo"], fecha: String(d.get("fecha")) };
    if (abierto === "orden") crearTrabajo({ ...comun, tecnico: String(d.get("tecnico") || ""), tarea: String(d.get("nota") || "") });
    else apuntar({ ...comun, tecnico: String(d.get("tecnico") || "Sin indicar"), nota: String(d.get("nota") || "") });
    setAbierto("ninguno");
  };
  const esOrden = abierto === "orden";

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Mantenimiento</h1>
          <p className="gx-sub">Qué hay que hacer, qué toca revisar y qué se ha hecho en cada equipo</p>
        </div>
        {abierto === "ninguno" && (
          <span className="gx-acciones" style={{ marginTop: 0 }}>
            <button type="button" className="gx-boton" onClick={() => setAbierto("orden")}>Nueva orden de trabajo</button>
            <button type="button" className="gx-boton secundario" onClick={() => setAbierto("intervencion")}>Apuntar una intervención</button>
          </span>
        )}
      </header>

      <div className="gx-pila">
        {abierto !== "ninguno" && (
          <form key={abierto + previo.equipo + previo.nota} className="gx-tarjeta gx-pila gx-form" onSubmit={guardar}>
            <h2>{esOrden ? "Nueva orden de trabajo" : "Apuntar una intervención"}</h2>
            <p className="gx-sub">{esOrden ? "Algo que hay que hacer, con su fecha y quién lo lleva. Al cerrarla pasa sola al libro." : "Algo que ya está hecho y debe quedar en el libro."}</p>
            <div className="gx-formulario">
              <label className="gx-campo">Equipo
                <select name="equipo" required defaultValue={previo.equipo}>{EQUIPOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
              </label>
              <fieldset className="gx-campo gx-opciones ancho">
                <legend>{esOrden ? "Qué clase de trabajo" : "Qué se ha hecho"}</legend>
                <div>
                  {TIPOS.map((t) => (
                    <label key={t}>
                      <input type="radio" name="tipo" value={t} required defaultChecked={t === previo.tipo} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="gx-campo">{esOrden ? "Para qué día" : "Fecha"}
                <input type="date" name="fecha" required defaultValue={hoy} />
              </label>
              <label className="gx-campo">{esOrden ? "Quién lo lleva" : "Técnico"}
                <input type="text" name="tecnico" autoComplete="off" />
              </label>
              <label className="gx-campo ancho">{esOrden ? "Qué hay que hacer" : "Nota"}
                <textarea name="nota" rows={3} required={esOrden} defaultValue={previo.nota} />
              </label>
            </div>
            <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
              <button type="submit" className="gx-boton">{esOrden ? "Crear la orden" : "Guardar"}</button>
              <button type="button" className="gx-boton secundario" onClick={() => setAbierto("ninguno")}>Cancelar</button>
            </div>
          </form>
        )}

        <section className="gx-tarjeta">
          <div className="gx-fila">
            <h2>Órdenes de trabajo</h2>
            {abiertas.length > 0 && <span className="gx-chip neutro">{abiertas.length} {abiertas.length === 1 ? "abierta" : "abiertas"}</span>}
          </div>
          {abiertas.length === 0 ? (
            <p className="gx-vacio">Ninguna orden abierta. Crea una con «Nueva orden de trabajo» o desde una alarma en Avisos.</p>
          ) : (
            <ul className="gx-lista gx-ordenes">
              {abiertas.map((o) => (
                <li key={o.id}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{o.tipo}</strong> · {equipo(o.equipoId)}
                    <small>{o.tarea}</small>
                    <small>Para el {dia(o.fecha)} · {o.tecnico || "sin asignar"}</small>
                    {cerrando === o.id ? (
                      <form
                        className="gx-cierre"
                        style={{ marginTop: 8 }}
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          cerrarTrabajo(o.id, String(new FormData(ev.currentTarget).get("hecho") ?? "").trim(), hoy);
                          setCerrando(null);
                        }}
                      >
                        <label className="gx-campo gx-enlinea">
                          <input type="text" name="hecho" aria-label="Qué se ha hecho" maxLength={160} placeholder="Qué se ha hecho (opcional)" />
                        </label>
                        <button type="submit" className="gx-boton">Cerrar y apuntar en el libro</button>
                        <button type="button" className="gx-boton secundario" onClick={() => setCerrando(null)}>Cancelar</button>
                      </form>
                    ) : (
                      <span className="gx-acciones">
                        <button type="button" className="gx-boton secundario" onClick={() => setCerrando(o.id)}>Cerrar la orden</button>
                      </span>
                    )}
                  </span>
                  <span className={`gx-chip ${o.fecha < hoy ? "error" : o.fecha === hoy ? "aviso" : "neutro"}`}>{o.fecha < hoy ? "Atrasada" : o.fecha === hoy ? "Hoy" : "Abierta"}</span>
                </li>
              ))}
            </ul>
          )}
          {cerradas.length > 0 && (
            <p className="gx-nota" style={{ marginTop: 10 }}>Últimas cerradas: {cerradas.map((o) => `${equipo(o.equipoId)} (${o.tipo.toLowerCase()})`).join(", ")}. Están en el libro.</p>
          )}
        </section>

        <div className="gx-dos">
          <section className="gx-tarjeta">
            <div className="gx-fila">
              <h2>{vista === "lista" ? "Próximas revisiones" : "Calendario"}</h2>
              <div className="gx-vistas" role="group" aria-label="Cómo verlas">
                <button type="button" aria-pressed={vista === "lista"} aria-label="Ver en lista" onClick={() => elegirVista("lista")}>
                  <List size={18} strokeWidth={1.6} aria-hidden="true" />
                </button>
                <button type="button" aria-pressed={vista === "calendario"} aria-label="Ver en calendario" onClick={() => elegirVista("calendario")}>
                  <CalendarDays size={18} strokeWidth={1.6} aria-hidden="true" />
                </button>
              </div>
            </div>
            {vista === "lista" ? (
              <ul className="gx-lista">
                {pendientes.map(({ e, p }) => (
                  <li key={e.id}>
                    <span>
                      {e.nombre}
                      <small>Cada {e.cadaDias} días · toca el {dia(p.fecha)}</small>
                    </span>
                    <span className={`gx-chip ${p.dias < 0 ? "error" : p.dias <= 14 ? "aviso" : "neutro"}`}>
                      {p.dias < 0 ? `Atrasada ${-p.dias} días` : p.dias === 0 ? "Hoy" : `En ${p.dias} días`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="gx-pila" style={{ gap: 12, marginTop: 12 }}>
                <div className="gx-fila">
                  <button type="button" className="gx-boton secundario" aria-label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
                  <strong style={{ fontWeight: 500 }} aria-live="polite">{nombreMes}</strong>
                  <button type="button" className="gx-boton secundario" aria-label="Mes siguiente" onClick={() => mover(1)}><ChevronRight size={18} aria-hidden="true" /></button>
                </div>
                <div className="gx-mes" role="grid" aria-label={`Calendario de ${nombreMes}`}>
                  {DIAS.map((d) => <span key={d} className="cabeza" aria-hidden="true">{d}</span>)}
                  {semanasDelMes(m.anio, m.mes).flat().map((f, i) => {
                    if (!f) return <span key={i} className="hueco" />;
                    const c = delDia(f);
                    const tipos = (["revision", "orden", "hecho"] as const).filter((t) => c.some((x) => x.tipo === t));
                    return (
                      <button key={f} type="button" className={`${f === hoy ? "hoy" : ""}${elegido === f ? " elegido" : ""}`} aria-pressed={elegido === f} aria-label={`${dia(f)}${c.length ? `, ${c.length} ${c.length === 1 ? "cosa" : "cosas"}` : ", nada"}`} onClick={() => setElegido(elegido === f ? null : f)}>
                        {Number(f.slice(8))}
                        <span className="puntos" aria-hidden="true">{tipos.map((t) => <i key={t} className={t} />)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="gx-leyenda">
                  <span><i className="gx-cita revision" />Revisión que toca</span>
                  <span><i className="gx-cita orden" />Orden de trabajo</span>
                  <span><i className="gx-cita hecho" />Hecho</span>
                </div>
                <div>
                  <h3 className="gx-sub" style={{ margin: 0 }}>{elegido ? dia(elegido) : "Todo el mes"}</h3>
                  {enLista.length === 0 ? (
                    <p className="gx-vacio">{elegido ? "Nada ese día." : "Nada este mes."}</p>
                  ) : (
                    <ul className="gx-lista">
                      {enLista.map((c, i) => (
                        <li key={i}>
                          <span>
                            {c.titulo}
                            <small>{elegido ? "" : `${dia(c.fecha)} · `}{c.detalle}</small>
                          </span>
                          <span className={`gx-chip ${c.tipo === "hecho" ? "correcto" : c.tipo === "orden" ? "aviso" : "neutro"}`}>{ROTULO_CITA[c.tipo]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="gx-tarjeta">
            <h2>Libro de intervenciones</h2>
            <ul className="gx-lista">
              {[...registro].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((r) => (
                <li key={r.id}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{r.tipo}</strong> · {equipo(r.equipoId)}
                    <small>{dia(r.fecha)} · {r.tecnico}</small>
                    {r.nota && <small>{r.nota}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className="gx-nota">Los plazos de revisión son de ejemplo. Los reales salen del reglamento y del contrato de mantenimiento de cada instalación.</p>
      </div>
    </>
  );
}
