"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronRight, Gauge, ListChecks, ListTodo, LogOut, Moon, RadioTower, Search, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Collapsible as Plegable } from "radix-ui";
import { Marca } from "./marca";
import { BuscadorOps } from "./ops/buscador-ops";
import { NavegacionProvider, agrupar, estadoInstalacion, useNavegacion } from "./ops/navegacion";
import { Punto } from "./ops/punto";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

/**
 * El armazón del panel interno de Gradiox: barra lateral con los clientes y, dentro
 * de cada uno, sus instalaciones; abajo lo que no es de nadie. El buscador (⌘K) lleva
 * a cualquier sitio. Nada de la app del cliente.
 */
export function PanelInterno({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [oscuro, setOscuro] = useState(false);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.theme === "dark"), []);
  if (ruta === "/ops/entrar") return <>{children}</>;

  const cambiarTema = () => {
    const tema = oscuro ? "light" : "dark";
    document.documentElement.dataset.theme = tema;
    setOscuro(!oscuro);
    try {
      window.localStorage.setItem("gradiox-tema", tema);
    } catch {
      // Sin almacenamiento el tema vale solo para esta visita.
    }
  };
  const salir = async () => {
    await fetch("/api/ops/sesion", { method: "DELETE" }).catch(() => null);
    window.location.assign("/ops/entrar");
  };

  return (
    <NavegacionProvider>
      <SidebarProvider className="gx-ops bg-background text-foreground">
        <Barra ruta={ruta} oscuro={oscuro} cambiarTema={cambiarTema} salir={salir} buscar={() => setBuscando(true)} />
        <SidebarInset className="min-w-0 bg-background">
          <header data-slot="ops-arriba" className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
            <SidebarTrigger aria-label="Abrir el menú" />
            <Link href="/ops" className="flex items-center gap-1.5" aria-label="Gradiox, panel interno">
              <Marca size={20} />
              <span className="font-[family-name:var(--gx-letra-logo)] text-sm font-semibold text-primary">ops</span>
            </Link>
            <button type="button" data-slot="ops-buscar" onClick={() => setBuscando(true)} className="ml-auto flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label="Buscar o ir a">
              <Search className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
            </button>
          </header>
          <div className="gx-panel-cuerpo">{children}</div>
        </SidebarInset>
        <BuscadorOps abierto={buscando} alCambiar={setBuscando} cambiarTema={cambiarTema} salir={() => void salir()} />
      </SidebarProvider>
    </NavegacionProvider>
  );
}

function Barra({ ruta, oscuro, cambiarTema, salir, buscar }: { ruta: string; oscuro: boolean; cambiarTema: () => void; salir: () => void; buscar: () => void }) {
  const { clientes, instalaciones, ahora } = useNavegacion();
  const { setOpenMobile } = useSidebar();
  // En el móvil la barra se cierra sola al elegir un sitio.
  useEffect(() => setOpenMobile(false), [ruta, setOpenMobile]);
  const grupos = agrupar(clientes ?? [], instalaciones ?? []);
  const Tema = oscuro ? Sun : Moon;
  const icono = "size-4";
  const enCliente = (id: string) => ruta.startsWith(`/ops/clientes/${id}`);
  const enInstalacion = (id: string) => ruta.startsWith(`/ops/instalaciones/${id}`);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-3 pt-3">
        <Link href="/ops" className="flex items-center gap-1.5 px-1" aria-label="Gradiox, panel interno">
          <Marca size={22} />
          <span className="mt-1 font-[family-name:var(--gx-letra-logo)] text-[15px] font-semibold text-primary">ops</span>
        </Link>
        <button type="button" data-slot="ops-buscar" onClick={buscar} className="flex h-8 w-full items-center gap-2 rounded-md border bg-card px-2.5 text-left text-[13px] text-muted-foreground shadow-xs hover:border-input">
          <Search className="size-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Buscar o ir a…</span>
          <kbd className="rounded border px-1 font-sans text-xs">⌘K</kbd>
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta === "/ops"}>
                <Link href="/ops"><Building2 className={icono} strokeWidth={1.6} aria-hidden="true" />Clientes</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta === "/ops/instalaciones"}>
                <Link href="/ops/instalaciones"><RadioTower className={icono} strokeWidth={1.6} aria-hidden="true" />Instalaciones</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {(clientes?.length ?? 0) > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Clientes</SidebarGroupLabel>
            <SidebarMenu>
              {clientes!.map((c) => {
                const suyas = grupos.deCliente(c.id);
                const activo = enCliente(c.id) || suyas.some((p) => enInstalacion(p.id));
                return (
                  <Plegable.Root key={c.id} asChild defaultOpen={activo || suyas.length > 0}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={ruta === `/ops/clientes/${c.id}`} tooltip={c.nombre}>
                        <Link href={`/ops/clientes/${c.id}`}>
                          <span className="flex size-[18px] shrink-0 items-center justify-center rounded bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</span>
                          <span className="truncate">{c.nombre}</span>
                        </Link>
                      </SidebarMenuButton>
                      {suyas.length > 0 && (
                        <>
                          <Plegable.Trigger asChild>
                            <SidebarMenuAction className="data-[state=open]:rotate-90" aria-label={`Instalaciones de ${c.nombre}`}>
                              <ChevronRight strokeWidth={1.6} />
                            </SidebarMenuAction>
                          </Plegable.Trigger>
                          <Plegable.Content>
                            <SidebarMenuSub>
                              {suyas.map((p) => <Instalacion key={p.id} id={p.id} nombre={p.nombre} tono={estadoInstalacion(p, ahora).tono} estado={estadoInstalacion(p, ahora).texto} activa={enInstalacion(p.id)} />)}
                            </SidebarMenuSub>
                          </Plegable.Content>
                        </>
                      )}
                    </SidebarMenuItem>
                  </Plegable.Root>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {grupos.sinCliente.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Sin cliente asignado</SidebarGroupLabel>
            <SidebarMenu>
              {grupos.sinCliente.map((p) => {
                const e = estadoInstalacion(p, ahora);
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton asChild isActive={enInstalacion(p.id)}>
                      <Link href={`/ops/instalaciones/${p.id}`} title={e.texto}>
                        <Punto tono={e.tono} className="mx-[5px]" />
                        <span className="truncate">{p.nombre}</span>
                        <span className="sr-only">, {e.texto}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/arranque")}>
                <Link href="/ops/arranque"><Gauge className={icono} strokeWidth={1.6} aria-hidden="true" />Arranque sin espera</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/tareas")}>
                <Link href="/ops/tareas"><ListTodo className={icono} strokeWidth={1.6} aria-hidden="true" />Tareas</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/plan")}>
                <Link href="/ops/plan"><ListChecks className={icono} strokeWidth={1.6} aria-hidden="true" />Plan</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={cambiarTema}><Tema className={icono} strokeWidth={1.6} aria-hidden="true" />{oscuro ? "Tema claro" : "Tema oscuro"}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={salir}><LogOut className={icono} strokeWidth={1.6} aria-hidden="true" />Salir</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function Instalacion({ id, nombre, tono, estado, activa }: { id: string; nombre: string; tono: Parameters<typeof Punto>[0]["tono"]; estado: string; activa: boolean }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={activa}>
        <Link href={`/ops/instalaciones/${id}`} title={estado}>
          <Punto tono={tono} />
          <span className="truncate">{nombre}</span>
          <span className="sr-only">, {estado}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
