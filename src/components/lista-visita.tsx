"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { LISTA } from "@/lib/visita";

const CLAVE = "gradiox-lista-visita";

/** Lista para marcar durante una visita. Se guarda en este dispositivo. */
export function ListaVisita() {
  const [hechos, setHechos] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]");
      if (Array.isArray(v)) setHechos(v.filter((x): x is string => typeof x === "string"));
    } catch {
      // Sin almacenamiento la lista empieza vacía.
    }
  }, []);
  const guardar = (v: string[]) => {
    setHechos(v);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(v));
    } catch {
      // Ver arriba.
    }
  };
  const total = LISTA.length;
  const marcados = LISTA.filter((x) => hechos.includes(x.id)).length;

  return (
    <>
      <div className="gx-fila">
        <p className="gx-sub">
          {marcados === total ? "Lo tienes todo." : `${marcados} de ${total} cosas recogidas`}
        </p>
        <button type="button" className="gx-boton secundario" onClick={() => guardar([])} disabled={marcados === 0}>
          <RotateCcw size={16} strokeWidth={1.7} aria-hidden="true" /> Empezar otra visita
        </button>
      </div>
      <ul className="gx-lista-visita">
        {LISTA.map((x) => {
          const hecho = hechos.includes(x.id);
          return (
            <li key={x.id}>
              <label className={hecho ? "hecho" : undefined}>
                <input type="checkbox" checked={hecho} onChange={() => guardar(hecho ? hechos.filter((h) => h !== x.id) : [...hechos, x.id])} />
                <span>{x.texto}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="gx-nota">Las marcas se guardan solo en este dispositivo. Las notas y las fotos, de momento, van aparte.</p>
    </>
  );
}
