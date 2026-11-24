"use client";

// Todos los clientes en una lista: es la pestaña «Clientes» de la barra de abajo en el móvil.

import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavegacion } from "@/components/ops/navegacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Clientes() {
  const { clientes } = useNavegacion();
  const [busca, setBusca] = useState("");
  const lista = (clientes ?? []).filter((c) => sinTildes(c.nombre).includes(sinTildes(busca.trim())));
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        <Button asChild size="sm"><Link href="/ops/clientes/nuevo"><Plus aria-hidden="true" />Cliente nuevo</Link></Button>
      </header>
      <label className="relative block">
        <span className="sr-only">Buscar un cliente</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre" className="h-10 bg-card pl-9" />
      </label>
      {clientes === null ? (
        <p className="text-sm text-muted-foreground">Cargando los clientes…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">{busca ? "Ningún cliente con ese nombre." : "Todavía no hay clientes. Empieza con «Cliente nuevo»."}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y overflow-hidden rounded-xl border bg-card p-0 shadow-xs">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/ops/clientes/${c.id}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 text-foreground no-underline hover:bg-accent/60 active:bg-accent">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-acento-fondo text-sm font-semibold text-acento-texto" aria-hidden="true">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{c.nombre || "Cliente sin nombre"}</span>
                  <span className="text-[13px] text-muted-foreground">{c.tecnicas.length === 1 ? "1 instalación" : `${c.tecnicas.length} instalaciones`}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
