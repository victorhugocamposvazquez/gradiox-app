"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { registroCsv, registroDiario } from "@/lib/analisis";
import { duracion, grados, gradosC, hora } from "@/lib/formato";
import { CAMARAS } from "@/lib/datos";
import { useDemo } from "@/lib/store";

const DIAS = 7;
const diaLargo = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export default function Registro() {
  const { ahora, ajustes } = useDemo();
  const [id, setId] = useState(CAMARAS[0].id);
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("camara");
    if (pedida && CAMARAS.some((c) => c.id === pedida)) setId(pedida);
  }, []);
  const camara = CAMARAS.find((c) => c.id === id) ?? CAMARAS[0];
  const cuarto = ahora === null ? null : Math.floor(ahora / 900_000);
  const dias = useMemo(() => (cuarto === null ? [] : registroDiario(camara, cuarto * 900_000, ajustes, DIAS)), [camara, cuarto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Preparando el registro…</p>;

  const fuera = dias.reduce((a, d) => a + d.minutosFuera, 0);
  const descargar = () => {
    const csv = registroCsv(camara, ahora, ajustes, DIAS);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradiox-${camara.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}-${dias[0]?.fecha ?? "registro"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Link href="/servicios" className="gx-volver gx-no-imprimir">
        <ArrowLeft size={18} aria-hidden="true" /> Servicios
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Registro de temperaturas</h1>
          <p className="gx-sub">{camara.nombre} · últimos {DIAS} días · el género no debe pasar de {gradosC(camara.limite)}</p>
        </div>
        <div className="gx-acciones gx-no-imprimir" style={{ marginTop: 0 }}>
          <button type="button" className="gx-boton" onClick={descargar}>
            <Download size={18} aria-hidden="true" /> Descargar
          </button>
          <button type="button" className="gx-boton secundario" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" /> Imprimir
          </button>
        </div>
      </header>

      <div className="gx-pila">
        <div className="gx-pestanas gx-no-imprimir" role="group" aria-label="Servicio">
          {CAMARAS.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === camara.id} onClick={() => setId(c.id)}>{c.nombre}</button>
          ))}
        </div>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <h2>Resumen por días</h2>
            <span className={`gx-chip ${fuera ? "error" : "correcto"}`}>{fuera ? `${duracion(fuera * 60_000)} por encima del límite` : "Siempre por debajo del límite"}</span>
          </div>
          <table className="gx-tabla">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Mínima</th>
                <th scope="col">Máxima</th>
                <th scope="col">Media</th>
                <th scope="col">Sobre el límite</th>
                <th scope="col">Sin datos</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <tr key={d.fecha}>
                  <td>{i === 0 ? "Hoy" : diaLargo(d.fecha)}</td>
                  <td>{d.min === null ? "Sin datos" : grados(d.min)}</td>
                  <td>{d.max === null ? "Sin datos" : grados(d.max)}</td>
                  <td>{d.media === null ? "Sin datos" : grados(d.media)}</td>
                  <td className={d.minutosFuera ? "fuera" : undefined}>{d.minutosFuera ? duracion(d.minutosFuera * 60_000) : "Nada"}</td>
                  <td>{d.minutosSinDatos ? duracion(d.minutosSinDatos * 60_000) : "Nada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="gx-nota">Una lectura cada 15 minutos. La descarga trae todas las lecturas, con fecha y hora, para abrirlas en una hoja de cálculo. Sacado a las {hora(ahora)}.</p>
          <p className="gx-nota">Datos simulados. Con una instalación conectada, este registro serviría de apoyo al control de temperaturas del autocontrol; no sustituye al registrador que exija la inspección.</p>
        </section>
      </div>
    </>
  );
}
