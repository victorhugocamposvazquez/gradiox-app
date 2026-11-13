"use client";

import Link from "next/link";
import { Maximize, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Marca } from "@/components/marca";
import { Medidor, Temp } from "@/components/piezas";
import { ultimaHora } from "@/lib/analisis";
import { gradosC, hora } from "@/lib/formato";
import { NAVES } from "@/lib/naves";
import { CAMARAS, leer, rotulo, type Estado } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { avanceRonda, fechaLocal, turnoDe } from "@/lib/turno";

const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
const TEXTO: Record<Estado, string> = { correcto: "Bien", aviso: "Aviso", error: "Alarma", sindatos: "Sin datos" };
const CAMBIO_S = 20;
const PANELES = ["Servicios", "Qué hay pendiente"] as const;

/** La última hora, dibujada a lo ancho de la tarjeta. */
function Trazo({ valores, limite }: { valores: number[]; limite: number }) {
  const W = 300;
  const H = 56;
  const min = Math.min(...valores) - 0.6;
  const max = Math.max(Math.max(...valores) + 0.6, Math.min(limite, Math.max(...valores) + 3));
  const x = (i: number) => (i / Math.max(1, valores.length - 1)) * W;
  const y = (v: number) => 3 + ((max - v) / (max - min)) * (H - 6);
  const linea = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg className="trazo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${linea}L${W},${H}L0,${H}Z`} className="fondo" />
      <path d={linea} className="linea" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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

  const todos = CAMARAS.map((c, orden) => ({ c, orden, l: leer(c, ahora, ajustes), ultima: ultimaHora(c, ahora, ajustes) })).sort((a, b) => GRAVEDAD[a.l.estado] - GRAVEDAD[b.l.estado] || a.orden - b.orden);
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
        <Marca size={24} />
        <span className="nave">{NAVES[0].nombre}</span>
        <span className="mandos">
          <button type="button" aria-label="Pantalla completa" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
            <Maximize size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <Link href="/servicios" aria-label="Salir de la pantalla de pared" onClick={() => void (document.fullscreenElement && document.exitFullscreen?.().catch(() => undefined))}>
            <X size={20} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </span>
      </header>

      <div className="cabeza">
        <div>
          <p className="titular" role="status">
            <span className={`gx-punto vivo ${general === "correcto" ? "" : general}`} aria-hidden="true" />
            {titular}
          </p>
          <p className="cuenta">
            {todos.length - mal.length} de {todos.length} servicios bien{alarmas ? ` · ${alarmas} en alarma` : ""}{avisos ? ` · ${avisos} con aviso` : ""}{mudos ? ` · ${mudos} sin datos` : ""}
          </p>
        </div>
        <p className="reloj">
          <b>{hora(ahora)}</b>
          <span>{new Date(ahora).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>
        </p>
      </div>

      <main>
        <h1 className="gx-oculto">Pantalla de pared</h1>
        {panel === 0 ? (
          <ul className="gx-pared-rejilla" aria-label="Servicios">
            {todos.map(({ c, l, ultima }) => (
              <li key={c.id} className={l.estado}>
                <div className="arriba">
                  <span className="nombre"><span className={`gx-punto ${l.estado === "correcto" ? "" : l.estado}`} aria-hidden="true" />{c.nombre}</span>
                  <span className="clase">{rotulo(c)}</span>
                </div>
                <div className="medio">
                  <Temp valor={l.temp} />
                  <Trazo valores={ultima} limite={c.limite} />
                </div>
                <Medidor temp={l.temp} consigna={c.consigna} limite={c.limite} estado={l.estado} />
                <p className="pie"><span>{l.estado === "correcto" || l.motivo.startsWith(TEXTO[l.estado]) ? l.motivo : `${TEXTO[l.estado]} · ${l.motivo}`}</span><span>Límite {gradosC(c.limite)}</span></p>
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
