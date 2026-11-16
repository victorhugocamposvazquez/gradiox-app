"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { PANTALLAS, useHallazgos } from "@/components/buscador";
import { buscar } from "@/lib/turno";

export default function Buscar() {
  const [consulta, setConsulta] = useState("");
  const todo = useHallazgos();
  const hallados = consulta.trim() ? buscar(todo, consulta) : PANTALLAS;
  const grupos = [...new Set(hallados.map((h) => h.grupo))];

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Buscar</h1>
          <p className="gx-sub">Un servicio, un equipo, una orden o una pantalla</p>
        </div>
      </header>
      <div className="gx-pila">
        <label className="gx-campo gx-buscador">
          <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          <input type="search" aria-label="Qué buscas" placeholder="Cámara 2, compresor, luz…" autoFocus value={consulta} onChange={(ev) => setConsulta(ev.target.value)} />
        </label>
        {hallados.length === 0 ? (
          <p className="gx-tarjeta gx-vacio">Nada con «{consulta.trim()}». Prueba con el nombre de un servicio o de un equipo.</p>
        ) : (
          grupos.map((g) => (
            <section key={g} className="gx-tarjeta">
              <h2>{g}</h2>
              <ul className="gx-lista gx-hallazgos">
                {hallados.filter((h) => h.grupo === g).map((h) => (
                  <li key={h.href + h.titulo}>
                    <Link href={h.href}>
                      <strong style={{ fontWeight: 500 }}>{h.titulo}</strong>
                      <small>{h.detalle}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
