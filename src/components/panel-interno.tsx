"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronRight, Ellipsis, Gauge, Inbox, ListChecks, ListTodo, LogOut, Moon, Search, Sun, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Collapsible as Plegable } from "radix-ui";
import { BotonMenu } from "./boton-menu";
import { Marca } from "./marca";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { BuscadorOps } from "./ops/buscador-ops";
import { NavegacionProvider, agrupar, estadoInstalacion, useNavegacion } from "./ops/navegacion";
import { MarcadorNave, Punto } from "./ops/punto";
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
      <SidebarProvider className="gx-ops gx-nuevo bg-background text-foreground">
        <Barra ruta={ruta} oscuro={oscuro} cambiarTema={cambiarTema} salir={salir} buscar={() => setBuscando(true)} />
        <SidebarInset className="min-w-0 bg-background">
          {/* En el móvil, arriba el menú, la marca y el usuario (como en cualquier app); abajo las secciones de cada día, al alcance del pulgar. */}
          <header data-slot="ops-arriba" className="sticky top-0 z-10 flex h-12 items-center gap-1 border-b bg-background/90 px-3 backdrop-blur md:hidden">
            <BotonMenu />
            <Link href="/ops" className="flex items-center gap-1.5" aria-label="Gradiox, panel interno">
              <Marca size={20} />
              <span className="font-[family-name:var(--gx-letra-logo)] text-sm font-semibold text-primary">ops</span>
            </Link>
            <span className="flex-1" />
            <UsuarioOps oscuro={oscuro} cambiarTema={cambiarTema} salir={() => void salir()} buscar={() => setBuscando(true)} />
          </header>
          <div className="gx-panel-cuerpo">{children}</div>
          <AbajoOps ruta={ruta} buscar={() => setBuscando(true)} />
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
                <Link href="/ops"><Inbox className={icono} strokeWidth={1.6} aria-hidden="true" />Inicio</Link>
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
                // Dentro de cada cliente, sus naves; cada una con el punto de su conexión, si la tiene.
                const naves = c.tecnicas.map((t) => ({ ...t, conexion: suyas.find((p) => p.ubicacion === t.id) }));
                const sueltas = suyas.filter((p) => !c.tecnicas.some((t) => t.id === p.ubicacion));
                const activo = enCliente(c.id) || suyas.some((p) => enInstalacion(p.id));
                return (
                  <Plegable.Root key={c.id} asChild defaultOpen={activo || naves.length > 0}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={ruta === `/ops/clientes/${c.id}`} tooltip={c.nombre}>
                        <Link href={`/ops/clientes/${c.id}`}>
                          <span className="flex size-[18px] shrink-0 items-center justify-center rounded bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</span>
                          <span className="truncate">{c.nombre}</span>
                        </Link>
                      </SidebarMenuButton>
                      {naves.length + sueltas.length > 0 && (
                        <>
                          <Plegable.Trigger asChild>
                            <SidebarMenuAction className="data-[state=open]:rotate-90" aria-label={`Naves de ${c.nombre}`}>
                              <ChevronRight strokeWidth={1.6} />
                            </SidebarMenuAction>
                          </Plegable.Trigger>
                          <Plegable.Content>
                            <SidebarMenuSub>
                              {naves.map((n) => {
                                const e = n.conexion ? estadoInstalacion(n.conexion, ahora) : { tono: "neutro" as const, texto: "Sin conectar" };
                                return <Instalacion key={n.id} href={`/ops/clientes/${c.id}/naves/${n.id}`} nombre={n.nombre} tono={e.tono} estado={e.texto} activa={ruta.startsWith(`/ops/clientes/${c.id}/naves/${n.id}`)} />;
                              })}
                              {sueltas.map((p) => <Instalacion key={p.id} href={`/ops/instalaciones/${p.id}`} nombre={p.nombre} tono={estadoInstalacion(p, ahora).tono} estado={`${estadoInstalacion(p, ahora).texto}, sin nave`} activa={enInstalacion(p.id)} />)}
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
                        <MarcadorNave tono={e.tono} />
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
                <Link href="/ops/arranque"><Gauge className={icono} strokeWidth={1.6} aria-hidden="true" />Arranque (simulado)</Link>
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

function Instalacion({ href, nombre, tono, estado, activa }: { href: string; nombre: string; tono: Parameters<typeof Punto>[0]["tono"]; estado: string; activa: boolean }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={activa}>
        <Link href={href} title={estado}>
          <MarcadorNave tono={tono} />
          <span className="truncate">{nombre}</span>
          <span className="sr-only">, {estado}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

/** La barra de abajo del móvil, como en una app: las cuatro secciones de cada día y «Más», que abre el menú entero. */
function AbajoOps({ ruta, buscar }: { ruta: string; buscar: () => void }) {
  const { openMobile, setOpenMobile } = useSidebar();
  const enCliente = ruta.startsWith("/ops/clientes") || ruta.startsWith("/ops/instalaciones");
  const elementos = [
    { href: "/ops", texto: "Inicio", Icono: Inbox, activo: ruta === "/ops" },
    { href: "/ops/clientes", texto: "Clientes", Icono: Building2, activo: enCliente },
    { href: "/ops/tareas", texto: "Tareas", Icono: ListTodo, activo: ruta.startsWith("/ops/tareas") },
  ];
  const clase = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md border-0 bg-transparent text-xs font-medium text-muted-foreground no-underline aria-[current=page]:text-primary";
  const otra = !openMobile && !elementos.some((e) => e.activo);
  return (
    <nav data-slot="ops-abajo" aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t bg-background/95 px-2 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {elementos.slice(0, 2).map(({ href, texto, Icono, activo }) => (
        <Link key={href} href={href} aria-current={activo && !openMobile ? "page" : undefined} className={clase}><Icono className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />{texto}</Link>
      ))}
      <button type="button" onClick={buscar} className={clase}><Search className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />Buscar</button>
      {elementos.slice(2).map(({ href, texto, Icono, activo }) => (
        <Link key={href} href={href} aria-current={activo && !openMobile ? "page" : undefined} className={clase}><Icono className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />{texto}</Link>
      ))}
      <button type="button" aria-expanded={openMobile} aria-current={openMobile || otra ? "page" : undefined} onClick={() => setOpenMobile(!openMobile)} className={clase}><Ellipsis className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />Más</button>
    </nav>
  );
}

/** El botón de usuario de arriba a la derecha en el móvil: quién está dentro, buscar, tema y salir. */
function UsuarioOps({ oscuro, cambiarTema, salir, buscar }: { oscuro: boolean; cambiarTema: () => void; salir: () => void; buscar: () => void }) {
  const Tema = oscuro ? Sun : Moon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-slot="usuario-ops" aria-label="Tu usuario: tema y salir" className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-transparent hover:bg-accent">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-[18px]" strokeWidth={1.6} aria-hidden="true" /></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">Equipo Gradiox</span>
          <span className="block text-xs text-muted-foreground">Panel interno</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={buscar}><Search strokeWidth={1.6} aria-hidden="true" />Buscar</DropdownMenuItem>
        <DropdownMenuItem onSelect={cambiarTema}><Tema strokeWidth={1.6} aria-hidden="true" />{oscuro ? "Tema claro" : "Tema oscuro"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={salir}><LogOut strokeWidth={1.6} aria-hidden="true" />Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
