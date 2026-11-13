"use client";

import { AlertTriangle, Check, DoorClosed, DoorOpen, Fan, Snowflake, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Estado, Lectura } from "@/lib/sim";

export function ChipEstado({ estado, texto }: { estado: Estado; texto: string }) {
  const Icono = estado === "correcto" ? Check : estado === "aviso" ? AlertTriangle : X;
  return (
    <span className={`gx-chip ${estado}`}>
      <Icono size={16} strokeWidth={2.4} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** Temperatura de las últimas horas, con la consigna y el límite marcados. */
export function Grafica({ lecturas, limite }: { lecturas: Lectura[]; limite: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setW(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 240;
  const M = { izq: 44, der: 12, arr: 12, aba: 26 };
  const temps = lecturas.map((l) => l.temp);
  const consignas = lecturas.map((l) => l.consigna);
  const min = Math.floor(Math.min(...temps, ...consignas) - 1);
  const max = Math.ceil(Math.max(...temps, limite) + 1);
  const x = (i: number) => M.izq + (i / Math.max(1, lecturas.length - 1)) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + ((max - v) / (max - min)) * (H - M.arr - M.aba);
  const linea = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marcas = [min, Math.round((min + max) / 2), max];
  const horas = (W < 480 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => lecturas[Math.round(f * (lecturas.length - 1))]).filter(Boolean);
  const ultima = temps[temps.length - 1];
  return (
    <div ref={caja}>
    <svg className="gx-grafica" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperatura de las últimas 24 horas. Ahora ${ultima} grados, límite ${limite} grados.`}>
      {marcas.map((m) => (
        <g key={m}>
          <line x1={M.izq} x2={W - M.der} y1={y(m)} y2={y(m)} stroke="#d3dde5" />
          <text x={M.izq - 8} y={y(m) + 4} textAnchor="end" fontSize="13" fill="#48607a">{m}°</text>
        </g>
      ))}
      <line x1={M.izq} x2={W - M.der} y1={y(limite)} y2={y(limite)} stroke="#a61b12" strokeWidth="1.5" strokeDasharray="6 5" />
      <text x={W - M.der} y={y(limite) - 6} textAnchor="end" fontSize="13" fill="#a61b12">Límite {limite}°</text>
      <path d={linea(consignas)} fill="none" stroke="#48607a" strokeWidth="1.5" strokeDasharray="2 4" />
      <path d={linea(temps)} fill="none" stroke="#1257c9" strokeWidth="2.5" strokeLinejoin="round" />
      {horas.map((l, i) => (
        <text key={i} x={x(Math.round((i / (horas.length - 1)) * (lecturas.length - 1)))} y={H - 6} textAnchor={i === 0 ? "start" : i === horas.length - 1 ? "end" : "middle"} fontSize="13" fill="#48607a">
          {new Date(l.t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </text>
      ))}
    </svg>
    </div>
  );
}

export function BarrasPrecio({ precios, baratas, caras, horaActual, baja = false }: { precios: number[]; baratas: number[]; caras: number[]; horaActual: number; baja?: boolean }) {
  const tope = Math.max(...precios);
  return (
    <div>
      <div className={`gx-barras${baja ? " baja" : ""}`} role="img" aria-label={`Precio simulado por horas. Horas baratas: ${baratas.join(", ")}. Horas caras: ${caras.join(", ")}.`}>
        {precios.map((p, h) => (
          <div
            key={h}
            className={`${baratas.includes(h) ? "barata" : caras.includes(h) ? "cara" : ""}${h === horaActual ? " ahora" : ""}`}
            style={{ height: `${Math.max(6, (p / tope) * 100)}%` }}
            title={`${h}:00 · ${p} €/MWh`}
          />
        ))}
      </div>
      <div className="gx-eje" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

/** Trazo pequeño de la última hora. La raya roja es el límite del género. */
export function Chispa({ valores, limite, estado }: { valores: number[]; limite: number; estado: Estado }) {
  const W = 96;
  const H = 32;
  const min = Math.min(...valores) - 0.5;
  const max = Math.max(...valores, limite) + 0.5;
  const x = (i: number) => (i / Math.max(1, valores.length - 1)) * W;
  const y = (v: number) => 4 + ((max - v) / (max - min)) * (H - 8);
  const color = estado === "error" ? "#a61b12" : estado === "aviso" ? "#8a5a00" : "#1257c9";
  return (
    <svg className="gx-chispa" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1="0" x2={W} y1={y(limite)} y2={y(limite)} stroke="#a61b12" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <path d={valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle className="gx-chispa-punta" cx={x(valores.length - 1) - 3} cy={y(valores[valores.length - 1])} r="3" fill={color} />
    </svg>
  );
}

/** Temperatura con el grado dibujado como el anillo azul del logotipo. Parpadea un instante cuando cambia. */
export function Temp({ valor, className }: { valor: number; className?: string }) {
  const texto = `${valor < 0 ? "−" : ""}${Math.abs(valor).toFixed(1).replace(".", ",")}`;
  return (
    <span className={`gx-lectura${className ? ` ${className}` : ""}`} role="text" aria-label={`${texto} grados`}>
      <span key={texto} className="gx-cambia" aria-hidden="true">{texto}</span>
      <i className="gx-grado" aria-hidden="true" />
    </span>
  );
}

/**
 * Dónde está la temperatura entre la consigna y el límite del género. La
 * franja del final son los tres últimos grados antes del límite.
 */
export function Medidor({ temp, consigna, limite, estado }: { temp: number; consigna: number; limite: number; estado: Estado }) {
  const min = consigna - 2;
  const en = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (limite - min)) * 100)).toFixed(1)}%`;
  const margen = Math.round((limite - temp) * 10) / 10;
  const pie = margen > 0 ? `A ${margen.toString().replace(".", ",")} °C del límite` : "Por encima del límite";
  return (
    <div className="gx-medidor" role="img" aria-label={`${pie}. Consigna ${consigna} grados, límite ${limite} grados.`}>
      <div className="pista">
        <i className="riesgo" style={{ left: en(limite - 3) }} />
        <i className="consigna" style={{ left: en(consigna) }} />
        <i className={`marca ${estado}`} style={{ left: en(temp) }} />
      </div>
      <div className="pie">
        <span>Consigna</span>
        <span>{pie}</span>
      </div>
    </div>
  );
}

/** Compresor, puerta y desescarche de un vistazo. Con `corto` solo salen los iconos. */
export function Senales({ lectura, corto = false }: { lectura: Lectura; corto?: boolean }) {
  const { compresor, puerta, desescarche } = lectura;
  const Puerta = puerta ? DoorOpen : DoorClosed;
  const textos = [compresor ? "Compresor en marcha" : "Compresor parado", puerta ? `Puerta abierta ${lectura.puertaMin} min` : "Puerta cerrada", desescarche ? "En desescarche" : ""].filter(Boolean);
  return (
    <span className="gx-senales" role="img" aria-label={textos.join(". ")} title={corto ? textos.join(" · ") : undefined}>
      <span className={compresor ? "activo" : "apagado"}>
        <Fan size={17} strokeWidth={1.6} className={compresor ? "gx-gira" : undefined} aria-hidden="true" />
        {!corto && (compresor ? "Enfriando" : "Parado")}
      </span>
      <span className={puerta ? "alerta" : "apagado"}>
        <Puerta size={17} strokeWidth={1.6} aria-hidden="true" />
        {!corto && (puerta ? `Abierta ${lectura.puertaMin} min` : "Cerrada")}
      </span>
      {desescarche && (
        <span className="activo">
          <Snowflake size={17} strokeWidth={1.6} aria-hidden="true" />
          {!corto && "Desescarche"}
        </span>
      )}
    </span>
  );
}
