"use client";

// La visita de conexión, paso a paso y plegada: qué hacer en la planta para
// que la pasarela lea el autómata. Los textos están en src/lib/visita.ts.

import { useState } from "react";
import { MasInfo } from "@/components/mas-info";
import { PASOS_CONEXION, ROTULOS_VISITA } from "@/lib/visita";

export function GuiaConexion() {
  const [actual, setActual] = useState("");
  return (
    <ol className="gx-ruta-guia-visita gx-guia-conexion">
      {PASOS_CONEXION.map((p, n) => {
        const si = actual === p.id;
        const sig = PASOS_CONEXION[n + 1];
        return (
          <li key={p.id}>
            <button type="button" className="cabeza" aria-expanded={si} onClick={() => setActual(si ? "" : p.id)}>
              <span className="marca" aria-hidden="true">{n + 1}</span>
              <strong>{p.titulo}</strong>
              <small>{p.hoy}</small>
            </button>
            {si && (
              <div className="cuerpo">
                <p>{p.corto}</p>
                <ul className="gx-conexion-pasos">
                  {p.sencillo.map((t) => <li key={t}>{t}</li>)}
                </ul>
                <MasInfo tema={p} rotulos={ROTULOS_VISITA} />
                {sig && <button type="button" className="gx-boton secundario" style={{ marginTop: 10 }} onClick={() => setActual(sig.id)}>Siguiente: {sig.titulo.charAt(0).toLowerCase()}{sig.titulo.slice(1)}</button>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
