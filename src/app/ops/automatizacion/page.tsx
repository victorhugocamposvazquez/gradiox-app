import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { AHORRO, CALENDARIO, CAPAS, GRUPOS, NIVELES_AUTO, NUNCA, PARADAS, PENDIENTE, PRINCIPIOS, RAPIDO_BALANCE, ROTULO_HOY, TOPES, type EstadoHoy, type NivelAuto } from "@/cop/automatizacion";
import { DOCUMENTO } from "@/lib/plan";
import { EQUIPOS_MEDIDA, IDS_EQUIPO } from "@/cop/equipos";
import { BarraMovil } from "@/components/ops/movil";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Automatización · Gradiox" };

const REGLAS = "https://github.com/victorhugocamposvazquez/gradiox-app/blob/main/docs/rendimiento.md";
const VARIANTE_HOY: Record<EstadoHoy, "bien" | "aviso" | "outline"> = { hecho: "bien", simulado: "aviso", pendiente: "outline" };
const VARIANTE_TOPE = ["outline", "outline", "aviso", "acento", "bien"] as const;

/** Un bloque con título pequeño y una lista; se omite si no hay nada que contar. */
function Bloque({ titulo, items, children }: { titulo: string; items?: string[]; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</h4>
      {items && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-sm">
          {items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      {children}
    </div>
  );
}

function Nivel({ n }: { n: NivelAuto }) {
  return (
    <Card id={`nivel-${n.numero}`} className="scroll-mt-16">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="acento">Nivel {n.numero}</Badge>
          <CardTitle className="text-lg">{n.nombre}</CardTitle>
        </div>
        <CardDescription className="text-sm">{n.frase}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Bloque titulo="Qué hace Gradiox" items={n.hace}>
            <p className="m-0 text-sm text-muted-foreground">{n.noHace}</p>
          </Bloque>
          <Bloque titulo="Qué consigue el cliente" items={n.consigue}>
            <p className="m-0 text-sm"><span className="font-medium">Ahorro:</span> {n.ahorro}</p>
            <p className="m-0 text-sm"><span className="font-medium">De dónde salen los números:</span> {n.calidad}</p>
          </Bloque>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Qué hace falta</h4>
          <div className="grid gap-6 md:grid-cols-2">
            <Bloque titulo="Datos" items={n.datos} />
            <Bloque titulo="En el autómata" items={n.automata} />
            <Bloque titulo="En Gradiox (software)" items={n.software} />
            <Bloque titulo="Papeles y permisos" items={n.papeles} />
          </div>
          <p className="m-0 text-sm text-muted-foreground">Primero se mira si la instalación ya lo tiene y si el autómata lo lee (ficha técnica, apartado 6). Lo normal es que sí: entonces no cuesta nada. El coste solo cuenta si falta.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Si falta, coste orientativo</TableHead>
                <TableHead>Quién</TableHead>
                <TableHead>¿Imprescindible?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {n.equipos.map((e) => (
                <TableRow key={e.que}>
                  <TableCell className="min-w-48 whitespace-normal">{e.que}</TableCell>
                  <TableCell className="min-w-40 whitespace-normal">{e.coste}</TableCell>
                  <TableCell className="whitespace-normal">{e.quien}</TableCell>
                  <TableCell>{e.obligatorio ? <Badge variant="acento">Sí</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="m-0 text-sm"><span className="font-medium">Coste del nivel:</span> {n.coste}</p>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quién hace qué</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([["Gradiox", n.quien.gradiox], ["Instalador (RGV)", n.quien.instalador], ["Cliente", n.quien.cliente], ["Hugo", n.quien.hugo]] as const).map(([q, l]) => (
              <div key={q} className="rounded-md border p-3">
                <p className="m-0 mb-1 text-sm font-medium">{q}</p>
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4 text-sm text-muted-foreground">
                  {l.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Bloque titulo="Para llegar a este nivel" items={n.puerta}>
            <p className="m-0 text-sm"><span className="font-medium">Cuánto tarda:</span> {n.plazo}</p>
            {n.bajada !== "—" && <p className="m-0 text-sm"><span className="font-medium">Cuándo baja solo:</span> {n.bajada}</p>}
          </Bloque>
          <Bloque titulo="En qué punto está hoy">
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {n.hoy.map((h) => (
                <li key={h.texto} className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">{h.texto}</span>
                  <Badge variant={VARIANTE_HOY[h.estado]}>{ROTULO_HOY[h.estado]}</Badge>
                </li>
              ))}
            </ul>
          </Bloque>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Riesgos y garantías</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {n.riesgos.map((r) => (
              <div key={r.riesgo} className="rounded-md border p-3 text-sm">
                <p className="m-0 font-medium">{r.riesgo}</p>
                <p className="m-0 mt-1 text-muted-foreground">{r.garantia}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Seccion({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-16">
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {sub && <CardDescription>{sub}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Los cinco tipos de automatización, explicados para quien no es del sector:
 * qué hace cada uno, qué hace falta, qué consigue, cuánto cuesta y tarda,
 * quién hace qué, riesgos, y en qué punto está hoy. Sirve para una reunión.
 */
export default function Automatizacion() {
  return (
    <div className="flex flex-col gap-4">
      <BarraMovil arriba="/ops/plan" titulo="Automatización" sub="Qué hace falta en cada nivel" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold">Automatización</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            Cómo pasa Gradiox de mirar una instalación a ajustarla solo para gastar menos, en cinco niveles. En cada uno: qué hace, qué consigue el cliente, qué hace falta, cuánto cuesta y tarda, quién hace qué, riesgos y garantías, y en qué punto está hoy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={REGLAS} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
            <ExternalLink className="size-4" strokeWidth={1.6} aria-hidden="true" /> Fórmulas y reglas
          </a>
          <a href={DOCUMENTO} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
            <ExternalLink className="size-4" strokeWidth={1.6} aria-hidden="true" /> Plan de integración
          </a>
        </div>
      </header>

      <div className="rounded-lg border border-aviso/30 bg-aviso-fondo p-3 text-sm">
        <span className="font-medium">Dónde estamos:</span> la lectura de un autómata real funciona y las órdenes están probadas en simulado y en un autómata de pruebas. Los avisos de rendimiento, las propuestas y todo lo automático están diseñados y documentados, pero no programados. Nada escribe en una planta real sin el visto bueno de Hugo.
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PRINCIPIOS.map((p) => (
          <Card key={p.titulo} className="gap-1">
            <CardHeader><CardTitle className="text-base">{p.titulo}</CardTitle></CardHeader>
            <CardContent><p className="m-0 text-sm text-muted-foreground">{p.texto}</p></CardContent>
          </Card>
        ))}
      </div>

      <Seccion id="escalera" titulo="Los cinco niveles de un vistazo" sub="Cada grupo de ajustes (y cada ajuste dentro de él) tiene su propio nivel. El que vale es el más bajo entre el del ajuste, el de la instalación y el tope de ese ajuste.">
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-5">
          {NIVELES_AUTO.map((n) => (
            <li key={n.numero}>
              <Link href={`#nivel-${n.numero}`} className="flex h-full flex-col gap-1 rounded-md border p-3 text-inherit no-underline hover:bg-accent">
                <span className="text-xs text-muted-foreground">Nivel {n.numero}</span>
                <span className="font-semibold">{n.nombre}</span>
                <span className="text-sm text-muted-foreground">{n.frase}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-4 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nivel</TableHead>
              <TableHead>Lo que más hace falta</TableHead>
              <TableHead>Cuánto tarda</TableHead>
              <TableHead>Hoy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {NIVELES_AUTO.map((n) => {
              const peor = n.hoy.some((h) => h.estado === "pendiente") ? "pendiente" : n.hoy.some((h) => h.estado === "simulado") ? "simulado" : "hecho";
              return (
                <TableRow key={n.numero}>
                  <TableCell className="font-medium">{n.numero} · {n.nombre}</TableCell>
                  <TableCell className="min-w-56 whitespace-normal">{n.puerta[0]}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal">{n.plazo}</TableCell>
                  <TableCell><Badge variant={VARIANTE_HOY[peor]}>{peor === "pendiente" && n.hoy.some((h) => h.estado !== "pendiente") ? "En parte" : ROTULO_HOY[peor]}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </Seccion>

      <Seccion id="rapido" titulo="Camino rápido: ajustes agrupados" sub="Los ajustes se prueban en grupos en vez de uno a uno. La seguridad es la misma: nada se escribe antes del bloque del autómata y la prueba de corte.">
        <div className="grid gap-3 md:grid-cols-2">
          {GRUPOS.map((g) => (
            <div key={g.nombre} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{g.nombre}</span>
                <Badge variant="outline" className="h-auto max-w-full whitespace-normal text-left">{g.empieza}</Badge>
              </div>
              <p className="m-0">{g.ajustes}</p>
              <p className="m-0 text-muted-foreground"><span className="font-medium text-foreground">Cómo se mide:</span> {g.prueba}</p>
              <p className="m-0 text-muted-foreground"><span className="font-medium text-foreground">Por qué así:</span> {g.porQueJuntos}</p>
            </div>
          ))}
        </div>
        <h3 className="m-0 mt-5 mb-2 text-sm font-semibold">Calendario de una instalación</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {CALENDARIO.map((c) => (
            <li key={c.semanas} className="flex gap-3 border-b pb-2 last:border-0">
              <span className="w-20 shrink-0 font-medium tabular-nums">Sem. {c.semanas}</span>
              <span className="min-w-0 flex-1">{c.que}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-bien/30 bg-bien-fondo p-3 text-sm">
            <p className="m-0 mb-1 font-semibold">Lo que se gana</p>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4">{RAPIDO_BALANCE.gana.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="rounded-md border border-aviso/30 bg-aviso-fondo p-3 text-sm">
            <p className="m-0 mb-1 font-semibold">Lo que se pierde (y lo que no)</p>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4">{RAPIDO_BALANCE.pierde.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </Seccion>

      <Seccion id="equipos" titulo="Equipos de medida: para qué sirve cada uno" sub="Lo normal es que el cliente ya los tenga. Primero se comprueba en la ficha técnica de la instalación si existen y si el autómata los lee; solo lo que falte se compra.">
        <div className="grid gap-3 md:grid-cols-2">
          {IDS_EQUIPO.map((k) => {
            const e = EQUIPOS_MEDIDA[k];
            return (
              <div key={k} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{e.nombre}</span>
                  <Badge variant={e.imprescindible ? "acento" : "outline"}>{e.imprescindible ? "Imprescindible" : "Recomendable"} desde nivel {e.nivel}</Badge>
                </div>
                <p className="m-0"><span className="font-medium">Para qué se usa:</span> {e.paraQue}</p>
                <p className="m-0"><span className="font-medium">Qué mejora:</span> {e.mejora}</p>
                <p className="m-0"><span className="font-medium">Qué habilita:</span> {e.habilita}</p>
                <p className="m-0 text-muted-foreground"><span className="font-medium text-foreground">Si falta:</span> {e.siFalta} (orientativo, sin presupuesto).</p>
              </div>
            );
          })}
        </div>
      </Seccion>

      {NIVELES_AUTO.map((n) => <Nivel key={n.numero} n={n} />)}

      <Seccion id="topes" titulo="Hasta dónde llega cada ajuste" sub="Aunque pase todas las pruebas, un ajuste no pasa nunca de su tope.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ajuste</TableHead>
              <TableHead>Tope</TableHead>
              <TableHead>Por qué</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TOPES.map((t) => (
              <TableRow key={t.ajuste}>
                <TableCell className="min-w-48 whitespace-normal">{t.ajuste}</TableCell>
                <TableCell><Badge variant={VARIANTE_TOPE[t.tope]}>{t.tope} · {NIVELES_AUTO[t.tope].nombre}</Badge></TableCell>
                <TableCell className="min-w-56 whitespace-normal">{t.porQue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="m-0 mt-4 text-sm font-medium">Nunca, en ningún nivel:</p>
        <ul className="m-0 mt-1 flex flex-wrap gap-1.5 p-0">
          {NUNCA.map((t) => <li key={t} className="list-none"><Badge variant="mal">{t}</Badge></li>)}
        </ul>
      </Seccion>

      <Seccion id="seguridad" titulo="Cuatro capas de seguridad" sub="Si una falla, la de abajo protege. La de más abajo es la de siempre del autómata.">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {CAPAS.map((c, i) => (
            <li key={c.titulo} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
              <span className="min-w-0 text-sm"><span className="font-medium">{c.titulo}.</span> <span className="text-muted-foreground">{c.texto}</span></span>
            </li>
          ))}
        </ol>
        <p className="m-0 mt-4 text-sm font-medium">Se para solo cuando:</p>
        <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-4 text-sm">
          {PARADAS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="m-0 mt-3 text-sm text-muted-foreground">Parada a mano en el panel, en la app del cliente, en la página local de la pasarela (funciona sin internet) y en el selector del cuadro. Si un técnico cambia una consigna, ese ajuste se aparta 24 horas.</p>
      </Seccion>

      <Seccion id="ahorro" titulo="Cómo se demuestra el ahorro" sub="Sin medir no hay ahorro: lo que no se puede medir se dice estimado.">
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {AHORRO.map((t) => <li key={t}>{t}</li>)}
        </ol>
      </Seccion>

      <Seccion id="pendiente" titulo="Lo que queda pendiente" sub="Para pasar del diseño a la primera instalación con ajustes.">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {PENDIENTE.map((p) => (
            <li key={p.texto} className="flex flex-wrap items-start justify-between gap-2 border-b pb-2 last:border-0">
              <span className="min-w-0 flex-1">{p.texto}</span>
              <Badge variant="outline">{p.quien}</Badge>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion id="documentos" titulo="Dónde está todo">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-sm">
          <li><a href={REGLAS} target="_blank" rel="noreferrer" className="underline">Fórmulas, umbrales, avisos y ajustes</a> (documento del repositorio, sección 9 para el automático).</li>
          <li><Link href="/como-funciona/rendimiento" className="underline">Qué es el rendimiento (COP)</Link>, explicado para el cliente.</li>
          <li><Link href="/ops/plan" className="underline">Hoja de ruta</Link>, con lo que hay, lo que falta y las tareas de cada fase.</li>
        </ul>
      </Seccion>
    </div>
  );
}
