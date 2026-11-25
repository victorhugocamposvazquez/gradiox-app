"use client";

// Lista de clientes con sus instalaciones debajo para ver en un golpe de vista qué plantas tiene cada empresa.

import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { ESTADOS, TONO } from "@/clientes/modelo";
import { agrupar, estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { DE_CHIP, Estado, MarcadorNave } from "@/components/ops/punto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Clientes() {
  const { clientes, instalaciones, ahora } = useNavegacion();
  const [busca, setBusca] = useState("");
  const q = sinTildes(busca.trim());
  const grupos = agrupar(clientes ?? [], instalaciones ?? []);
  const lista = (clientes ?? []).filter(
    (c) =>
      !q ||
      sinTildes(c.nombre).includes(q) ||
      c.tecnicas.some((t) => sinTildes(t.nombre).includes(q)),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="m-0 text-[13px] text-muted-foreground">Cada empresa con sus instalaciones. Pulsa en el cliente para abrir su panel dedicado o entra directo a una planta.</p>
        </div>
        <Button asChild size="sm"><Link href="/ops/clientes/nuevo"><Plus aria-hidden="true" />Cliente nuevo</Link></Button>
      </header>
      <label className="relative block">
        <span className="sr-only">Buscar cliente o instalación</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente o instalación" className="h-9 bg-card pl-9" />
      </label>
      {clientes === null ? (
        <p className="text-sm text-muted-foreground">Cargando los clientes…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">{busca ? "Ningún cliente ni instalación coincide." : "Todavía no hay clientes. Empieza con «Cliente nuevo»."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => {
            const suyas = grupos.deCliente(c.id);
            const naves = c.tecnicas.map((t) => ({ ...t, conexion: suyas.find((p) => p.ubicacion === t.id) }));
            const sueltas = suyas.filter((p) => !c.tecnicas.some((t) => t.id === p.ubicacion));
            return (
              <section key={c.id} className="overflow-hidden rounded-xl border bg-card">
                <Link
                  href={`/ops/clientes/${c.id}`}
                  className="flex min-h-13 items-center gap-3 border-b bg-muted/35 px-4 py-2.5 text-foreground no-underline transition-colors hover:bg-accent/50"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">
                    {c.nombre.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className="truncate text-sm font-semibold">{c.nombre || "Cliente sin nombre"}</span>
                    <Estado tono={DE_CHIP[TONO[c.estado]] ?? "neutro"} texto={ESTADOS[c.estado]} />
                  </span>
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                    {naves.length === 1 ? "1 instalación" : `${naves.length} instalaciones`}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                </Link>

                {naves.length + sueltas.length === 0 ? (
                  <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
                    <span>Sin instalaciones todavía</span>
                    <Link href={`/ops/clientes/${c.id}?paso=instalaciones`} className="font-medium text-acento-texto no-underline hover:underline">
                      Añadir instalación →
                    </Link>
                  </div>
                ) : (
                  <ul className="m-0 flex list-none flex-col divide-y p-0">
                    {naves.map((n) => {
                      const e = n.conexion ? estadoInstalacion(n.conexion, ahora) : { tono: "neutro" as const, texto: "Sin conectar" };
                      return (
                        <li key={n.id}>
                          <Link
                            href={`/ops/clientes/${c.id}/instalaciones/${n.id}`}
                            className="flex items-center gap-3 py-2.5 pr-4 pl-10 text-[13px] text-foreground no-underline transition-colors hover:bg-accent/40"
                          >
                            <MarcadorNave tono={e.tono} />
                            <span className="min-w-0 flex-1 truncate font-medium">{n.nombre}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{e.texto}</span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.6} aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                    {sueltas.map((p) => {
                      const e = estadoInstalacion(p, ahora);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/ops/instalaciones/${p.id}`}
                            className="flex items-center gap-3 py-2.5 pr-4 pl-10 text-[13px] text-foreground no-underline transition-colors hover:bg-accent/40"
                          >
                            <MarcadorNave tono={e.tono} />
                            <span className="min-w-0 flex-1 truncate font-medium">{p.nombre}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{e.texto} · conexión suelta</span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.6} aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
