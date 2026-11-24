"use client";

// En el móvil, las pestañas de una ficha no caben y se pierde dónde se está. En su lugar va
// una barra fija con «volver» y un solo desplegable que dice dónde estás y lleva a cualquier
// otra parte del mismo cliente (sus apartados y sus naves).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";

export type OpcionZona = { valor: string; texto: string } & ({ pestana: true } | { href: string });
export type GrupoZona = { nombre: string; opciones: OpcionZona[] };

export function SelectorZona({ volver, valor, grupos, alElegir, etiqueta }: { volver: { href: string; texto: string }; valor: string; grupos: GrupoZona[]; alElegir: (pestana: string) => void; etiqueta: string }) {
  const router = useRouter();
  const elegir = (v: string) => {
    const o = grupos.flatMap((g) => g.opciones).find((x) => x.valor === v);
    if (!o) return;
    if ("href" in o) router.push(o.href);
    else alElegir(o.valor);
  };
  return (
    <div data-slot="selector-zona" className="sticky top-12 z-[5] -mx-3 -mt-3.5 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden">
      <Link href={volver.href} aria-label={`Volver a ${volver.texto}`} className="flex h-9 max-w-[38%] shrink-0 items-center gap-0.5 rounded-md pr-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground">
        <ChevronLeft className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span className="truncate">{volver.texto}</span>
      </Link>
      <NativeSelect aria-label={etiqueta} value={valor} onChange={(e) => elegir(e.target.value)} className="h-9 font-medium">
        {grupos.filter((g) => g.opciones.length > 0).map((g) => (
          <NativeSelectOptGroup key={g.nombre} label={g.nombre}>
            {g.opciones.map((o) => <NativeSelectOption key={o.valor} value={o.valor}>{o.texto}</NativeSelectOption>)}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Lleva a la vista el apartado elegido: a las pestañas en pantalla ancha y, en el móvil (donde están ocultas), arriba del todo. */
export function verApartado(id: string) {
  const pestanas = document.getElementById(id);
  if (pestanas && pestanas.offsetParent !== null) pestanas.scrollIntoView({ block: "start" });
  else window.scrollTo({ top: 0 });
}
