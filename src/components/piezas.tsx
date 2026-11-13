"use client";

import { AlertTriangle, Check, DoorClosed, DoorOpen, Fan, Snowflake, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Historia, MarcaGrafica, Punto, TipoMarca } from "@/lib/analisis";
import type { Estado, Lectura } from "@/lib/datos";

export function ChipEstado({ estado, texto }: { estado: Estado; texto: string }) {
  const Icono = estado === "correcto" ? Check : estado === "aviso" ? AlertTriangle : estado === "sindatos" ? WifiOff : X;
  return (
    <span className={`gx-chip ${estado}`}>
      <Icono size={16} strokeWidth={2.4} aria-hidden="true" />
      {texto}
    </span>
  );
}

const COLOR_MARCA: Record<TipoMarca, string> = { desescarche: "var(--gx-azul)", puerta: "var(--gx-aviso)", alarma: "var(--gx-error)", sindatos: "var(--gx-gris)" };

/**
 * Temperatura de un periodo, con la consigna y el límite marcados. Debajo de
 * la línea, una franja por cada cosa que pasó: desescarches, puertas, alarmas
 * y ratos sin datos. En periodos largos la sombra es la mínima y la máxima.
 */
export function Grafica({ historia, limite, titulo }: { historia: Historia; limite: number; titulo: string }) {
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
  const { puntos, marcas, desde, hasta } = historia;
  const H = 264;
  const CARRIL = 24;
  const M = { izq: 44, der: 12, arr: 12, aba: 26 + CARRIL };
  const vivos = puntos.filter((p) => p.temp !== null);
  const min = Math.floor(Math.min(...vivos.map((p) => p.min as number), ...puntos.map((p) => p.consigna)) - 1);
  const max = Math.ceil(Math.max(...vivos.map((p) => p.max as number), limite) + 1);
  const x = (t: number) => M.izq + ((t - desde) / Math.max(1, hasta - desde)) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + ((max - v) / (max - min)) * (H - M.arr - M.aba);
  // La línea se corta donde no hay datos.
  let trazo = "";
  let previo = false;
  for (const p of puntos) {
    if (p.temp === null) previo = false;
    else {
      trazo += `${previo ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.temp).toFixed(1)}`;
      previo = true;
    }
  }
  const tramos: Punto[][] = [];
  for (const p of puntos) {
    if (p.temp === null) tramos.push([]);
    else (tramos[tramos.length - 1] ?? tramos[tramos.push([]) - 1]).push(p);
  }
  const conSombra = puntos.some((p) => p.min !== null && p.max !== null && p.max - p.min > 0.05);
  const sombra = conSombra
    ? tramos.filter((t) => t.length > 1).map((t) => `M${t.map((p) => `${x(p.t).toFixed(1)},${y(p.max as number).toFixed(1)}`).join("L")}L${[...t].reverse().map((p) => `${x(p.t).toFixed(1)},${y(p.min as number).toFixed(1)}`).join("L")}Z`).join("")
    : "";
  const consigna = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.consigna).toFixed(1)}`).join("");
  const niveles = [min, Math.round((min + max) / 2), max];
  const largo = hasta - desde > 26 * 3_600_000;
  const cortes = (W < 480 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => desde + f * (hasta - desde));
  const rotulo = (t: number) => (largo ? new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  const ultimo = vivos[vivos.length - 1]?.temp;
  const base = H - M.aba;
  const ancho = (m: MarcaGrafica) => Math.max(2, x(m.hasta) - x(m.desde));
  return (
    <div ref={caja}>
    <svg className="gx-grafica" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperatura. ${titulo}. ${ultimo === undefined ? "Sin datos" : `Última lectura ${ultimo} grados`}, límite ${limite} grados.`}>
      {marcas.filter((m) => m.tipo === "sindatos").map((m) => (
        <rect key={`s${m.desde}`} x={x(m.desde)} y={M.arr} width={ancho(m)} height={base - M.arr} fill="var(--gx-gris)" opacity="0.14" />
      ))}
      {niveles.map((m) => (
        <g key={m}>
          <line x1={M.izq} x2={W - M.der} y1={y(m)} y2={y(m)} stroke="var(--gx-linea)" />
          <text x={M.izq - 8} y={y(m) + 4} textAnchor="end" fontSize="13" fill="var(--gx-gris)">{m}°</text>
        </g>
      ))}
      <line x1={M.izq} x2={W - M.der} y1={y(limite)} y2={y(limite)} stroke="var(--gx-error)" strokeWidth="1.5" strokeDasharray="6 5" />
      <text x={W - M.der} y={y(limite) - 6} textAnchor="end" fontSize="13" fill="var(--gx-error)">Límite {limite}°</text>
      <path d={consigna} fill="none" stroke="var(--gx-gris)" strokeWidth="1.5" strokeDasharray="2 4" />
      {sombra && <path d={sombra} fill="var(--gx-azul)" opacity="0.2" />}
      <path d={trazo} fill="none" stroke="var(--gx-azul)" strokeWidth={conSombra ? 2 : 2.5} strokeLinejoin="round" />
      {(["desescarche", "puerta", "alarma"] as const).map((tipo, fila) =>
        marcas.filter((m) => m.tipo === tipo).map((m) => (
          <rect key={`${tipo}${m.desde}`} x={x(m.desde)} y={base + 4 + fila * 6} width={ancho(m)} height={4} rx={1} fill={COLOR_MARCA[tipo]} />
        )),
      )}
      {cortes.map((t, i) => (
        <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === cortes.length - 1 ? "end" : "middle"} fontSize="13" fill="var(--gx-gris)">
          {rotulo(t)}
        </text>
      ))}
    </svg>
    </div>
  );
}

/** Cómo se distingue cada línea al comparar: por color y por trazo, para no depender solo del color. */
export const TRAZOS = [
  { color: "var(--gx-azul)", raya: undefined },
  { color: "var(--gx-aviso)", raya: "7 4" },
  { color: "var(--gx-correcto)", raya: "2 4" },
] as const;

export const MuestraTrazo = ({ i }: { i: number }) => (
  <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
    <line x1="1" x2="27" y1="5" y2="5" stroke={TRAZOS[i].color} strokeWidth="2.5" strokeDasharray={TRAZOS[i].raya} strokeLinecap="round" />
  </svg>
);

/** Varias temperaturas en el mismo eje, para ver si un problema es de un servicio o de todos. */
export function GraficaComparada({ series, titulo }: { series: { nombre: string; historia: Historia }[]; titulo: string }) {
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
  if (!series.length) return null;
  const H = 280;
  const M = { izq: 44, der: 12, arr: 12, aba: 26 };
  const { desde, hasta } = series[0].historia;
  const todas = series.flatMap((s) => s.historia.puntos.map((p) => p.temp)).filter((v): v is number => v !== null);
  const min = Math.floor(Math.min(...todas) - 1);
  const max = Math.ceil(Math.max(...todas) + 1);
  const x = (t: number) => M.izq + ((t - desde) / Math.max(1, hasta - desde)) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + ((max - v) / (max - min)) * (H - M.arr - M.aba);
  const trazo = (puntos: Punto[]) => {
    let d = "";
    let previo = false;
    for (const p of puntos) {
      if (p.temp === null) previo = false;
      else {
        d += `${previo ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.temp).toFixed(1)}`;
        previo = true;
      }
    }
    return d;
  };
  const paso = Math.max(1, Math.ceil((max - min) / 5));
  const niveles: number[] = [];
  for (let v = min; v <= max; v += paso) niveles.push(v);
  const largo = hasta - desde > 26 * 3_600_000;
  const cortes = (W < 480 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => desde + f * (hasta - desde));
  const rotulo = (t: number) => (largo ? new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  return (
    <div ref={caja}>
      <svg className="gx-grafica" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperatura de ${series.map((s) => s.nombre).join(", ")}. ${titulo}.`}>
        {niveles.map((m) => (
          <g key={m}>
            <line x1={M.izq} x2={W - M.der} y1={y(m)} y2={y(m)} stroke="var(--gx-linea)" />
            <text x={M.izq - 8} y={y(m) + 4} textAnchor="end" fontSize="13" fill="var(--gx-gris)">{m}°</text>
          </g>
        ))}
        {series.map((s, i) => (
          <path key={s.nombre} d={trazo(s.historia.puntos)} fill="none" stroke={TRAZOS[i].color} strokeWidth="2" strokeDasharray={TRAZOS[i].raya} strokeLinejoin="round" />
        ))}
        {cortes.map((t, i) => (
          <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === cortes.length - 1 ? "end" : "middle"} fontSize="13" fill="var(--gx-gris)">
            {rotulo(t)}
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
  const color = estado === "error" ? "var(--gx-error)" : estado === "aviso" ? "var(--gx-aviso)" : estado === "sindatos" ? "#8a9bab" : "var(--gx-azul)";
  return (
    <svg className="gx-chispa" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1="0" x2={W} y1={y(limite)} y2={y(limite)} stroke="var(--gx-error)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
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
  const pie = estado === "sindatos" ? "Última lectura" : margen > 0 ? `A ${margen.toString().replace(".", ",")} °C del límite` : "Por encima del límite";
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
export function Senales({ lectura, corto = false, sinCompresor = false, sinPuerta = false }: { lectura: Lectura; corto?: boolean; sinCompresor?: boolean; sinPuerta?: boolean }) {
  if (lectura.estado === "sindatos")
    return (
      <span className="gx-senales" role="img" aria-label="Sin datos del compresor ni de la puerta">
        <span className="apagado">
          <WifiOff size={17} strokeWidth={1.6} aria-hidden="true" />
          {!corto && "Sin señal"}
        </span>
      </span>
    );
  const { compresor, puerta, desescarche } = lectura;
  const Puerta = puerta ? DoorOpen : DoorClosed;
  const textos = [sinCompresor ? "Frío de la central" : compresor ? "Compresor en marcha" : "Compresor parado", sinPuerta ? "" : puerta ? `Puerta abierta ${lectura.puertaMin} min` : "Puerta cerrada", desescarche ? "En desescarche" : ""].filter(Boolean);
  return (
    <span className="gx-senales" role="img" aria-label={textos.join(". ")} title={corto ? textos.join(" · ") : undefined}>
      {sinCompresor ? (
        <span className="apagado">
          <Snowflake size={17} strokeWidth={1.6} aria-hidden="true" />
          {!corto && "De la central"}
        </span>
      ) : (
        <span className={compresor ? "activo" : "apagado"}>
          <Fan size={17} strokeWidth={1.6} className={compresor ? "gx-gira" : undefined} aria-hidden="true" />
          {!corto && (compresor ? "Enfriando" : "Parado")}
        </span>
      )}
      {!sinPuerta && (
        <span className={puerta ? "alerta" : "apagado"}>
          <Puerta size={17} strokeWidth={1.6} aria-hidden="true" />
          {!corto && (puerta ? `Abierta ${lectura.puertaMin} min` : "Cerrada")}
        </span>
      )}
      {desescarche && (
        <span className="activo">
          <Snowflake size={17} strokeWidth={1.6} aria-hidden="true" />
          {!corto && "Desescarche"}
        </span>
      )}
    </span>
  );
}
