"use client";

import Link from "next/link";
import { ChartLine } from "lucide-react";
import { useEffect, useState } from "react";
import { SinBase } from "@/components/sin-base";
import { pedir } from "@/clientes/navegador";
import type { RespuestaDatos } from "@/app/api/ops/datos/route";

const entero = (n: number) => n.toLocaleString("es-ES");
const fecha = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
/** Un tamaño dicho como se dice: en KB, MB o GB. */
function tamano(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString("es-ES", { maximumFractionDigits: bytes < 10 * 1024 ** 2 ? 1 : 0 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB`;
}

/** Qué guarda Gradiox de cada instalación, cuánto tiempo y cuánto ocupa. */
export default function DatosGuardados() {
  const [datos, setDatos] = useState<RespuestaDatos | null>(null);
  const [fallo, setFallo] = useState("");
  useEffect(() => {
    pedir<RespuestaDatos>("/api/ops/datos")
      .then(setDatos)
      .catch((e: Error) => setFallo(e.message));
  }, []);
  const r = datos?.reglas ?? { controlMin: 10, vigenciaMin: 15, diasDetalle: 30 };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Datos guardados</h1>
          <p className="gx-sub">Qué guarda Gradiox de cada instalación, cuánto tiempo lo conserva y cuánto ocupa.</p>
        </div>
        {datos?.total != null && <span className="gx-chip azul">La base de datos ocupa {tamano(datos.total)} en total</span>}
      </header>

      <div className="gx-pila">
        {datos && datos.guardado === "memoria" && <SinBase />}
        {fallo && <p className="gx-chip error" role="alert">{fallo}</p>}

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Cómo se guarda</h2>
            <p className="gx-sub">Igual para todas las instalaciones. Está pensado para que no se pierda nada importante y el disco no se llene.</p>
          </div>
          <ol className="gx-datos-pasos">
            <li>
              <strong>Solo lo que cambia</strong>
              <p>La pasarela lee cada variable cada pocos segundos. Gradiox guarda una lectura cuando el valor cambia. Si no cambia, guarda una de control cada {r.controlMin} minutos, para saber que la variable sigue viva y con el mismo valor.</p>
            </li>
            <li>
              <strong>El detalle, {r.diasDetalle} días</strong>
              <p>Las lecturas una a una se conservan {r.diasDetalle} días. Antes de borrarlas, cada hora queda resumida: mínima, media, máxima, tiempo en marcha y veces que arrancó.</p>
            </li>
            <li>
              <strong>El resumen y las órdenes, siempre</strong>
              <p>El resumen por horas y cada orden dada a la instalación (qué, quién, cuándo, valor de antes y de después) no se borran nunca.</p>
            </li>
          </ol>
          <p className="gx-nota">Si una variable pasa más de {r.vigenciaMin} minutos sin ninguna lectura, ese rato cuenta como «sin datos»: no se inventa nada. En los históricos, lo de hace más de {r.diasDetalle} días se ve por horas; lo reciente, al detalle.</p>
        </section>

        {!datos && !fallo && <p className="gx-vacio">Mirando lo que hay guardado…</p>}
        {datos && datos.instalaciones.length === 0 && (
          <section className="gx-tarjeta">
            <h2>Todavía no hay ninguna instalación</h2>
            <p className="gx-vacio">El primer paso es crear una en Pasarelas y encender su programa. En cuanto entregue lecturas, aquí se ve lo que se va guardando de ella.</p>
          </section>
        )}
        {datos?.instalaciones.map((i) => {
          const g = i.guardado;
          // Lo que ocuparía el detalle cuando lleve los días completos, al ritmo de las últimas 24 horas.
          const alMes = g.bytesLectura !== null && g.ultimoDia > 0 ? g.ultimoDia * g.bytesLectura * r.diasDetalle : null;
          return (
            <section key={i.id} className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
              <div className="gx-fila">
                <div>
                  <h2>{i.nombre}</h2>
                  <p className="gx-sub">{g.primera === null ? "Todavía no ha entregado lecturas" : `Con lecturas en detalle desde el ${fecha(g.primera)}`}</p>
                </div>
                {i.simulada && <span className="gx-chip neutro">Datos simulados</span>}
              </div>
              <dl className="gx-datos-cifras">
                <div><dt>Variables con datos</dt><dd>{entero(i.variables)}</dd></div>
                <div><dt>Lecturas en detalle</dt><dd>{entero(g.lecturas)}</dd><small>Se conservan {r.diasDetalle} días</small></div>
                <div><dt>Horas resumidas</dt><dd>{entero(g.horas)}</dd><small>No se borran</small></div>
                <div><dt>Órdenes guardadas</dt><dd>{entero(g.ordenes)}</dd><small>No se borran</small></div>
                <div><dt>Ocupa ahora</dt><dd>{g.bytes === null ? "Sin base de datos" : g.bytes === 0 ? "Nada" : tamano(g.bytes)}</dd><small>Aproximado</small></div>
                <div><dt>Últimas 24 horas</dt><dd>{entero(g.ultimoDia)} lecturas</dd><small>{g.bytesLectura !== null && g.ultimoDia > 0 ? `Unos ${tamano(g.ultimoDia * g.bytesLectura)}` : "Sin lecturas nuevas"}</small></div>
              </dl>
              {alMes !== null && <p className="gx-nota">A este ritmo, el detalle de {r.diasDetalle} días se queda en unos {tamano(alMes)}. A partir de ahí deja de crecer: lo que entra por un lado sale resumido por el otro.</p>}
              <Link href={`/ops/historicos?id=${i.id}`} className="gx-boton secundario gx-datos-ver">
                <ChartLine size={17} strokeWidth={1.7} aria-hidden="true" /> Ver sus históricos
              </Link>
            </section>
          );
        })}
      </div>
    </>
  );
}
