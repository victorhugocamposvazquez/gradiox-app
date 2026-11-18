"use client";

import { AreaTexto } from "@/components/area-texto";
import { Check, ChevronDown, Plus, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Nota, TareaApp } from "@/tareas/github";

type Estado = { activadas: boolean; tareas: TareaApp[] } | null;

const cuando = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(ruta, cuerpo === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string; activadas?: boolean };
  if (!r.ok && d.activadas !== false) throw new Error(d.error ?? "No se ha podido completar");
  return d;
}

function Tarea({ t, alCambiar }: { t: TareaApp; alCambiar: (t: TareaApp) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState("");

  useEffect(() => {
    if (!abierto || notas) return;
    let vivo = true;
    pedir<{ notas: Nota[] }>(`/api/ops/tareas/${t.numero}`)
      .then((d) => vivo && setNotas(d.notas))
      .catch((e: Error) => vivo && setFallo(e.message));
    return () => {
      vivo = false;
    };
  }, [abierto, notas, t.numero]);

  const hacer = async (cuerpo: { nota: string } | { abierta: boolean }) => {
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ nota?: Nota; tarea?: TareaApp }>(`/api/ops/tareas/${t.numero}`, cuerpo);
      if (d.nota) {
        setNotas((n) => [...(n ?? []), d.nota as Nota]);
        setNota("");
        alCambiar({ ...t, notas: t.notas + 1 });
      }
      if (d.tarea) alCambiar(d.tarea);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido completar");
    }
    setOcupado(false);
  };
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    if (nota.trim()) void hacer({ nota });
  };

  return (
    <li className={`gx-tarea${t.abierta ? "" : " hecha"}`}>
      <button type="button" className="cabeza" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span className="titulo">
          {t.titulo}
          <small>
            Nº {t.numero} · {cuando(t.creada)} · {t.notas === 0 ? "sin notas" : t.notas === 1 ? "1 nota" : `${t.notas} notas`}
          </small>
        </span>
        <span className={`gx-chip ${t.abierta ? "azul" : "correcto"}`}>{t.abierta ? "Abierta" : "Hecha"}</span>
        <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" className="giro" />
      </button>
      {abierto && (
        <div className="cuerpo">
          {t.detalle && <p className="detalle">{t.detalle}</p>}
          {notas === null ? (
            !fallo && <p className="gx-vacio">Cargando las notas…</p>
          ) : notas.length === 0 ? (
            <p className="gx-vacio">Sin notas todavía. Lo que escribas aquí le llega a Claude.</p>
          ) : (
            <ul className="gx-notas">
              {notas.map((n) => (
                <li key={n.id} className={n.autor}>
                  <small>{n.autor === "app" ? "Tú" : "Claude"} · {cuando(n.cuando)}</small>
                  <p>{n.texto}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={enviar} className="gx-nota-nueva">
            <label className="gx-campo">
              <span className="gx-solo-lector">Nota nueva</span>
              <AreaTexto rows={2} maxLength={4000} value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Añade una nota o una respuesta" />
            </label>
            <div className="acciones">
              <button type="submit" className="gx-boton" disabled={ocupado || !nota.trim()}>
                <Send size={16} strokeWidth={1.7} aria-hidden="true" /> Enviar nota
              </button>
              <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer({ abierta: !t.abierta })}>
                {t.abierta ? <Check size={16} strokeWidth={1.7} aria-hidden="true" /> : <RotateCcw size={16} strokeWidth={1.7} aria-hidden="true" />}
                {t.abierta ? "Marcar como hecha" : "Volver a abrir"}
              </button>
            </div>
          </form>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
        </div>
      )}
    </li>
  );
}

export default function Tareas() {
  const [estado, setEstado] = useState<Estado>(null);
  const [fallo, setFallo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const d = await pedir<{ activadas: boolean; tareas?: TareaApp[] }>("/api/ops/tareas");
      setEstado({ activadas: d.activadas, tareas: d.tareas ?? [] });
      setFallo("");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se han podido leer las tareas");
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!titulo.trim() || !estado) return;
    setOcupado(true);
    try {
      const d = await pedir<{ tarea: TareaApp }>("/api/ops/tareas", { titulo, detalle });
      setEstado({ ...estado, tareas: [d.tarea, ...estado.tareas] });
      setTitulo("");
      setDetalle("");
      setFallo("");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido crear la tarea");
    }
    setOcupado(false);
  };
  const cambiar = (t: TareaApp) => setEstado((e) => (e ? { ...e, tareas: e.tareas.map((x) => (x.numero === t.numero ? t : x)) } : e));

  const abiertas = estado?.tareas.filter((t) => t.abierta) ?? [];
  const hechas = estado?.tareas.filter((t) => !t.abierta) ?? [];

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Tareas</h1>
          <p className="gx-sub">Lo que falta por hacer en Gradiox. Lo que anotes aquí lo lee Claude, y sus respuestas aparecen en cada tarea.</p>
        </div>
      </header>

      <div className="gx-pila">
        {estado === null ? (
          <p className="gx-sub">{fallo || "Leyendo las tareas…"}</p>
        ) : !estado.activadas ? (
          <section className="gx-tarjeta">
            <h2>Las tareas aún no están activadas</h2>
            <p className="gx-vacio">El primer paso es poner en el servidor el permiso para guardar las tareas en GitHub (variable GRADIOX_GITHUB_TOKEN). En cuanto esté, aquí podrás añadir tareas y notas.</p>
          </section>
        ) : (
          <>
            <form className="gx-tarjeta gx-tarea-nueva" onSubmit={crear}>
              <label className="gx-campo">
                Tarea nueva
                <input value={titulo} maxLength={160} onChange={(ev) => setTitulo(ev.target.value)} placeholder="Qué falta o qué hay que cambiar" />
              </label>
              <label className="gx-campo">
                Detalle, si hace falta
                <AreaTexto rows={2} maxLength={4000} value={detalle} onChange={(ev) => setDetalle(ev.target.value)} />
              </label>
              <div>
                <button type="submit" className="gx-boton" disabled={ocupado || !titulo.trim()}>
                  <Plus size={18} strokeWidth={1.7} aria-hidden="true" /> Añadir tarea
                </button>
              </div>
              {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
            </form>

            <section className="gx-tarjeta">
              <h2>Abiertas · {abiertas.length}</h2>
              {abiertas.length ? (
                <ul className="gx-tareas">{abiertas.map((t) => <Tarea key={t.numero} t={t} alCambiar={cambiar} />)}</ul>
              ) : (
                <p className="gx-vacio">No hay ninguna tarea abierta. Añade la primera arriba.</p>
              )}
            </section>

            {hechas.length > 0 && (
              <section className="gx-tarjeta">
                <h2>Hechas · {hechas.length}</h2>
                <ul className="gx-tareas">{hechas.map((t) => <Tarea key={t.numero} t={t} alCambiar={cambiar} />)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
