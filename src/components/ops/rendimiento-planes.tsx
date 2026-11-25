"use client";

import type { ReactNode } from "react";
import { CircleCheck, CircleDashed, CircleAlert, Gauge, Eye, SlidersHorizontal } from "lucide-react";
import type { Instalacion } from "@/clientes/modelo";
import { ESTADOS_EQUIPO, type EstadoEquipo } from "@/clientes/tecnica";
import { EQUIPOS_MEDIDA, type IdEquipoMedida } from "@/cop/equipos";
import { PLANES, ROTULO_CLASE, ROTULO_ESTADO_PLAN } from "@/cop/planes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Hecho = "si" | "medio" | "no";
const ICONO: Record<Hecho, ReactNode> = {
  si: <CircleCheck className="size-4 text-bien" strokeWidth={1.8} aria-label="Hecho" />,
  medio: <CircleAlert className="size-4 text-aviso" strokeWidth={1.8} aria-label="A medias" />,
  no: <CircleDashed className="size-4 text-muted-foreground" strokeWidth={1.8} aria-label="Falta" />,
};

function Paso({ hecho, titulo, detalle, accion }: { hecho: Hecho; titulo: string; detalle: string; accion?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex-none">{ICONO[hecho]}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <span className="font-medium">{titulo}</span>
        <span className="text-xs text-muted-foreground">{detalle}</span>
      </span>
      {accion}
    </li>
  );
}

/** Los equipos de medida sin los que no hay COP de la instalación, en orden. */
const PARA_COP: IdEquipoMedida[] = ["analizadorGeneral", "sondaExterior", "analizadoresEquipos"];
const hechoEquipo = (e: EstadoEquipo | undefined): Hecho => (e === "lee" ? "si" : e === "tiene" ? "medio" : "no");

/**
 * Rendimiento de una instalación. Hoy no se calcula ningún COP: la pestaña dice qué
 * enseñará y qué le falta a esta instalación en concreto, sacado de su ficha técnica.
 */
export function Rendimiento({ nombre, inst, lee, irA }: { nombre: string; inst: Instalacion; lee: boolean; irA: (p: "tecnica" | "conexion") => void }) {
  const equipos = inst.tecnica.equipos ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-aviso/30 bg-aviso-fondo p-3 text-sm">
        <span className="font-medium">Todavía sin números.</span> Gradiox aún no calcula el rendimiento de ninguna instalación. Aquí se verá en cuanto {nombre} tenga lo de la lista de abajo y esté programado el cálculo.
      </div>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Gauge className="size-4" strokeWidth={1.6} aria-hidden="true" />Qué se verá aquí</CardTitle>
          <CardDescription>Cuánto frío saca la instalación por cada kWh de luz (el COP), frente a lo que podría sacar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="m-0 flex list-none flex-col divide-y p-0 text-sm">
            <li className="py-2.5"><span className="font-medium">La instalación entera.</span> <span className="text-muted-foreground">Es el que manda: con él se decide y se comprueba cada ajuste.</span></li>
            <li className="py-2.5"><span className="font-medium">Cada compresor.</span> <span className="text-muted-foreground">Para ver averías que empiezan y el orden en que conviene que arranquen.</span></li>
            <li className="py-2.5"><span className="font-medium">Cada cámara.</span> <span className="text-muted-foreground">Lo que cuesta mantener cada una, con un margen de ±10–20 %.</span></li>
          </ul>
          <p className="m-0 mt-2 text-xs text-muted-foreground">Cada número dirá si es medido, calculado o estimado, y con qué margen.</p>
        </CardContent>
      </Card>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="text-base">Qué le falta a {nombre}</CardTitle>
          <CardDescription>Sale de su conexión y de los equipos de medida de su ficha técnica.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="m-0 flex list-none flex-col divide-y p-0">
            <Paso
              hecho={lee ? "si" : "no"}
              titulo="Que Gradiox lea la instalación"
              detalle={lee ? "Ya entrega lecturas." : "Todavía no entrega lecturas."}
              accion={lee ? undefined : <Button size="sm" variant="outline" onClick={() => irA("conexion")}>Conectar</Button>}
            />
            {PARA_COP.map((k) => {
              const e = equipos[k];
              const eq = EQUIPOS_MEDIDA[k];
              return (
                <Paso
                  key={k}
                  hecho={hechoEquipo(e)}
                  titulo={`${eq.nombre}${eq.imprescindible ? "" : " (mejora la precisión)"}`}
                  detalle={`${e ? ESTADOS_EQUIPO[e] : "Sin mirar en la ficha técnica"}${e === "falta" ? `. Si hay que ponerlo: ${eq.siFalta}` : ""}. ${eq.paraQue}`}
                  accion={!e ? <Button size="sm" variant="outline" onClick={() => irA("tecnica")}>Mirarlo</Button> : undefined}
                />
              );
            })}
            <Paso hecho="no" titulo="Potencia y modelo de cada compresor" detalle="Y si las presiones que da el autómata son relativas o absolutas. Se piden al instalador." />
            <Paso hecho="no" titulo="El cálculo dentro de Gradiox" detalle="Las fórmulas están escritas (docs/rendimiento.md); falta programarlas." />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Planes de una instalación: lo que Gradiox hace por su cuenta, vigilar o ajustar.
 * El único que existe hoy es «Consignas por tarifa» (antes la pestaña «Ahorro»), y va dentro.
 */
export function Planes({ tarifa }: { tarifa: ReactNode }) {
  const [primero, ...resto] = PLANES;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Un plan es algo que Gradiox hace solo en esta instalación. Los que <b>vigilan</b> avisan antes de que algo falle; los que <b>ajustan</b> cambian consignas del autómata dentro de unos límites, nunca seguridades. Ninguno escribe en una planta real sin el visto bueno de Hugo.
      </p>

      <Card className="gap-3">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{primero.nombre}</CardTitle>
            <Badge variant="outline">{ROTULO_CLASE[primero.clase]}</Badge>
            <Badge variant="aviso">{ROTULO_ESTADO_PLAN[primero.estado]}</Badge>
          </div>
          <CardDescription>{primero.que} Para una planta real falta: {primero.necesita.charAt(0).toLowerCase() + primero.necesita.slice(1)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{tarifa}</CardContent>
      </Card>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="text-base">Los siguientes</CardTitle>
          <CardDescription>Diseñados, sin programar. Cada uno dice qué necesita.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="m-0 flex list-none flex-col divide-y p-0">
            {resto.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex-none text-muted-foreground">{p.clase === "vigila" ? <Eye className="size-4" strokeWidth={1.6} aria-hidden="true" /> : <SlidersHorizontal className="size-4" strokeWidth={1.6} aria-hidden="true" />}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{p.que}</span>
                  <span className="text-xs text-muted-foreground">Necesita: {p.necesita}</span>
                </span>
                <Badge variant="outline">{ROTULO_CLASE[p.clase]}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
