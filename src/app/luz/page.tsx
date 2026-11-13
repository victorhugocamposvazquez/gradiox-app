"use client";

import { BarrasPrecio } from "@/components/piezas";
import { useMemo, useState } from "react";
import { consumoHoy } from "@/lib/analisis";
import { euros, gradosC, hora } from "@/lib/formato";
import { ahorroEstimado, planDelDia, preciosDelDia } from "@/lib/luz";
import { CAMARAS, entraEnPlan } from "@/lib/datos";
import { useDemo } from "@/lib/store";

const tramos = (horas: number[]) => horas.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ");

export default function Luz() {
  const { ahora, ajustes, activarPlan, precioReal, precioLeido, precioManana } = useDemo();
  const [dia, setDia] = useState<"hoy" | "manana">("hoy");
  const minuto = ahora === null ? null : Math.floor(ahora / 300_000);
  const consumos = useMemo(
    () => (minuto === null ? [] : CAMARAS.map((c) => ({ c, ...consumoHoy(c, minuto * 300_000, ajustes) }))),
    [minuto, ajustes],
  );
  if (ahora === null) return <p className="gx-sub">Leyendo el precio…</p>;
  const totalKwh = consumos.reduce((a, x) => a + x.kwh, 0);
  const totalEuros = consumos.reduce((a, x) => a + x.euros, 0);

  const esManana = dia === "manana";
  // Con precio real, el de mañana solo se enseña cuando ya está publicado: no se rellena con uno inventado.
  const faltaManana = esManana && precioReal && !precioManana;
  const precios = preciosDelDia(new Date(ahora + (esManana ? 86_400_000 : 0)));
  const plan = planDelDia(precios);
  const h = esManana ? -1 : new Date(ahora).getHours();
  const media = Math.round(precios.reduce((a, b) => a + b, 0) / 24);
  const mediaHoy = Math.round(preciosDelDia(new Date(ahora)).reduce((a, b) => a + b, 0) / 24);
  const congelado = CAMARAS.filter(entraEnPlan);
  const ahorro = ahorroEstimado(precios, plan, congelado.map((c) => c.potenciaKw));

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Luz</h1>
          <p className="gx-sub">Producir más frío en las horas de menor coste y reducirlo en las más caras</p>
        </div>
        <span className={`gx-chip ${ajustes.planActivo ? "correcto" : "neutro"}`}>{ajustes.planActivo ? "Plan en marcha" : "Plan parado"}</span>
      </header>

      <div className="gx-dos">
        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <h2>{esManana ? "Precio de mañana por horas" : "Precio de hoy por horas"}</h2>
            <div className="gx-periodos" role="group" aria-label="Qué día">
              <button type="button" aria-pressed={!esManana} onClick={() => setDia("hoy")}>Hoy</button>
              <button type="button" aria-pressed={esManana} onClick={() => setDia("manana")}>Mañana</button>
            </div>
          </div>
          {faltaManana ? (
            <p className="gx-vacio">El precio de mañana aún no está publicado. Red Eléctrica lo saca por la tarde; Gradiox lo mira cada media hora y aparecerá aquí solo.</p>
          ) : (
            <>
              <p className="gx-vivo">
                <span className={`gx-punto${precioReal && !esManana ? " vivo" : precioReal ? "" : " neutro"}`} />
                {esManana
                  ? `${precioReal ? "Precio real, ya publicado" : "Precio simulado"} · media ${media} €/MWh, ${media === mediaHoy ? "igual que hoy" : `${Math.abs(media - mediaHoy)} ${media > mediaHoy ? "más" : "menos"} que hoy`}`
                  : `${precioReal ? "Precio real, en vivo" : "Precio simulado"} · ahora ${precios[h]} €/MWh`}
              </p>
              <BarrasPrecio precios={precios} baratas={plan.baratas} caras={plan.caras} horaActual={h} />
              <div className="gx-leyenda">
                <span><i style={{ background: "var(--gx-azul)" }} />Menor coste: producir más frío</span>
                <span><i style={{ background: "var(--gx-tinta)" }} />Mayor coste: reducir</span>
                <span><i style={{ background: "var(--gx-borde-fuerte)" }} />Resto de horas</span>
              </div>
            </>
          )}
          <div className="gx-origen">
            <strong>De dónde sale</strong>
            {precioReal ? (
              <p>
                Es el PVPC por horas (el precio regulado de la luz) que publica Red Eléctrica de España en su servicio público de datos (REData, apidatos.ree.es). Los 24 precios del día se publican de una vez la tarde anterior y ya no cambian, así que lo que va en vivo es la hora: la barra marcada y el «ahora» cambian solos al dar la hora. Gradiox comprueba cada media hora que tiene los del día{precioLeido ? `; la última vez, a las ${hora(precioLeido)}` : ""}.
              </p>
            ) : (
              <p>Ahora mismo no se ha podido leer el precio de Red Eléctrica, así que estas barras son una curva simulada con la forma de un día normal. Se vuelve a intentar cada media hora.</p>
            )}
            <p>Si el contrato de la nave no es de precio por horas, el plan no ahorra tal cual: habría que meter aquí las tarifas de ese contrato.</p>
          </div>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 14, gridRow: "span 2" }}>
          <h2>{esManana ? "Plan de mañana" : "Plan de hoy"}</h2>
{faltaManana ? <p className="gx-vacio">Se sabrá cuando se publique el precio de mañana.</p> : (<>
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
                Solo en las cámaras de congelado
                <small>{congelado.map((c) => `${c.nombre} (${gradosC(ajustes.consignas[c.id] ?? c.consigna)})`).join(", ")}</small>
              </span>
            </li>
          </ul>
          <div>
            <strong style={{ fontFamily: "var(--gx-letra-marca)", fontSize: 26, fontWeight: 500 }}>{euros(ahorro.euros)}</strong>
            <p className="gx-nota">Ahorro estimado al día, moviendo unos {ahorro.kwh} kWh. Sale de la simulación, no de una medida.</p>
          </div>
          </>)}
          <button type="button" className={`gx-boton${ajustes.planActivo ? " secundario" : ""}`} onClick={() => activarPlan(!ajustes.planActivo)}>
            {ajustes.planActivo ? "Parar el plan" : "Poner el plan en marcha"}
          </button>
          <p className="gx-nota">Nunca sube la consigna a menos de tres grados del límite del género. Los servicios de fresco y el túnel no se tocan.</p>
        </section>

        <section className="gx-tarjeta">
          <div className="gx-fila">
            <h2>Lo que llevan gastado hoy</h2>
            <p className="gx-sub">{totalKwh} kWh · {euros(totalEuros)}</p>
          </div>
          <ul className="gx-lista" style={{ marginTop: 8 }}>
            {consumos.filter(({ c }) => !c.sinCompresor).map(({ c, kwh, euros: coste }) => (
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
