import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tono } from "./navegacion";

const COLOR: Record<Tono, string> = {
  bien: "bg-bien",
  aviso: "bg-aviso",
  mal: "bg-mal",
  azul: "bg-primary",
  neutro: "border-[1.5px] border-muted-foreground bg-transparent",
};

/** El punto de color que dice cómo está una instalación. Va siempre con su texto al lado o en la etiqueta. */
export function Punto({ tono, className }: { tono: Tono; className?: string }) {
  return <span aria-hidden="true" data-slot="punto" className={cn("inline-block size-2 shrink-0 rounded-full", COLOR[tono], className)} />;
}

const VARIANTE: Record<Tono, "bien" | "aviso" | "mal" | "acento" | "secondary"> = { bien: "bien", aviso: "aviso", mal: "mal", azul: "acento", neutro: "secondary" };

/** Estado en una insignia: punto y palabra. */
export function Estado({ tono, texto }: { tono: Tono; texto: string }) {
  return (
    <Badge data-slot="estado" variant={VARIANTE[tono]} className={cn("h-6 gap-1.5 px-2", tono === "neutro" && "text-muted-foreground")}>
      <Punto tono={tono} className={tono === "neutro" ? undefined : "bg-current"} />
      {texto}
    </Badge>
  );
}

/** Los tonos de las etiquetas antiguas (gx-chip) en los de las piezas nuevas. */
export const DE_CHIP: Record<string, Tono> = { correcto: "bien", aviso: "aviso", error: "mal", azul: "azul", neutro: "neutro" };

/** Color de texto de cada tono, para teñir un icono con el estado. */
export const TEXTO_TONO: Record<Tono, string> = { bien: "text-bien", aviso: "text-aviso", mal: "text-mal", azul: "text-primary", neutro: "text-muted-foreground" };

/** Una nave es un sitio: se marca con un marcador de mapa, del color de su estado. Va siempre con su texto (visible o para lectores). */
export function MarcadorNave({ tono, className }: { tono: Tono; className?: string }) {
  // Dentro de un span: las piezas que tiñen sus iconos hijos directos (barra lateral, menús) no le quitan el color.
  return (
    <span aria-hidden="true" data-slot="marcador-nave" className={cn("inline-flex shrink-0", TEXTO_TONO[tono], className)}>
      <MapPin strokeWidth={1.8} className="size-4 text-current" />
    </span>
  );
}
