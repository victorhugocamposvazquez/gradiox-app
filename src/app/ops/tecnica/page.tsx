"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SinBase } from "@/components/sin-base";
import type { ResumenCliente } from "@/clientes/modelo";
import { pedir } from "@/clientes/navegador";
import { GOBIERNO, VIA_CORTA } from "@/clientes/tecnica";

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Todas las fichas técnicas juntas: una por instalación, con lo que le falta a cada una. */
export default function FichasTecnicas() {
  const [clientes, setClientes] = useState<ResumenCliente[] | null>(null);
  const [base, setBase] = useState(true);
  const [fallo, setFallo] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    pedir<{ guardado: "memoria" | "base"; clientes: ResumenCliente[] }>("/api/ops/clientes")
      .then((d) => {
        setClientes(d.clientes);
        setBase(d.guardado === "base");
      })
      .catch((e: Error) => setFallo(e.message));
  }, []);

  const fichas = (clientes ?? []).flatMap((c) => c.tecnicas.map((t) => ({ ...t, cliente: c.id, empresa: c.nombre })));
  const q = busca.trim().toLowerCase();
  const vistas = fichas.filter((f) => !q || `${f.empresa} ${f.nombre}`.toLowerCase().includes(q)).sort((a, b) => b.faltan - a.faltan || a.empresa.localeCompare(b.empresa, "es"));
  const completas = fichas.filter((f) => f.faltan === 0).length;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Fichas técnicas</h1>
          <p className="gx-sub">Cómo se conecta Gradiox a cada instalación: qué equipos hay, por dónde se leen, quién lo sabe y qué falta.</p>
        </div>
      </header>
      <div className="gx-pila">
        {!base && <SinBase />}
        <div className="gx-patron">
          <section className="gx-tarjeta realce gx-foco" aria-label="Estado de las fichas">
            <span className="gx-chip">{cuenta(fichas.length, "instalación", "instalaciones")}</span>
            <h2>{fichas.length === 0 ? "Todavía no hay ninguna instalación apuntada" : completas === fichas.length ? "Todas tienen lo necesario para conectar" : `${cuenta(fichas.length - completas, "ficha tiene", "fichas tienen")} datos por saber`}</h2>
            <p>Cada instalación es distinta. Aquí queda escrito lo particular de cada una.</p>
          </section>
          <div className="gx-cifras sueltas tres">
            <div><span>Completas</span><strong>{completas}</strong></div>
            <div><span>Con autómata</span><strong>{fichas.filter((f) => f.gobierno === "automata" || f.gobierno === "mixto").length}</strong></div>
            <div><span>Señales apuntadas</span><strong>{fichas.reduce((n, f) => n + f.senales, 0)}</strong></div>
          </div>
        </div>
        <section className="gx-tarjeta" aria-labelledby="ft-lista">
          <div className="gx-lista-cabeza">
            <h2 id="ft-lista">Instalaciones · {vistas.length}</h2>
            {fichas.length > 0 && (
              <label className="gx-campo gx-filtro">
                <span className="gx-solo-lector">Buscar instalación</span>
                <Search size={15} aria-hidden="true" />
                <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" />
              </label>
            )}
          </div>
          {clientes === null ? (
            <p className="gx-vacio" role={fallo ? "alert" : undefined}>{fallo || "Leyendo las fichas…"}</p>
          ) : fichas.length === 0 ? (
            <p className="gx-vacio">La ficha técnica es de cada instalación. Da de alta un cliente en «Clientes» y apunta su instalación: aparecerá aquí.</p>
          ) : vistas.length === 0 ? (
            <p className="gx-vacio">Ninguna instalación coincide con lo que buscas.</p>
          ) : (
            <ul className="gx-tareas gx-clientes">
              {vistas.map((f) => (
                <li key={f.id}>
                  <Link href={`/ops/clientes/${f.cliente}/tecnica?i=${f.id}`}>
                    <span>
                      <strong>{f.empresa} · {f.nombre}</strong>
                      <small>{[f.gobierno ? GOBIERNO[f.gobierno] : "Sin saber qué gobierna el frío", `Vía: ${VIA_CORTA[f.via]}`, cuenta(f.puntos, "cámara", "cámaras"), cuenta(f.senales, "señal", "señales")].join(" · ")}</small>
                    </span>
                    <span className="chips">
                      <span className={`gx-chip ${f.faltan ? "aviso" : "correcto"}`}>{f.faltan ? `Faltan ${f.faltan}` : "Completa"}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
