"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./ui/sidebar";

/** El botón de las tres rayas que abre el menú lateral en el móvil. Va a la izquierda de la marca, como en cualquier app. */
export function BotonMenu({ aviso = 0 }: { aviso?: number }) {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <button
      type="button"
      data-slot="boton-menu"
      aria-label={aviso ? `Abrir el menú (${aviso} pendientes)` : "Abrir el menú"}
      aria-expanded={openMobile}
      onClick={() => setOpenMobile(!openMobile)}
      className="relative -ml-1 inline-flex size-10 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-foreground hover:bg-accent md:hidden"
    >
      <Menu className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />
      {aviso > 0 && <span aria-hidden="true" className="absolute top-1 right-1 size-2 rounded-full bg-aviso" />}
    </button>
  );
}
