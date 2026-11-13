"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Marca } from "@/components/marca";
import { registroDiario, resumenPeriodo } from "@/lib/analisis";
import { EQUIPOS } from "@/lib/equipos";
import { dia, duracion, grados, hora } from "@/lib/formato";
import { NAVES } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, eventos } from "@/lib/datos";
import { llegaBien } from "@/lib/recepcion";
import { useDemo } from "@/lib/store";

const DIAS = 30;
const DIA_MS = 86_400_000;
const porciento = (n: number | null) => (n === null ? "Sin datos" : `${(Math.floor(n * 1000) / 10).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);
const fechaCorta = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const enlaces = [PASARELA, ...AUTOMATAS];

export default function InformeMensual() {
  const { ahora, ajustes, registro, cortesPasados, recepciones, trabajos } = useDemo();
  const [autor, setAutor] = useState("");
  // Se recalcula una vez por hora: son treinta días de lecturas.
  const franja = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const datos = useMemo(() => {
    if (franja === null) return null;
    const t = franja * 3_600_000;
    const sucesos = eventos(t, ajustes, DIAS * 24);
    return {
      t,
      desde: t - DIAS * DIA_MS,
      filas: CAMARAS.map((c) => ({ c, r: resumenPeriodo(registroDiario(c, t, ajustes, DIAS)), alarmas: sucesos.filter((e) => e.camaraId === c.id && e.estado === "error").length })),
    };
  }, [franja, ajustes]);
  if (ahora === null || !datos) return <p className="gx-sub">Preparando el informe: son treinta días de lecturas…</p>;

  const total = resumenPeriodo(datos.filas.map(({ r }) => ({ fecha: "", min: r.min, max: r.max, media: r.media, minutosFuera: r.minutosFuera, minutosSinDatos: r.minutosSinDatos, lecturas: r.minutosConDatos / 15 })));
  const alarmas = datos.filas.reduce((a, f) => a + f.alarmas, 0);
  const desdeIso = new Date(datos.desde).toISOString().slice(0, 10);
  const intervenciones = registro.filter((r) => r.fecha >= desdeIso).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const abiertas = trabajos.filter((o) => !o.cerrada).length;
  const cortes = cortesPasados.filter((c) => c.hasta >= datos.desde);
  const tiempoCortes = cortes.reduce((a, c) => a + (c.hasta - Math.max(c.desde, datos.desde)), 0);
  const entradas = recepciones.filter((r) => r.cuando >= datos.desde);
  const entradasAltas = entradas.filter((r) => {
    const c = CAMARAS.find((x) => x.id === r.camaraId);
    return c ? !llegaBien(r.temp, c.limite) : false;
  }).length;

  return (
    <>
      <Link href="/informe" className="gx-volver gx-no-imprimir">
        <ArrowLeft size={18} aria-hidden="true" /> Informe del día
      </Link>
      <header className="gx-cabecera">
        <div>
          <div className="gx-solo-papel"><Marca size={24} /></div>
          <h1>Informe mensual</h1>
          <p className="gx-sub">{NAVES[0].nombre} · del {fechaCorta(datos.desde)} al {fechaCorta(datos.t)} · sacado a las {hora(ahora)}</p>
        </div>
        <button type="button" className="gx-boton gx-no-imprimir" onClick={() => window.print()}>
          <Printer size={18} strokeWidth={1.7} aria-hidden="true" /> Imprimir o guardar en PDF
        </button>
      </header>

      <div className="gx-pila">
        <div className="gx-cifras">
          <div><span>Tiempo dentro del límite</span><strong>{porciento(total.dentro)}</strong></div>
          <div className={alarmas ? "mal" : undefined}><span>Alarmas</span><strong>{alarmas}</strong></div>
          <div className={total.minutosSinDatos ? "mal" : undefined}><span>Tiempo sin datos</span><strong>{total.minutosSinDatos ? duracion(total.minutosSinDatos * 60_000) : "Nada"}</strong></div>
          <div><span>Intervenciones apuntadas</span><strong>{intervenciones.length}</strong></div>
        </div>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <h2>Servicio a servicio</h2>
          <div className="gx-desliza">
            <table className="gx-tabla">
              <thead>
                <tr>
                  <th scope="col">Servicio</th>
                  <th scope="col">Dentro del límite</th>
                  <th scope="col">Mínima</th>
                  <th scope="col">Máxima</th>
                  <th scope="col">Media</th>
                  <th scope="col">Límite</th>
                  <th scope="col">Sobre el límite</th>
                  <th scope="col">Sin datos</th>
                  <th scope="col">Alarmas</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map(({ c, r, alarmas: n }) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{porciento(r.dentro)}</td>
                    <td>{r.min === null ? "Sin datos" : grados(r.min)}</td>
                    <td>{r.max === null ? "Sin datos" : grados(r.max)}</td>
                    <td>{r.media === null ? "Sin datos" : grados(r.media)}</td>
                    <td>{grados(c.limite)}</td>
                    <td className={r.minutosFuera ? "fuera" : undefined}>{r.minutosFuera ? duracion(r.minutosFuera * 60_000) : "Nada"}</td>
                    <td>{r.minutosSinDatos ? duracion(r.minutosSinDatos * 60_000) : "Nada"}</td>
                    <td>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gx-nota">Una lectura cada 15 minutos durante {DIAS} días. «Dentro del límite» cuenta solo el tiempo con datos.</p>
        </section>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Intervenciones del periodo</h2>
            {intervenciones.length === 0 ? (
              <p className="gx-vacio">Ninguna apuntada en estos {DIAS} días.</p>
            ) : (
              <ul className="gx-lista">
                {intervenciones.slice(0, 20).map((r) => (
                  <li key={r.id}><span>{r.tipo} · {EQUIPOS.find((e) => e.id === r.equipoId)?.nombre ?? r.equipoId}<small>{dia(r.fecha)}{r.tecnico ? ` · ${r.tecnico}` : ""}{r.nota ? ` · ${r.nota}` : ""}</small></span></li>
                ))}
              </ul>
            )}
            {intervenciones.length > 20 && <p className="gx-nota">Y {intervenciones.length - 20} más en el libro de mantenimiento.</p>}
          </section>
          <section className="gx-tarjeta">
            <h2>Lo demás del periodo</h2>
            <ul className="gx-lista">
              <li><span>Órdenes de trabajo<small>{abiertas ? `${abiertas} ${abiertas === 1 ? "sigue abierta" : "siguen abiertas"}.` : "Ninguna abierta."}</small></span></li>
              <li><span>Cortes de conexión<small>{cortes.length ? `${cortes.length} ${cortes.length === 1 ? "corte" : "cortes"}, ${duracion(tiempoCortes)} en total (${[...new Set(cortes.map((c) => enlaces.find((e) => e.id === c.equipoId)?.nombre ?? c.equipoId))].join(", ")}).` : "Ninguno apuntado."} Solo constan los vistos desde este dispositivo.</small></span></li>
              <li><span>Entradas de mercancía<small>{entradas.length ? `${entradas.length} ${entradas.length === 1 ? "apuntada" : "apuntadas"}, ${entradasAltas} por encima del límite.` : "Ninguna apuntada."}</small></span></li>
              <li><span>Luz<small>El gasto del mes no sale todavía en este informe: hoy solo se estima el del día.</small></span></li>
            </ul>
          </section>
        </div>

        <section className="gx-tarjeta gx-firma">
          <label className="gx-campo">Quién saca el informe
            <input type="text" value={autor} onChange={(ev) => setAutor(ev.target.value)} maxLength={60} autoComplete="off" placeholder="Nombre y cargo" />
          </label>
          <div className="gx-solo-papel">
            <p>Firma:</p>
          </div>
        </section>

        <p className="gx-nota">Informe de una demostración con datos simulados. No sustituye al registro oficial de temperaturas.</p>
      </div>
    </>
  );
}
