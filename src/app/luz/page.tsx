"use client";

import { BarrasPrecio } from "@/components/piezas";
import { useMemo } from "react";
import { consumoHoy } from "@/lib/analisis";
import { euros, gradosC } from "@/lib/formato";
import { ahorroEstimado, planDelDia, preciosDelDia } from "@/lib/luz";
import { CAMARAS } from "@/lib/sim";
import { useDemo } from "@/lib/store";

const tramos = (horas: number[]) => horas.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ");

export default function Luz() {
  const { ahora, ajustes, activarPlan } = useDemo();
  const minuto = ahora === null ? null : Math.floor(ahora / 300_000);
  const consumos = useMemo(
    () => (minuto === null ? [] : CAMARAS.map((c) => ({ c, ...consumoHoy(c, minuto * 300_000, ajustes) }))),
    [minuto, ajustes],
  );
  if (ahora === null) return <p className="gx-sub">Leyendo el precio…</p>;
  const totalKwh = consumos.reduce((a, x) => a + x.kwh, 0);
  const totalEuros = consumos.reduce((a, x) => a + x.euros, 0);

  const precios = preciosDelDia(new Date(ahora));
  const plan = planDelDia(precios);
  const h = new Date(ahora).getHours();
  const congelado = CAMARAS.filter((c) => c.tipo === "congelado");
  const ahorro = ahorroEstimado(precios, plan, congelado.map((c) => c.potenciaKw));

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Luz</h1>
          <p className="gx-sub">Enfriar de más cuando la luz es barata y aflojar cuando es cara</p>
        </div>
        <span className={`gx-chip ${ajustes.planActivo ? "correcto" : "neutro"}`}>{ajustes.planActivo ? "Plan en marcha" : "Plan parado"}</span>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <h2>Precio de hoy por horas</h2>
            <p className="gx-sub">Ahora {precios[h]} €/MWh</p>
          </div>
          <BarrasPrecio precios={precios} baratas={plan.baratas} caras={plan.caras} horaActual={h} />
          <div className="gx-leyenda">
            <span><i style={{ background: "var(--gx-azul)" }} />Baratas: enfriar de más</span>
            <span><i style={{ background: "var(--gx-tinta)" }} />Caras: aflojar</span>
            <span><i style={{ background: "#c5d1db" }} />Normales</span>
          </div>
          <p className="gx-nota">Precio simulado para la demostración. El real se leería cada día de Red Eléctrica o del contrato de la nave.</p>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 14, gridRow: "span 2" }}>
          <h2>Plan de hoy</h2>
          <ul className="gx-lista">
            <li>
              <span>
                Bajar 2 grados la consigna
                <small>A las {tramos(plan.baratas)}</small>
              </span>
            </li>
            <li>
              <span>
                Subir 2 grados la consigna
                <small>A las {tramos(plan.caras)}</small>
              </span>
            </li>
            <li>
              <span>
                Solo en congelado
                <small>{congelado.map((c) => `${c.nombre} (${gradosC(ajustes.consignas[c.id] ?? c.consigna)})`).join(", ")}</small>
              </span>
            </li>
          </ul>
          <div>
            <strong style={{ fontFamily: "var(--gx-letra-marca)", fontSize: 26, fontWeight: 500 }}>{euros(ahorro.euros)}</strong>
            <p className="gx-nota">Ahorro estimado al día, moviendo unos {ahorro.kwh} kWh. Sale de la simulación, no de una medida.</p>
          </div>
          <button type="button" className={`gx-boton${ajustes.planActivo ? " secundario" : ""}`} onClick={() => activarPlan(!ajustes.planActivo)}>
            {ajustes.planActivo ? "Parar el plan" : "Poner el plan en marcha"}
          </button>
          <p className="gx-nota">Nunca sube la consigna a menos de tres grados del límite del género. Los servicios de fresco no se tocan.</p>
        </section>

        <section className="gx-tarjeta">
          <div className="gx-fila">
            <h2>Lo que llevan gastado hoy</h2>
            <p className="gx-sub">{totalKwh} kWh · {euros(totalEuros)}</p>
          </div>
          <ul className="gx-lista" style={{ marginTop: 8 }}>
            {consumos.map(({ c, kwh, euros: coste }) => (
              <li key={c.id}>
                <span>
                  {c.nombre}
                  <small>Compresor de {c.potenciaKw} kW</small>
                </span>
                <span style={{ textAlign: "right" }}>
                  <strong style={{ fontWeight: 500 }}>{euros(coste)}</strong>
                  <small>{kwh} kWh</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="gx-nota">Desde las 00:00. Calculado con la potencia de cada compresor, su tiempo de marcha y el precio de cada hora; no viene de un contador.</p>
        </section>
      </div>
    </>
  );
}
