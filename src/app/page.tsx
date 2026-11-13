"use client";

import Link from "next/link";
import { BarrasPrecio, ChipEstado } from "@/components/piezas";
import { grados, gradosC, hora } from "@/lib/formato";
import { planDelDia, preciosDelDia } from "@/lib/luz";
import { CAMARAS, leer } from "@/lib/sim";
import { useDemo } from "@/lib/store";

export default function Inicio() {
  const { ahora, ajustes } = useDemo();
  if (ahora === null) return <p className="gx-sub">Leyendo las cámaras…</p>;

  const lecturas = CAMARAS.map((c) => ({ c, l: leer(c, ahora, ajustes) }));
  const cuenta = (e: string) => lecturas.filter((x) => x.l.estado === e).length;
  const precios = preciosDelDia(new Date(ahora));
  const plan = planDelDia(precios);
  const h = new Date(ahora).getHours();
  const tramo = plan.baratas.includes(h) ? "Hora barata" : plan.caras.includes(h) ? "Hora cara" : "Hora normal";

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Cámaras</h1>
          <p className="gx-sub">Nave de demostración · actualizado a las {hora(ahora)}</p>
        </div>
      </header>

      <div className="gx-resumen">
        <div>
          <strong style={{ color: "var(--gx-correcto)" }}>{cuenta("correcto")}</strong>
          <span>En su sitio</span>
        </div>
        <div>
          <strong style={{ color: "var(--gx-aviso)" }}>{cuenta("aviso")}</strong>
          <span>Con aviso</span>
        </div>
        <div>
          <strong style={{ color: "var(--gx-error)" }}>{cuenta("error")}</strong>
          <span>En alarma</span>
        </div>
      </div>

      <div className="gx-pila">
        <div className="gx-rejilla">
          {lecturas.map(({ c, l }) => (
            <Link key={c.id} href={`/camaras/${c.id}`} className={`gx-tarjeta gx-camara${l.estado === "error" ? " error" : ""}`}>
              <div className="gx-fila">
                <div>
                  <h2>{c.nombre}</h2>
                  <p className="gx-sub">{c.tipo === "congelado" ? "Congelado" : "Fresco"} · consigna {gradosC(l.consigna)}</p>
                </div>
              </div>
              <div className={`gx-temp${l.estado === "error" ? " error" : ""}`}>{grados(l.temp)}</div>
              <div>
                <ChipEstado estado={l.estado} texto={l.motivo} />
              </div>
            </Link>
          ))}
        </div>

        <Link href="/luz" className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <div>
              <h2>Precio de la luz, hoy</h2>
              <p className="gx-sub">Ahora {precios[h]} €/MWh · precio simulado</p>
            </div>
            <span className={`gx-chip ${tramo === "Hora barata" ? "azul" : "neutro"}`}>{tramo}</span>
          </div>
          <BarrasPrecio precios={precios} baratas={plan.baratas} caras={plan.caras} horaActual={h} baja />
        </Link>
      </div>
    </>
  );
}
