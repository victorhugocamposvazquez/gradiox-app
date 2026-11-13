"use client";

import { useEffect, useState, type FormEvent } from "react";
import { EQUIPOS, fechaHace, proxima, type Intervencion } from "@/lib/equipos";
import { dia } from "@/lib/formato";
import { useDemo } from "@/lib/store";

const TIPOS: Intervencion["tipo"][] = ["Revisión", "Avería", "Control de fugas", "Carga de refrigerante"];
const equipo = (id: string) => EQUIPOS.find((e) => e.id === id)?.nombre ?? id;

export default function Mantenimiento() {
  const { ahora, registro, apuntar } = useDemo();
  const [abierto, setAbierto] = useState(false);
  const [previo, setPrevio] = useState({ equipo: EQUIPOS[0].id, tipo: TIPOS[0] as string, nota: "" });
  // Desde una alarma se llega con el equipo y el motivo ya puestos.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const equipoId = q.get("equipo");
    if (!equipoId || !EQUIPOS.some((e) => e.id === equipoId)) return;
    const tipo = q.get("tipo") ?? "";
    setPrevio({ equipo: equipoId, tipo: (TIPOS as string[]).includes(tipo) ? tipo : "Avería", nota: q.get("nota") ?? "" });
    setAbierto(true);
  }, []);
  if (ahora === null) return <p className="gx-sub">Abriendo el libro de mantenimiento…</p>;

  const pendientes = EQUIPOS.map((e) => ({ e, p: proxima(e, registro, ahora) })).sort((a, b) => a.p.dias - b.p.dias);

  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    apuntar({
      equipoId: String(d.get("equipo")),
      tipo: String(d.get("tipo")) as Intervencion["tipo"],
      fecha: String(d.get("fecha")),
      tecnico: String(d.get("tecnico") || "Sin indicar"),
      nota: String(d.get("nota") || ""),
    });
    setAbierto(false);
  };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Mantenimiento</h1>
          <p className="gx-sub">Qué toca revisar y qué se ha hecho en cada equipo</p>
        </div>
        {!abierto && (
          <button type="button" className="gx-boton" onClick={() => setAbierto(true)}>Apuntar una intervención</button>
        )}
      </header>

      <div className="gx-pila">
        {abierto && (
          <form key={previo.equipo + previo.nota} className="gx-tarjeta gx-pila gx-form" onSubmit={guardar}>
            <h2>Apuntar una intervención</h2>
            <div className="gx-formulario">
              <label className="gx-campo">Equipo
                <select name="equipo" required defaultValue={previo.equipo}>{EQUIPOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
              </label>
              <fieldset className="gx-campo gx-opciones ancho">
                <legend>Qué se ha hecho</legend>
                <div>
                  {TIPOS.map((t) => (
                    <label key={t}>
                      <input type="radio" name="tipo" value={t} required defaultChecked={t === previo.tipo} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="gx-campo">Fecha
                <input type="date" name="fecha" required defaultValue={fechaHace(ahora, 0)} />
              </label>
              <label className="gx-campo">Técnico
                <input type="text" name="tecnico" autoComplete="off" />
              </label>
              <label className="gx-campo ancho">Nota
                <textarea name="nota" rows={3} defaultValue={previo.nota} />
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
            <h2>Próximas revisiones</h2>
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
