"use client";

import Link from "next/link";
import { ChevronRight, LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";
import { NAVES, estadoNave, porGravedad } from "@/lib/naves";
import { useDemo } from "@/lib/store";

type Vista = "cuadricula" | "lista";
const CLAVE_VISTA = "gradiox-vista-naves";
const TEXTO = { correcto: "Bien", aviso: "Con aviso", error: "En alarma", sindatos: "Sin datos" } as const;

export default function Naves() {
  const { ahora, ajustes } = useDemo();
  const [vista, setVista] = useState<Vista>("cuadricula");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === "lista") setVista("lista");
    } catch {
      // Sin almacenamiento se queda en cuadrícula.
    }
  }, []);
  if (ahora === null) return <p className="gx-sub">Mirando las naves…</p>;
  const elegir = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ver arriba.
    }
  };
  const naves = NAVES.map((n, i) => ({ n, e: estadoNave(n, i, ahora, ajustes) })).sort((a, b) => porGravedad(a.e, b.e));
  const bien = naves.filter((x) => x.e.estado === "correcto").length;
  const fila = (x: (typeof naves)[number]) => (
    <>
      <span className="nombre">
        <i className={`gx-punto ${x.e.estado === "correcto" ? "" : x.e.estado}`} />
        <span>
          {x.n.nombre}
          <small>{x.n.servicios} servicios · {x.n.detalle}</small>
        </span>
      </span>
      <span><span className={`gx-chip ${x.e.estado}`}>{TEXTO[x.e.estado]}</span></span>
      <span className="gx-sub solo-ancho">{x.e.resumen}</span>
      <span className="fin">{x.n.ejemplo ? <span className="gx-chip neutro">Ejemplo</span> : <span className="gx-entrar">Entrar <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" /></span>}</span>
    </>
  );

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Naves</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${bien < naves.length ? " aviso" : ""}`} />
            {bien === naves.length ? "Todas en orden" : `${naves.length - bien} de ${naves.length} con algo abierto`}
          </p>
        </div>
        <div className="gx-vistas" role="group" aria-label="Cómo verlas">
          <button type="button" aria-pressed={vista === "cuadricula"} aria-label="Ver en cuadrícula" onClick={() => elegir("cuadricula")}>
            <LayoutGrid size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" aria-pressed={vista === "lista"} aria-label="Ver en lista" onClick={() => elegir("lista")}>
            <List size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="gx-pila">
        {vista === "cuadricula" ? (
          <div className="gx-rejilla">
            {naves.map((x) => {
              const dentro = (
                <>
                  <div className="gx-fila">
                    <span className={`gx-hoy-aro pequeno ${x.e.estado}`} aria-hidden="true" />
                    <span className={`gx-chip ${x.e.estado}`}>{TEXTO[x.e.estado]}</span>
                  </div>
                  <div>
                    <h2>{x.n.nombre}</h2>
                    <p className="gx-sub">{x.n.servicios} servicios · {x.e.resumen}</p>
                  </div>
                  {x.n.ejemplo ? <span className="gx-chip neutro" style={{ alignSelf: "flex-start" }}>Ejemplo</span> : <span className="gx-entrar">Entrar <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" /></span>}
                </>
              );
              return x.n.ejemplo ? (
                <section key={x.n.id} className="gx-tarjeta gx-nave">{dentro}</section>
              ) : (
                <Link key={x.n.id} href="/" className="gx-tarjeta gx-nave propia">{dentro}</Link>
              );
            })}
          </div>
        ) : (
          <div className="gx-renglones gx-red gx-naves">
            {naves.map((x) =>
              x.n.ejemplo ? <div key={x.n.id} className="gx-renglon">{fila(x)}</div> : <Link key={x.n.id} href="/" className="gx-renglon">{fila(x)}</Link>,
            )}
          </div>
        )}
        <p className="gx-nota">Solo la nave de demostración tiene detalle. Las otras tres son ejemplos con un estado inventado, para enseñar cómo vería un instalador todas sus instalaciones juntas.</p>
      </div>
    </>
  );
}
