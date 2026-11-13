"use client";

import Link from "next/link";
import { Download, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ChipEstado } from "@/components/piezas";
import { gradosC, hora } from "@/lib/formato";
import { CAMARAS, rotulo } from "@/lib/datos";
import { leerTemperatura, llegaBien, recepcionesCsv } from "@/lib/recepcion";
import { useDemo } from "@/lib/store";

const servicio = (id: string) => CAMARAS.find((c) => c.id === id);
const fecha = (t: number) => new Date(t).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export default function Recepcion() {
  const { recepciones, apuntarRecepcion, borrarRecepcion } = useDemo();
  const [destino, setDestino] = useState(CAMARAS[0].id);
  const [fallo, setFallo] = useState("");
  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("servicio");
    if (pedido && servicio(pedido)) setDestino(pedido);
  }, []);
  const elegido = servicio(destino) ?? CAMARAS[0];

  const guardar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const datos = new FormData(ev.currentTarget);
    const temp = leerTemperatura(String(datos.get("temp") ?? ""));
    if (temp === null) {
      setFallo("Escribe la temperatura en grados, por ejemplo −18,5 o 3.");
      return;
    }
    setFallo("");
    apuntarRecepcion({ camaraId: elegido.id, producto: String(datos.get("producto") ?? "").trim(), proveedor: String(datos.get("proveedor") ?? "").trim(), temp, nota: String(datos.get("nota") ?? "").trim() });
    ev.currentTarget.reset();
  };

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([`﻿${recepcionesCsv(recepciones, servicio)}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gradiox-recepciones.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <Link href="/turno" className="gx-volver">Turno</Link>
          <h1>Recepción de mercancía</h1>
          <p className="gx-sub">A qué temperatura llega el género y dónde entra</p>
        </div>
        {recepciones.length > 0 && (
          <button type="button" className="gx-boton secundario" onClick={descargar}>
            <Download size={18} strokeWidth={1.6} aria-hidden="true" /> Descargar
          </button>
        )}
      </header>

      <div className="gx-dos igual">
        <form className="gx-tarjeta gx-pila gx-form" onSubmit={guardar}>
          <h2>Apuntar una entrada</h2>
          <div className="gx-formulario">
            <label className="gx-campo ancho">Qué llega
              <input type="text" name="producto" required maxLength={80} autoComplete="off" placeholder="Pescado congelado, lácteos…" />
            </label>
            <label className="gx-campo">Temperatura medida (°C)
              <input type="text" name="temp" required maxLength={6} autoComplete="off" placeholder="−18,5" aria-invalid={fallo ? true : undefined} aria-describedby={fallo ? "fallo-temp" : undefined} />
            </label>
            <label className="gx-campo">Entra en
              <select name="destino" aria-label="Entra en" value={destino} onChange={(ev) => setDestino(ev.target.value)}>
                {CAMARAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            {fallo && <p id="fallo-temp" role="alert" className="gx-nota ancho" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
            <label className="gx-campo ancho">Proveedor o matrícula
              <input type="text" name="proveedor" maxLength={60} autoComplete="off" />
            </label>
            <label className="gx-campo ancho">Nota
              <input type="text" name="nota" maxLength={160} autoComplete="off" placeholder="Cajas mojadas, se rechaza un palé…" />
            </label>
          </div>
          <p className="gx-nota">{elegido.nombre} es de {rotulo(elegido).toLowerCase()}: el género no debe pasar de {gradosC(elegido.limite)}.</p>
          <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
            <button type="submit" className="gx-boton">Apuntar la entrada</button>
          </div>
        </form>

        <section className="gx-tarjeta">
          <h2>Entradas apuntadas</h2>
          {recepciones.length === 0 ? (
            <p className="gx-vacio">Aún no hay ninguna. Cuando llegue el próximo camión, mide el género y apúntalo aquí: así se sabe por qué subió una cámara.</p>
          ) : (
            <ul className="gx-lista gx-entradas">
              {recepciones.slice(0, 30).map((r) => {
                const s = servicio(r.camaraId);
                const bien = s ? llegaBien(r.temp, s.limite) : true;
                return (
                  <li key={r.id}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{r.producto}</strong> · {gradosC(r.temp)}
                      <small>{fecha(r.cuando)}, {hora(r.cuando)} · entra en {s ? <Link href={`/servicios/${s.id}`} className="gx-enlace">{s.nombre}</Link> : r.camaraId}{r.proveedor ? ` · ${r.proveedor}` : ""}</small>
                      {r.nota && <small>{r.nota}</small>}
                      <span style={{ marginTop: 6, display: "block" }}>
                        <ChipEstado estado={bien ? "correcto" : "error"} texto={bien ? "Dentro del límite" : `Por encima del límite de ${s ? gradosC(s.limite) : ""}`} />
                      </span>
                    </span>
                    <button type="button" className="gx-quitar" aria-label={`Borrar la entrada: ${r.producto}`} onClick={() => borrarRecepcion(r.id)}><X size={18} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
