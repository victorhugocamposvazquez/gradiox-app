"use client";

import { useRouter } from "next/navigation";
import { Building2, Gauge, ListChecks, ListTodo, LogOut, Plus, RadioTower, SunMoon } from "lucide-react";
import { useEffect } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { agrupar, estadoInstalacion, useNavegacion } from "./navegacion";
import { Punto } from "./punto";

/**
 * El buscador del panel (⌘K o Ctrl+K): lleva a cualquier cliente, instalación o
 * apartado, y hace las acciones más comunes, sin cambiar de pantalla para buscar.
 */
export function BuscadorOps({ abierto, alCambiar, cambiarTema, salir }: { abierto: boolean; alCambiar: (abierto: boolean) => void; cambiarTema: () => void; salir: () => void }) {
  const router = useRouter();
  const { clientes, instalaciones, ahora } = useNavegacion();

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() === "k" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        alCambiar(!abierto);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, alCambiar]);

  const ir = (href: string) => {
    alCambiar(false);
    router.push(href);
  };
  const nombreCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]));
  const grupos = agrupar(clientes ?? [], instalaciones ?? []);
  const item = "gap-2.5 py-2";

  return (
    <CommandDialog open={abierto} onOpenChange={alCambiar} title="Buscar o ir a" description="Escribe el nombre de un cliente, una instalación o lo que quieres hacer." className="top-[18%] translate-y-0 sm:max-w-xl">
      <CommandInput placeholder="Cliente, instalación o lo que quieres hacer…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No hay nada con ese nombre.</CommandEmpty>
        {(instalaciones ?? []).length > 0 && (
          <CommandGroup heading="Instalaciones">
            {(instalaciones ?? []).map((p) => {
              const e = estadoInstalacion(p, ahora);
              const de = p.cliente ? nombreCliente.get(p.cliente) : undefined;
              return (
                <CommandItem key={p.id} value={`instalacion ${p.nombre} ${de ?? ""} ${p.id}`} onSelect={() => ir(`/ops/instalaciones/${p.id}`)} className={item}>
                  <Punto tono={e.tono} />
                  <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{de ?? (grupos.sinCliente.includes(p) ? "Sin cliente" : "")} · {e.texto}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {(clientes ?? []).length > 0 && (
          <CommandGroup heading="Clientes">
            {(clientes ?? []).map((c) => (
              <CommandItem key={c.id} value={`cliente ${c.nombre} ${c.id}`} onSelect={() => ir(`/ops/clientes/${c.id}`)} className={item}>
                <Building2 aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                <span className="text-xs text-muted-foreground">{grupos.deCliente(c.id).length} con pasarela</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Hacer">
          <CommandItem value="instalacion nueva dar de alta pasarela token" onSelect={() => ir("/ops/instalaciones?nueva=1")} className={item}><Plus aria-hidden="true" />Dar de alta una instalación</CommandItem>
          <CommandItem value="cliente nuevo dar de alta empresa" onSelect={() => ir("/ops?nuevo=1")} className={item}><Plus aria-hidden="true" />Dar de alta un cliente</CommandItem>
          <CommandItem value="tema claro oscuro" onSelect={() => { alCambiar(false); cambiarTema(); }} className={item}><SunMoon aria-hidden="true" />Cambiar entre tema claro y oscuro</CommandItem>
          <CommandItem value="salir cerrar sesion" onSelect={() => { alCambiar(false); salir(); }} className={item}><LogOut aria-hidden="true" />Salir del panel</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ir a">
          <CommandItem value="ir clientes" onSelect={() => ir("/ops")} className={item}><Building2 aria-hidden="true" />Clientes</CommandItem>
          <CommandItem value="ir instalaciones pasarelas" onSelect={() => ir("/ops/instalaciones")} className={item}><RadioTower aria-hidden="true" />Todas las instalaciones</CommandItem>
          <CommandItem value="ir arranque simulacion" onSelect={() => ir("/ops/arranque")} className={item}><Gauge aria-hidden="true" />Arranque sin espera</CommandItem>
          <CommandItem value="ir tareas" onSelect={() => ir("/ops/tareas")} className={item}><ListTodo aria-hidden="true" />Tareas</CommandItem>
          <CommandItem value="ir plan" onSelect={() => ir("/ops/plan")} className={item}><ListChecks aria-hidden="true" />Plan</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
