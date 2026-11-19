"use client";

// En la portada del panel: quién de los clientes ha pedido una contraseña nueva.

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

type Pendiente = { id: string; usuario: string; nombre: string; cliente: string; nombreCliente: string; cuando: number };

export function PidenClave() {
  const [lista, setLista] = useState<Pendiente[]>([]);
  useEffect(() => {
    fetch("/api/ops/accesos", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ pendientes: Pendiente[] }>) : { pendientes: [] }))
      .then((d) => setLista(d.pendientes))
      .catch(() => setLista([]));
  }, []);
  if (!lista.length) return null;
  return (
    <section className="gx-tarjeta" aria-labelledby="f-piden">
      <h2 id="f-piden" className="gx-con-chip"><KeyRound size={18} strokeWidth={1.7} aria-hidden="true" /> Piden contraseña nueva · {lista.length}</h2>
      <ul className="gx-app-lista">
        {lista.map((p) => (
          <li key={p.id}>
            <span>
              <strong>{p.nombre || p.usuario}</strong>
              <small>{p.nombreCliente || "Cliente"} · usuario {p.usuario} · lo pidió el {new Date(p.cuando).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
            </span>
            <Link href={`/ops/clientes/${p.cliente}?paso=app`} className="gx-boton secundario">Darle una nueva</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
