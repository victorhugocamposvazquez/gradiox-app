"use client";

// En el móvil, ops se usa como una app: cada ficha (cliente, nave) abre con una lista de lo
// que tiene; al tocar una fila se abre esa parte a pantalla completa con «‹ atrás» arriba.
// Nada de pestañas que no caben. En pantalla ancha no se pinta nada de esto.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FilaIndice = { clave: string; texto: string; detalle?: string; aviso?: boolean; icono: ReactNode } & ({ href: string } | { alTocar: () => void });
export type GrupoIndice = { nombre: string; filas: FilaIndice[] };

/** La barra fija de arriba en el móvil: volver y, si se está dentro de una parte, su nombre. */
export function BarraMovil({ volver, titulo }: { volver: { href: string; texto: string }; titulo?: string }) {
  return (
    <div data-slot="barra-movil" className="sticky top-12 z-[5] -mx-3 -mt-3.5 flex h-11 items-center gap-1 border-b bg-background/95 px-1.5 backdrop-blur md:hidden">
      <Link href={volver.href} className="flex h-11 min-w-0 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[15px] text-primary no-underline active:opacity-60" aria-label={`Volver a ${volver.texto}`}>
        <ChevronLeft className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="max-w-[40vw] truncate">{volver.texto}</span>
      </Link>
      {titulo && <span className="min-w-0 flex-1 truncate pr-2 text-center text-[15px] font-semibold" aria-current="page">{titulo}</span>}
      {titulo && <span className="w-[72px] shrink-0" aria-hidden="true" />}
    </div>
  );
}

/** La lista de lo que tiene una ficha, en grupos, con filas grandes para el dedo. */
export function IndiceMovil({ grupos, className }: { grupos: GrupoIndice[]; className?: string }) {
  return (
    <nav aria-label="Partes" className={cn("flex flex-col gap-5 md:hidden", className)}>
      {grupos.filter((g) => g.filas.length > 0).map((g) => (
        <section key={g.nombre} className="flex flex-col gap-1.5">
          <h2 className="m-0 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.nombre}</h2>
          <ul className="m-0 flex list-none flex-col divide-y overflow-hidden rounded-xl border bg-card p-0 shadow-xs">
            {g.filas.map((f) => {
              const dentro = (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-[18px]">{f.icono}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">{f.texto}</span>
                    {f.detalle && <span className={cn("truncate text-[13px]", f.aviso ? "text-aviso" : "text-muted-foreground")}>{f.detalle}</span>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                </>
              );
              const clase = "flex min-h-14 w-full items-center gap-3 border-0 bg-transparent px-3.5 py-2.5 text-left text-foreground no-underline active:bg-accent";
              return <li key={f.clave}>{"href" in f ? <Link href={f.href} className={clase}>{dentro}</Link> : <button type="button" onClick={f.alTocar} className={clase}>{dentro}</button>}</li>;
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/** Lleva a la vista el apartado elegido: a las pestañas en pantalla ancha y, en el móvil (donde están ocultas), arriba del todo. */
export function verApartado(id: string) {
  const pestanas = document.getElementById(id);
  if (pestanas && pestanas.offsetParent !== null) pestanas.scrollIntoView({ block: "start" });
  else window.scrollTo({ top: 0 });
}
