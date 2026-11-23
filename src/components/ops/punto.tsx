import { cn } from "@/lib/utils";
import type { Tono } from "./navegacion";

const COLOR: Record<Tono, string> = {
  bien: "bg-bien",
  aviso: "bg-aviso",
  azul: "bg-primary",
  neutro: "border-[1.5px] border-muted-foreground bg-transparent",
};

/** El punto de color que dice cómo está una instalación. Va siempre con su texto al lado o en la etiqueta. */
export function Punto({ tono, className }: { tono: Tono; className?: string }) {
  return <span aria-hidden="true" data-slot="punto" className={cn("inline-block size-2 shrink-0 rounded-full", COLOR[tono], className)} />;
}

const CHIP: Record<Tono, string> = {
  bien: "bg-bien-fondo text-bien",
  aviso: "bg-aviso-fondo text-aviso",
  azul: "bg-acento-fondo text-acento-texto",
  neutro: "bg-muted text-muted-foreground",
};

/** Estado en una etiqueta pequeña: punto y palabra. */
export function Estado({ tono, texto }: { tono: Tono; texto: string }) {
  return (
    <span data-slot="estado" className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap", CHIP[tono])}>
      <Punto tono={tono} className={tono === "neutro" ? undefined : "bg-current"} />
      {texto}
    </span>
  );
}
