"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CAMPOS_FICHA, EQUIPOS, FICHA_VACIA, proxima, type FichaEquipo } from "@/lib/equipos";
import { dia } from "@/lib/formato";
import { CAMARAS } from "@/lib/datos";
import { useDemo } from "@/lib/store";

export default function FichaDeEquipo() {
  const { id } = useParams<{ id: string }>();
  const { ahora, registro, trabajos, fichas, guardarFicha } = useDemo();
  const [editando, setEditando] = useState(false);
  const e = EQUIPOS.find((x) => x.id === id);
  if (!e) return <p className="gx-sub">Ese equipo no existe. <Link href="/mantenimiento" className="gx-volver">Volver a mantenimiento</Link></p>;
  if (ahora === null) return <p className="gx-sub">Abriendo la ficha…</p>;

  const ficha = { ...FICHA_VACIA, ...fichas[e.id] };
  const rellenos = CAMPOS_FICHA.filter((c) => ficha[c.clave]).length;
  const p = proxima(e, registro, ahora);
  const hechas = registro.filter((r) => r.equipoId === e.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const abiertas = trabajos.filter((o) => o.equipoId === e.id && !o.cerrada);
  const servicio = CAMARAS.find((c) => c.id === e.camaraId);
  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    const nueva = { ...FICHA_VACIA };
    for (const k of Object.keys(nueva) as (keyof FichaEquipo)[]) nueva[k] = String(d.get(k) ?? "").trim();
    guardarFicha(e.id, nueva);
    setEditando(false);
  };

  return (
    <>
      <Link href="/mantenimiento" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Mantenimiento
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>{e.nombre}</h1>
          <p className="gx-sub">{e.tipo}{servicio ? <> · <Link href={`/servicios/${servicio.id}`} style={{ color: "var(--gx-azul)" }}>{servicio.nombre}</Link></> : " · da frío a toda la nave"}</p>
        </div>
        <span className={`gx-chip ${p.dias < 0 ? "error" : p.dias <= 14 ? "aviso" : "neutro"}`}>
          {p.dias < 0 ? `Revisión atrasada ${-p.dias} días` : p.dias === 0 ? "Revisión hoy" : `Revisión en ${p.dias} días`}
        </span>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <h2>Datos del equipo</h2>
            {!editando && <button type="button" className="gx-boton secundario" onClick={() => setEditando(true)}>{rellenos ? "Cambiar" : "Rellenar"}</button>}
          </div>
          {editando ? (
            <form className="gx-pila" style={{ gap: 12 }} onSubmit={guardar}>
              <div className="gx-formulario">
                {CAMPOS_FICHA.map((c) => (
                  <label key={c.clave} className="gx-campo">{c.texto}
                    <input type="text" name={c.clave} defaultValue={ficha[c.clave]} placeholder={c.ayuda} autoComplete="off" maxLength={60} inputMode={c.clave === "anio" || c.clave === "cargaKg" ? "decimal" : undefined} />
                  </label>
                ))}
                <label className="gx-campo ancho">Otras notas
                  <textarea name="notas" rows={3} defaultValue={ficha.notas} placeholder="Dónde está el manual, quién lo instaló, repuestos que lleva…" />
                </label>
              </div>
              <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
                <button type="submit" className="gx-boton">Guardar</button>
                <button type="button" className="gx-boton secundario" onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            </form>
          ) : rellenos === 0 && !ficha.notas ? (
            <p className="gx-vacio">Sin datos todavía. Apunta marca, modelo, número de serie y refrigerante: es lo primero que pide el técnico por teléfono.</p>
          ) : (
            <>
              <div className="gx-datos">
                {CAMPOS_FICHA.map((c) => (
                  <div key={c.clave} className="gx-dato"><span>{c.texto}</span><strong>{ficha[c.clave] || "Sin apuntar"}</strong></div>
                ))}
              </div>
              {ficha.notas && <p className="gx-nota">{ficha.notas}</p>}
            </>
          )}
          <p className="gx-nota">Estos datos los escribe quien conoce la instalación y se guardan en este dispositivo. Gradiox no los trae puestos.</p>
        </section>

        <div className="gx-pila">
          <section className="gx-tarjeta">
            <h2>Revisión</h2>
            <ul className="gx-lista">
              <li><span>Cada {e.cadaDias} días<small>Toca el {dia(p.fecha)}</small></span></li>
              {abiertas.map((o) => (
                <li key={o.id}>
                  <span>{o.tipo}: {o.tarea}<small>Orden de trabajo para el {dia(o.fecha)} · {o.tecnico || "sin asignar"}</small></span>
                  <span className="gx-chip aviso">Abierta</span>
                </li>
              ))}
            </ul>
            <Link href={`/mantenimiento?orden=1&equipo=${e.id}&tipo=Revisión`} className="gx-boton secundario" style={{ marginTop: 8 }}>Crear una orden de trabajo</Link>
          </section>

          <section className="gx-tarjeta">
            <h2>Historial</h2>
            {hechas.length === 0 ? (
              <p className="gx-vacio">Nada apuntado en el libro para este equipo.</p>
            ) : (
              <ul className="gx-lista">
                {hechas.map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{r.tipo}</strong>
                      <small>{dia(r.fecha)} · {r.tecnico}</small>
                      {r.nota && <small>{r.nota}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
