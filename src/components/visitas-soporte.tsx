"use client";

import { useEffect, useState } from "react";

type Visita = { t: number; motivo: string };

/** Las visitas de soporte a la cuenta de quien mira, para que lo pueda comprobar por sí mismo. */
export function VisitasSoporte() {
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  useEffect(() => {
    fetch("/api/sesion/soporte", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { visitas: [] }))
      .then((d: { visitas: Visita[] }) => setVisitas(d.visitas))
      .catch(() => setVisitas([]));
  }, []);
  if (visitas === null) return <p className="gx-vacio">Cargando…</p>;
  if (!visitas.length) return <p className="gx-vacio">Soporte de Gradiox no ha entrado nunca a ver tu app.</p>;
  return (
    <ul className="gx-lista gx-compro">
      {visitas.map((v) => (
        <li key={v.t}>
          <span>
            <strong style={{ fontWeight: 500 }}>{new Date(v.t).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
            <small>Motivo: {v.motivo}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
