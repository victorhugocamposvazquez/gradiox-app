"use client";

// «Mi instalación» junta en un solo sitio lo que antes eran tres entradas del menú
// (Conexiones, Sistema y Naves): una pestaña para cada una, con su propia dirección.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Cable, Warehouse } from "lucide-react";
import { useNaveViva } from "@/vivo/cliente";

export const PESTANAS_INSTALACION = [
  { href: "/conexiones", texto: "Conexiones", Icono: Cable },
  { href: "/sistema", texto: "Comprobaciones", Icono: Activity },
  { href: "/instalaciones", texto: "Instalaciones", Icono: Warehouse, equipo: true },
] as const;

/** Rutas que cuelgan de «Mi instalación», para marcarla en el menú. */
export const enMiInstalacion = (ruta: string) => PESTANAS_INSTALACION.some((p) => ruta.startsWith(p.href));

export function PestanasInstalacion() {
  const ruta = usePathname();
  const { vivo } = useNaveViva();
  // Las naves de todos los clientes solo las ve el equipo de Gradiox; el cliente ve la suya.
  const pestanas = PESTANAS_INSTALACION.filter((p) => !("equipo" in p) || vivo.quien !== "cliente");
  return (
    <div className="mb-4 flex flex-col gap-2">
      <p className="m-0 text-[13px] font-medium text-muted-foreground">Mi instalación</p>
      <nav aria-label="Mi instalación" className="-mx-1 flex max-w-full gap-1 overflow-x-auto border-b border-border px-1">
        {pestanas.map(({ href, texto, Icono }) => {
          const activa = ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? "page" : undefined}
              className="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-colors hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              <Icono className="size-4" strokeWidth={1.6} aria-hidden="true" />
              {texto}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
