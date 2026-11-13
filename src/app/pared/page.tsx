"use client";

import Link from "next/link";
import { Maximize, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Marca } from "@/components/marca";
import { ChipEstado, Temp } from "@/components/piezas";
import { hora } from "@/lib/formato";
import { NAVES } from "@/lib/naves";
import { CAMARAS, leer, type Estado } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { avanceRonda, fechaLocal, turnoDe } from "@/lib/turno";

const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
const TEXTO: Record<Estado, string> = { correcto: "Bien", aviso: "Aviso", error: "Alarma", sindatos: "Sin datos" };
const CAMBIO_S = 20;
const PANELES = ["Servicios", "Qué hay pendiente"] as const;

export default function Pared() {
  const { ahora, ajustes, trabajos, rondas, puntosRonda, relevos } = useDemo();
  const [panel, setPanel] = useState(0);
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    if (quieto) return;
    const id = window.setInterval(() => setPanel((p) => (p + 1) % PANELES.length), CAMBIO_S * 1000);
    return () => window.clearInterval(id);
  }, [quieto]);
  if (ahora === null) return <p className="gx-sub" style={{ padding: 24 }}>Leyendo los servicios…</p>;

  const todos = CAMARAS.map((c, orden) => ({ c, orden, l: leer(c, ahora, ajustes) })).sort((a, b) => GRAVEDAD[a.l.estado] - GRAVEDAD[b.l.estado] || a.orden - b.orden);
  const alarmas = todos.filter((x) => x.l.estado === "error").length;
  const mudos = todos.filter((x) => x.l.estado === "sindatos").length;
  const avisos = todos.filter((x) => x.l.estado === "aviso").length;
  const general: Estado = alarmas ? "error" : mudos ? "sindatos" : avisos ? "aviso" : "correcto";
  const titular = alarmas ? `${alarmas} en alarma` : mudos ? `${mudos} sin datos` : avisos ? `${avisos} con aviso` : "Todo en orden";
  const mal = todos.filter((x) => x.l.estado !== "correcto");
  const abiertas = trabajos.filter((o) => !o.cerrada);
  const ronda = avanceRonda(puntosRonda, rondas[fechaLocal(ahora)]);
  const turno = turnoDe(ahora);
  const relevo = relevos[0];

  return (
    <div className={`gx-pared ${general}`}>
      <header>
        <Marca size={30} />
        <p className="titular" role="status">
          <span className={`gx-punto vivo ${general === "correcto" ? "" : general}`} aria-hidden="true" />
          {titular}
        </p>
        <p className="reloj">{NAVES[0].nombre} · <b>{hora(ahora)}</b></p>
        <span className="mandos">
          <button type="button" aria-label="Pantalla completa" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
            <Maximize size={20} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <Link href="/servicios" aria-label="Salir de la pantalla de pared" onClick={() => void (document.fullscreenElement && document.exitFullscreen?.().catch(() => undefined))}>
            <X size={22} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </span>
      </header>

      <main>
        <h1 className="gx-oculto">Pantalla de pared</h1>
        {panel === 0 ? (
          <ul className="gx-pared-rejilla" aria-label="Servicios">
            {todos.map(({ c, l }) => (
              <li key={c.id} className={l.estado}>
                <span className="nombre">{c.nombre}</span>
                <Temp valor={l.temp} />
                <span className="pie">
                  <ChipEstado estado={l.estado} texto={TEXTO[l.estado]} />
                  <small>{l.motivo}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="gx-pared-pendiente">
            <section>
              <h2>Servicios que no están bien</h2>
              {mal.length === 0 ? <p>Ninguno.</p> : <ul>{mal.slice(0, 6).map(({ c, l }) => <li key={c.id}><b>{c.nombre}</b>{l.motivo}</li>)}</ul>}
            </section>
            <section>
              <h2>Órdenes de trabajo abiertas</h2>
              {abiertas.length === 0 ? <p>Ninguna.</p> : <ul>{abiertas.slice(0, 6).map((o) => <li key={o.id}><b>{o.tarea}</b>{o.tecnico ? `Lo lleva ${o.tecnico}` : "Sin asignar"}</li>)}</ul>}
            </section>
            <section>
              <h2>{turno.nombre}</h2>
              <ul>
                <li><b>Ronda de hoy</b>{ronda.hechos} de {ronda.total} puntos mirados{ronda.aMirar ? `, ${ronda.aMirar} por mirar` : ""}</li>
                <li><b>Último relevo</b>{relevo ? `${relevo.quien}, a las ${hora(relevo.cuando)}` : "Sin apuntar"}</li>
              </ul>
            </section>
          </div>
        )}
      </main>

      <footer>
        <span className="gx-periodos" role="group" aria-label="Qué se ve">
          {PANELES.map((p, i) => (
            <button key={p} type="button" aria-pressed={panel === i} onClick={() => setPanel(i)}>{p}</button>
          ))}
        </span>
        <button type="button" className="rota" aria-pressed={quieto} onClick={() => setQuieto(!quieto)}>{quieto ? "Parada: no cambia sola" : `Cambia sola cada ${CAMBIO_S} s`}</button>
        <span className="demo">Demostración con datos simulados</span>
      </footer>
    </div>
  );
}
