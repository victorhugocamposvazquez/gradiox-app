"use client";

import { Info, X } from "lucide-react";
import { useRef } from "react";
import type { Tema } from "@/lib/ayuda";

/** Botón que abre una ventana con la explicación de un tema, sencilla y técnica. */
export function MasInfo({ tema }: { tema: Tema }) {
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
            <h3>Explicado fácil</h3>
            {tema.sencillo.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
          <section>
            <h3>Para quien conoce el oficio</h3>
            <ul>
              {tema.tecnico.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section className="hoy">
            <h3>Cómo está hoy</h3>
            <p>{tema.hoy}</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
