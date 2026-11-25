import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { ACTUALIZADO, DECISIONES, FASES, ROTULO_PLAN, TAREAS, type EstadoPlan, type Tarea } from "@/lib/plan";
import { ESPERA, PROGRAMADO, ROTULO_FUNCIONA, SITIOS, SOLO_MAQUETA, SOLO_PLAN, type Funciona } from "@/lib/mapa";
import { BarraMovil } from "@/components/ops/movil";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Hoja de ruta · Gradiox" };

const VARIANTE_FUNCIONA: Record<Funciona, "bien" | "aviso" | "outline" | "acento"> = { real: "bien", simulado: "aviso", explica: "outline", prueba: "acento" };
const VARIANTE_PLAN: Record<EstadoPlan, "bien" | "acento" | "aviso" | "outline"> = { hecho: "bien", curso: "acento", esperando: "aviso", pendiente: "outline" };

function Seccion({ id, titulo, sub, children }: { id: string; titulo: string; sub: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="flex scroll-mt-16 flex-col gap-3">
      <div>
        <h2 id={`${id}-t`} className="m-0 text-lg font-semibold">{titulo}</h2>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">{sub}</p>
      </div>
      {children}
    </section>
  );
}

function Tareas({ lista, conQuien }: { lista: Tarea[]; conQuien?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col divide-y p-0">
      {lista.map((t) => (
        <li key={t.texto} className="flex items-start justify-between gap-3 py-2.5">
          <span className="min-w-0 text-sm">
            {t.texto}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fase {t.fase}
              {conQuien ? ` · ${t.quien}` : ""}
              {t.nota ? ` · ${t.nota}` : ""}
            </span>
          </span>
          <Badge variant={VARIANTE_PLAN[t.estado]}>{ROTULO_PLAN[t.estado]}</Badge>
        </li>
      ))}
    </ul>
  );
}

const enlaceExterno = (href: string) => href.startsWith("http");

export default function HojaDeRuta() {
  const tuyas = TAREAS.filter((t) => t.quien === "Hugo" && t.estado !== "hecho");
  const abiertas = TAREAS.filter((t) => t.quien === "Gradiox" && t.estado !== "hecho");
  const cerradas = TAREAS.filter((t) => t.estado === "hecho");
  const fecha = new Date(`${ACTUALIZADO}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <BarraMovil arriba="/ops" titulo="Hoja de ruta" sub="Qué hay, qué falta y quién lo hace" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold">Hoja de ruta</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            Qué está programado y dónde se ve, qué solo está dibujado, qué solo está escrito y qué espera a datos de fuera. Al día el {fecha}.
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-aviso/30 bg-aviso-fondo p-3 text-sm">
        <span className="font-medium">Dónde estamos:</span> Gradiox lee y escribe en un autómata de verdad (el de pruebas de Antonio, 23 nov) y guarda lo que lee. Todavía no hay ninguna planta real conectada ni ningún dato de electricidad, así que no existe ningún COP ni ningún ahorro medido. El rendimiento y los planes están diseñados, no programados.
      </div>

      <nav aria-label="En esta página" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#programado", "Programado"],
          ["#maqueta", "Solo dibujado"],
          ["#plan", "Solo escrito"],
          ["#espera", "Espera a otros"],
          ["#sitios", "Dónde está cada cosa"],
          ["#tareas", "Tareas"],
        ].map(([href, texto]) => (
          <a key={href} href={href} className="rounded-md border px-2.5 py-1 text-inherit no-underline hover:bg-accent">{texto}</a>
        ))}
      </nav>

      <Seccion id="programado" titulo="1. Programado: lo puedes abrir hoy" sub="La etiqueta dice si funciona con datos de verdad, si es simulado o si solo explica.">
        <div className="grid gap-4 lg:grid-cols-2">
          {PROGRAMADO.map((g) => (
            <Card key={g.grupo} className="gap-2">
              <CardHeader>
                <CardTitle className="text-base">{g.grupo}</CardTitle>
                <CardDescription>{g.sub}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="m-0 flex list-none flex-col divide-y p-0">
                  {g.sitios.map((s) => (
                    <li key={s.que} className="flex flex-col gap-1 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 text-sm font-medium">{s.que}</span>
                        <Badge variant={VARIANTE_FUNCIONA[s.funciona]}>{ROTULO_FUNCIONA[s.funciona]}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Dónde: {s.ruta ? <Link href={s.ruta} className="underline">{s.donde}</Link> : s.donde}
                      </span>
                      {s.nota && <span className="text-xs text-muted-foreground">{s.nota}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </Seccion>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion id="maqueta" titulo="2. Solo dibujado (maqueta)" sub="Se puede tocar en la maqueta de ops, pero no está en gradiox.com.">
          <Card className="py-2">
            <CardContent>
              <ul className="m-0 flex list-none flex-col divide-y p-0">
                {SOLO_MAQUETA.map((x) => (
                  <li key={x.que} className="py-2.5 text-sm">
                    <span className="font-medium">{x.que}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{x.detalle}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Seccion>

        <Seccion id="plan" titulo="3. Solo escrito (plan)" sub="Pensado y documentado; ni programado ni dibujado del todo.">
          <Card className="py-2">
            <CardContent>
              <ul className="m-0 flex list-none flex-col divide-y p-0">
                {SOLO_PLAN.map((x) => (
                  <li key={x.que} className="py-2.5 text-sm">
                    <span className="font-medium">{x.que}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{x.detalle}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Seccion>
      </div>

      <Seccion id="espera" titulo="4. Espera a datos o a otras personas" sub="Sin esto no se puede seguir, por mucho que se programe.">
        <Card className="py-2">
          <CardContent>
            <ul className="m-0 flex list-none flex-col divide-y p-0">
              {ESPERA.map((x) => (
                <li key={x.que} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="min-w-0">
                    <span className="font-medium">{x.que}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Desbloquea: {x.desbloquea}</span>
                  </span>
                  <Badge variant="outline">{x.quien}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Seccion>

      <Seccion id="sitios" titulo="Dónde está cada cosa" sub="Ops dice lo que hay. Una sola maqueta viva para lo siguiente. Los documentos quedan como archivo del porqué.">
        <Card className="py-2">
          <CardContent>
            <ul className="m-0 flex list-none flex-col divide-y p-0">
              {SITIOS.map((s) => (
                <li key={s.nombre} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="min-w-0">
                    {s.enlace ? (
                      enlaceExterno(s.enlace) ? (
                        <a href={s.enlace} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
                          {s.nombre} <ExternalLink className="size-3.5" strokeWidth={1.6} aria-hidden="true" />
                        </a>
                      ) : (
                        <Link href={s.enlace} className="font-medium underline">{s.nombre}</Link>
                      )
                    ) : (
                      <span className="font-medium">{s.nombre}</span>
                    )}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{s.papel}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">{s.tipo}</Badge>
                    <Badge variant={s.desde === "archivo" ? "outline" : "bien"}>{s.desde === "archivo" ? "Archivo" : "Vigente"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Seccion>

      <Seccion id="tareas" titulo="Tareas" sub="El detalle, tarea a tarea, con quién la lleva.">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-base">Fases</CardTitle>
            <CardDescription>El camino completo, en orden</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="m-0 flex list-none flex-col divide-y p-0">
              {FASES.map((f) => (
                <li key={f.numero} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{f.numero}. {f.nombre}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{f.resumen}</span>
                  </span>
                  <Badge variant={VARIANTE_PLAN[f.estado]}>{ROTULO_PLAN[f.estado]}</Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Esperan por ti · {tuyas.length}</CardTitle>
              <CardDescription>Lo que solo puedes hacer tú</CardDescription>
            </CardHeader>
            <CardContent>{tuyas.length ? <Tareas lista={tuyas} /> : <p className="m-0 text-sm text-muted-foreground">Nada pendiente por tu parte.</p>}</CardContent>
          </Card>
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Lleva Gradiox · {abiertas.length}</CardTitle>
              <CardDescription>Lo que está abierto y de qué depende</CardDescription>
            </CardHeader>
            <CardContent>{abiertas.length ? <Tareas lista={abiertas} /> : <p className="m-0 text-sm text-muted-foreground">Nada abierto.</p>}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-2">
            <CardContent>
              {/* Cerrado de entrada: es la lista más larga y lo que importa está arriba. */}
              <details>
                <summary className="cursor-pointer text-base font-semibold">Hecho · {cerradas.length}</summary>
                <Tareas lista={cerradas} conQuien />
              </details>
            </CardContent>
          </Card>
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Decisiones tomadas</CardTitle>
              <CardDescription>Cómo se conecta Gradiox con cualquier instalación</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="m-0 flex list-none flex-col divide-y p-0">
                {DECISIONES.map((d) => (
                  <li key={d.titulo} className="py-2.5 text-sm">
                    <span className="font-medium">{d.titulo}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{d.detalle}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Seccion>
    </div>
  );
}
