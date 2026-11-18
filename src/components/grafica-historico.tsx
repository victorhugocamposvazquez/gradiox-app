"use client";

import { useEffect, useRef, useState } from "react";
import { DIA, type Clase, type Tramo } from "@/historicos/modelo";

const cuando = (t: number, porDias: boolean) =>
  new Date(t).toLocaleString("es-ES", porDias ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Una variable a lo largo de un periodo. Los números van como línea de la
 * media con la franja entre mínima y máxima; los sí/no, como barras con la
 * parte de cada rato que estuvo en «sí». Encima, a trazos, el periodo anterior
 * puesto en las mismas fechas, y una raya por cada orden que se dio.
 */
export function GraficaHistorico({ clase, actual, anterior, desde, hasta, tramoMs, marcas, titulo, valor }: { clase: Clase; actual: Tramo[]; anterior: Tramo[]; desde: number; hasta: number; tramoMs: number; marcas: number[]; titulo: string; valor: (n: number) => string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [sobre, setSobre] = useState<number | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setW(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSobre(null), [actual]);

  const H = W < 480 ? 200 : 240;
  const M = { izq: 52, der: 10, arr: 14, aba: 24 };
  const largo = hasta - desde;
  const antes = anterior.map((p) => ({ ...p, t: p.t + largo }));
  const numero = clase === "numero";
  const valores = numero ? [...actual.flatMap((p) => [p.min as number, p.max as number]), ...antes.map((p) => p.media as number)] : [0, 1];
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (numero) {
    const aire = (max - min || Math.abs(max) * 0.1 || 1) * 0.08;
    min -= aire;
    max += aire;
  }
  const x = (t: number) => M.izq + ((t - desde) / largo) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + ((max - v) / (max - min)) * (H - M.arr - M.aba);
  const base = H - M.aba;

  // La línea se corta donde faltan lecturas.
  const trozos = (ps: Tramo[]) => {
    const out: Tramo[][] = [];
    ps.forEach((p, i) => (i && p.t - ps[i - 1].t <= tramoMs * 1.5 ? out[out.length - 1].push(p) : out.push([p])));
    return out;
  };
  const medio = tramoMs / 2;
  const linea = (ps: Tramo[], de: (p: Tramo) => number) => trozos(ps).map((t) => t.map((p, i) => `${i ? "L" : "M"}${x(p.t + medio).toFixed(1)},${y(de(p)).toFixed(1)}`).join("")).join("");
  const franja = trozos(actual)
    .filter((t) => t.length > 1)
    .map((t) => `M${t.map((p) => `${x(p.t + medio).toFixed(1)},${y(p.max as number).toFixed(1)}`).join("L")}L${[...t].reverse().map((p) => `${x(p.t + medio).toFixed(1)},${y(p.min as number).toFixed(1)}`).join("L")}Z`)
    .join("");
  const niveles = numero ? [min + (max - min) * 0.08, (min + max) / 2, max - (max - min) * 0.08] : [0, 0.5, 1];
  const porDias = largo > 2 * DIA;
  const cortes = (W < 480 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => desde + f * largo);
  const rotulo = (t: number) => (porDias ? new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));

  const mover = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!actual.length) return;
    const caja = ev.currentTarget.getBoundingClientRect();
    const t = desde + ((ev.clientX - caja.left - M.izq) / (W - M.izq - M.der)) * largo - medio;
    let mejor = 0;
    actual.forEach((p, i) => Math.abs(p.t - t) < Math.abs(actual[mejor].t - t) && (mejor = i));
    setSobre(mejor);
  };
  const p = sobre === null ? null : (actual[sobre] ?? null);
  const delAntes = p ? antes.find((a) => a.t === p.t) : undefined;
  const lectura = p
    ? numero
      ? `${cuando(p.t, tramoMs >= DIA)} · media ${valor(p.media as number)}, entre ${valor(p.min as number)} y ${valor(p.max as number)}${delAntes ? ` · periodo anterior ${valor(delAntes.media as number)}` : ""}`
      : `${cuando(p.t, tramoMs >= DIA)} · en «sí» el ${Math.round((p.activa ?? 0) * 100)} % del rato${p.arranques ? `, ${p.arranques} ${p.arranques === 1 ? "vez" : "veces"}` : ""}${delAntes ? ` · periodo anterior ${Math.round((delAntes.activa ?? 0) * 100)} %` : ""}`
    : "Pasa el dedo o el ratón por la gráfica para ver cada rato";

  return (
    <div ref={caja} className="gx-his-grafica">
      <svg className="gx-grafica" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo} onPointerMove={mover} onPointerDown={mover}>
        {niveles.map((n) => (
          <g key={n}>
            <line x1={M.izq} x2={W - M.der} y1={y(n)} y2={y(n)} stroke="var(--gx-linea)" />
            <text x={M.izq - 8} y={y(n) + 4} textAnchor="end" fontSize="12" fill="var(--gx-gris)">{numero ? valor(n) : `${Math.round(n * 100)} %`}</text>
          </g>
        ))}
        {numero ? (
          <>
            {franja && <path d={franja} fill="var(--gx-azul)" opacity="0.18" />}
            <path d={linea(antes, (q) => q.media as number)} fill="none" stroke="var(--gx-gris)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d={linea(actual, (q) => q.media as number)} fill="none" stroke="var(--gx-azul)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {actual.length === 1 && <circle cx={x(actual[0].t + medio)} cy={y(actual[0].media as number)} r="3" fill="var(--gx-azul)" />}
          </>
        ) : (
          <>
            {actual.map((q) => (
              <rect key={q.t} x={x(q.t) + 0.5} y={y(q.activa ?? 0)} width={Math.max(1, x(q.t + tramoMs) - x(q.t) - 1)} height={Math.max(0, base - y(q.activa ?? 0))} fill="var(--gx-azul)" opacity="0.75" rx="1" />
            ))}
            <path d={linea(antes, (q) => q.activa ?? 0)} fill="none" stroke="var(--gx-gris)" strokeWidth="1.5" strokeDasharray="4 4" />
          </>
        )}
        {marcas.filter((t) => t >= desde && t < hasta).map((t, i) => (
          <g key={`${t}-${i}`}>
            <line x1={x(t)} x2={x(t)} y1={M.arr} y2={base} stroke="var(--gx-aviso)" strokeWidth="1.5" />
            <path d={`M${x(t) - 4},${M.arr - 6}h8l-4,6z`} fill="var(--gx-aviso)" />
          </g>
        ))}
        {p && <line x1={x(p.t + medio)} x2={x(p.t + medio)} y1={M.arr} y2={base} stroke="var(--gx-tinta)" strokeWidth="1" opacity="0.45" />}
        {cortes.map((t, i) => (
          <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === cortes.length - 1 ? "end" : "middle"} fontSize="12" fill="var(--gx-gris)">{rotulo(t)}</text>
        ))}
      </svg>
      <p className="gx-his-lectura">{lectura}</p>
      <ul className="gx-his-leyenda" aria-hidden="true">
        <li><i className="ahora" />Este periodo</li>
        <li><i className="antes" />Periodo anterior</li>
        {numero && <li><i className="franja" />Entre mínima y máxima</li>}
        {marcas.length > 0 && <li><i className="orden" />Orden dada</li>}
      </ul>
    </div>
  );
}
