"use client";

// En el móvil, ops se usa como una app: cada ficha (cliente, nave) abre con una lista de lo
// que tiene; al tocar una fila se abre esa parte a pantalla completa. Arriba, siempre, la
// flecha de atrás y dónde estás (nombre y parte).
// Nada de pestañas que no caben. En pantalla ancha no se pinta nada de esto.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FilaIndice = { clave: string; texto: string; detalle?: string; aviso?: boolean; icono: ReactNode } & ({ href: string } | { alTocar: () => void });
export type GrupoIndice = { nombre: string; filas: FilaIndice[] };

// El rastro de esta pestaña del navegador: por qué pantallas se ha pasado. Sirve para que
// «atrás» vuelva a donde estabas de verdad y, si se entró por un enlace directo (no hay de
// dónde volver), suba un nivel en vez de sacarte de Gradiox.
const CLAVE_RASTRO = "gx-rastro";
function leerRastro(): string[] {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(CLAVE_RASTRO) ?? "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
/** Apunta la pantalla en la que se está. Llamarla también tras un `history.pushState` propio. */
export function anotarPaso() {
  const aqui = window.location.pathname + window.location.search;
  const r = leerRastro();
  if (r[r.length - 1] === aqui) return;
  if (r[r.length - 2] === aqui) r.pop();
  else r.push(aqui);
  try {
    window.sessionStorage.setItem(CLAVE_RASTRO, JSON.stringify(r.slice(-40)));
  } catch {
    // Sin almacenamiento, «atrás» sube siempre un nivel.
  }
}
/** Va apuntando el rastro. Se monta una vez en el armazón de cada app. */
export function useRastro() {
  const ruta = usePathname();
  useEffect(() => {
    anotarPaso();
    window.addEventListener("popstate", anotarPaso);
    return () => window.removeEventListener("popstate", anotarPaso);
  }, [ruta]);
}
/** La flecha de atrás: vuelve a la pantalla anterior; si no la hay (enlace directo), a `arriba`. */
export function BotonAtras({ arriba, className }: { arriba: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Atrás"
      onClick={() => (leerRastro().length > 1 ? router.back() : router.push(arriba))}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-primary active:opacity-60", className)}
    >
      <ChevronLeft className="size-6" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

/**
 * La barra fija de arriba en el móvil: la flecha de atrás (sin texto) y dónde estás, siempre:
 * el nombre (del cliente, de la instalación…) y debajo en qué parte de él.
 */
export function BarraMovil({ arriba, titulo, sub }: { arriba: string; titulo: string; sub?: string }) {
  return (
    <div data-slot="barra-movil" className="sticky top-12 z-[5] -mx-3 -mt-3.5 flex min-h-12 items-center gap-0.5 border-b bg-background/95 py-1 pr-3 pl-0.5 backdrop-blur md:hidden">
      <BotonAtras arriba={arriba} />
      <div className="flex min-w-0 flex-1 flex-col" aria-current="page">
        <span className="truncate text-[15px] leading-tight font-semibold">{titulo}</span>
        {sub && <span className="truncate text-xs leading-tight text-muted-foreground">{sub}</span>}
      </div>
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

/** La misma barra para la app del cliente, que tiene otro margen y no lleva barra fija encima. */
export function BarraApp({ arriba, titulo, sub }: { arriba: string; titulo: string; sub?: string }) {
  return (
    <div data-slot="barra-movil" className="gx-no-imprimir sticky top-0 z-[5] -mt-1 mb-1 -ml-3 flex min-h-12 items-center gap-0.5 bg-background/95 py-1 backdrop-blur md:hidden">
      <BotonAtras arriba={arriba} />
      <div className="flex min-w-0 flex-1 flex-col" aria-current="page">
        <span className="truncate text-[15px] leading-tight font-semibold">{titulo}</span>
        {sub && <span className="truncate text-xs leading-tight text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}
