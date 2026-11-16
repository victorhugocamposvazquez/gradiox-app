"use client";

import { Router } from "lucide-react";
import { useEffect, useState } from "react";
import { duracion, grados } from "@/lib/formato";
import type { EquipoReal, ResumenLecturas } from "@/conexion/resumen";

const CADA_MS = 15_000;
/** Pasado este tiempo sin entregas, la pasarela se da por callada. */
const CALLADA_MS = 3 * 60_000;

const hace = (ahora: number, t: number) => {
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${duracion(ahora - t)}`;
};

function Curva({ puntos }: { puntos: EquipoReal["temperaturas"] }) {
  if (puntos.length < 2) return <span className="gx-reales-curva" />;
  const vs = puntos.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const t0 = puntos[0].t;
  const dt = puntos[puntos.length - 1].t - t0 || 1;
  const linea = puntos.map((p) => `${(((p.t - t0) / dt) * 118 + 1).toFixed(1)},${(27 - ((p.v - min) / (max - min || 1)) * 24).toFixed(1)}`).join(" ");
  return (
    <svg className="gx-reales-curva" viewBox="0 0 120 30" preserveAspectRatio="none" role="img" aria-label={`Temperatura de la última hora: entre ${grados(min)} y ${grados(max)}`}>
      <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Equipo({ e, ahora }: { e: EquipoReal; ahora: number }) {
  const l = e.ultima.lectura;
  return (
    <li>
      <span className="nombre">
        {e.id}
        <small>{hace(ahora, e.ultima.t)}</small>
      </span>
      {l ? (
        <>
          <span className="temperatura">
            {l.temperatura === undefined ? "Sin sonda" : grados(l.temperatura)}
            {l.consigna !== undefined && <small>Consigna {grados(l.consigna)}</small>}
          </span>
          <Curva puntos={e.temperaturas} />
          <span className="estados">
            {l.alarma && <span className="gx-chip error">Alarma</span>}
            {l.puerta && <span className="gx-chip aviso">Puerta abierta</span>}
            {l.desescarche && <span className="gx-chip azul">Desescarche</span>}
            {l.compresor !== undefined && <span className={`gx-chip ${l.compresor ? "correcto" : "neutro"}`}>{l.compresor ? "Compresor en marcha" : "Compresor parado"}</span>}
          </span>
        </>
      ) : (
        <span className="estados sin">
          <span className="gx-chip sindatos">No responde</span>
        </span>
      )}
    </li>
  );
}

export function LecturasReales() {
  const [datos, setDatos] = useState<ResumenLecturas | null>(null);
  const [fallo, setFallo] = useState(false);
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    let vivo = true;
    const pedir = async () => {
      try {
        const r = await fetch("/api/lecturas", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = (await r.json()) as ResumenLecturas;
        if (!vivo) return;
        setDatos(d);
        setFallo(false);
      } catch {
        if (vivo) setFallo(true);
      }
      if (vivo) setAhora(Date.now());
    };
    void pedir();
    const reloj = setInterval(pedir, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, []);

  const ultima = datos?.pasarelas.length ? Math.max(...datos.pasarelas.map((p) => p.ultima)) : null;
  const chip = !datos
    ? null
    : ultima !== null
      ? ahora - ultima < CALLADA_MS
        ? { clase: "correcto", texto: "Recibiendo" }
        : { clase: "aviso", texto: `Sin entregas ${hace(ahora, ultima).replace("hace", "desde hace")}` }
      : datos.abierta
        ? { clase: "azul", texto: "Esperando la primera pasarela" }
        : { clase: "neutro", texto: "Entrada cerrada" };

  return (
    <section className="gx-tarjeta gx-reales" aria-label="Lecturas reales">
      <div className="gx-fila">
        <div>
          <h2>Lecturas reales</h2>
          <p className="gx-sub">Lo que entregan las pasarelas conectadas a equipos</p>
        </div>
        {chip && <span className={`gx-chip ${chip.clase}`}>{chip.texto}</span>}
      </div>

      {!datos ? (
        <p className="gx-vacio">{fallo ? "No se han podido consultar las lecturas. Se vuelve a intentar solo." : "Consultando…"}</p>
      ) : datos.pasarelas.length === 0 ? (
        <p className="gx-vacio">
          {datos.abierta
            ? "Todavía no ha entregado ninguna pasarela. El primer paso es encender una con el programa de Gradiox: en cuanto entregue, sus equipos aparecen aquí."
            : "Todavía no puede entrar ninguna lectura. El primer paso es poner la clave de pasarelas en el servidor; después, encender una pasarela con el programa de Gradiox."}
        </p>
      ) : (
        datos.pasarelas.map((p) => (
          <div key={p.id} className="gx-reales-pasarela">
            <p className="gx-reales-titulo">
              <Router size={17} strokeWidth={1.6} aria-hidden="true" />
              <strong>{p.id}</strong>
              <span>Última entrega {hace(ahora, p.ultima)}</span>
            </p>
            <ul>
              {p.equipos.map((e) => (
                <Equipo key={e.id} e={e} ahora={ahora} />
              ))}
            </ul>
          </div>
        ))
      )}

      {datos && datos.guardado === "memoria" && datos.pasarelas.length > 0 && <p className="gx-nota">Guardadas en la memoria del servidor: se pierden si se reinicia. Con la base de datos conectada quedan guardadas.</p>}
      {datos && fallo && <p className="gx-nota">Sin respuesta del servidor en el último intento: se enseña lo último recibido.</p>}
    </section>
  );
}
