"use client";

import { Info, X } from "lucide-react";
import { useRef } from "react";
import type { Tema } from "@/lib/ayuda";

/** Botón que abre una ventana con la explicación de un tema, sencilla y técnica. */
export type Rotulos = { sencillo: string; tecnico: string; hoy: string };
const ROTULOS: Rotulos = { sencillo: "Explicado fácil", tecnico: "Para quien conoce el oficio", hoy: "Cómo está hoy" };

export function MasInfo({ tema, rotulos = ROTULOS }: { tema: Tema; rotulos?: Rotulos }) {
  const ventana = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="gx-boton secundario gx-mas-info" onClick={() => ventana.current?.showModal()} aria-haspopup="dialog">
        <Info size={16} strokeWidth={1.7} aria-hidden="true" /> Más información
      </button>
      {/* Pulsar fuera de la ventana también la cierra. */}
      <dialog ref={ventana} className="gx-ventana" aria-labelledby={`info-${tema.id}`} onClick={(ev) => ev.target === ventana.current && ventana.current?.close()}>
        <div className="gx-ventana-caja">
          <header>
            <h2 id={`info-${tema.id}`}>{tema.titulo}</h2>
            <button type="button" className="cerrar" aria-label="Cerrar" onClick={() => ventana.current?.close()}>
              <X size={18} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </header>
          <section>
            <h3>{rotulos.sencillo}</h3>
            {tema.sencillo.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
          <section>
            <h3>{rotulos.tecnico}</h3>
            <ul>
              {tema.tecnico.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section className="hoy">
            <h3>{rotulos.hoy}</h3>
            <p>{tema.hoy}</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
