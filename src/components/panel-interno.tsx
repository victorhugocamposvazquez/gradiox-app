"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Building2, Check, ChevronsUpDown, ClipboardList, Ellipsis, Gauge, History, Inbox, ListChecks, ListTodo, LogOut, MapPin, Moon, Plus, Search, Smartphone, Sun, UserRound } from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { BotonMenu } from "./boton-menu";
import { Marca } from "./marca";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { BuscadorOps } from "./ops/buscador-ops";
import { NavegacionProvider, agrupar, estadoInstalacion, useNavegacion } from "./ops/navegacion";
import { useRastro } from "./ops/movil";
import { MarcadorNave, Punto } from "./ops/punto";
import { pestanaPedida, type Pestana } from "@/clientes/pestanas";
import type { ResumenCliente } from "@/clientes/modelo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "./ui/sidebar";

/**
 * El armazón del panel interno de Gradiox: selector de cliente arriba (estilo workspace)
 * que cambia la barra lateral al panel dedicado del cliente activo y sus instalaciones,
 * o a la vista global de operaciones. El buscador (⌘K) lleva a cualquier sitio.
 */
export function PanelInterno({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [oscuro, setOscuro] = useState(false);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.theme === "dark"), []);
  useRastro();
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
        <Suspense fallback={<Sidebar />}>
          <Barra ruta={ruta} oscuro={oscuro} cambiarTema={cambiarTema} salir={salir} buscar={() => setBuscando(true)} />
        </Suspense>
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

/** Deduce qué cliente está abierto a partir de la ruta (ficha, instalación o pasarela suya). */
function clienteDesdeRuta(ruta: string, clientes: ResumenCliente[], pasarelas: { id: string; cliente?: string }[]): ResumenCliente | null {
  const mCli = ruta.match(/^\/ops\/clientes\/([^/]+)/);
  if (mCli && mCli[1] !== "nuevo") return clientes.find((c) => c.id === mCli[1]) ?? null;
  const mInst = ruta.match(/^\/ops\/instalaciones\/([^/]+)/);
  if (mInst) {
    const p = pasarelas.find((x) => x.id === mInst[1]);
    if (p?.cliente) return clientes.find((c) => c.id === p.cliente) ?? null;
  }
  return null;
}

function Barra({ ruta, oscuro, cambiarTema, salir, buscar }: { ruta: string; oscuro: boolean; cambiarTema: () => void; salir: () => void; buscar: () => void }) {
  const { clientes, instalaciones, ahora } = useNavegacion();
  const { setOpenMobile } = useSidebar();
  const busqueda = useSearchParams();
  // En el móvil la barra se cierra sola al elegir un sitio.
  useEffect(() => setOpenMobile(false), [ruta, setOpenMobile]);
  const listaClientes = clientes ?? [];
  const listaPasarelas = instalaciones ?? [];
  const grupos = agrupar(listaClientes, listaPasarelas);
  const clienteActivo = clienteDesdeRuta(ruta, listaClientes, listaPasarelas);
  const pasoActivo: Pestana = pestanaPedida(busqueda.get("paso")) ?? "resumen";
  const Tema = oscuro ? Sun : Moon;
  const icono = "size-4";
  const enInstalacion = (id: string) => ruta.startsWith(`/ops/instalaciones/${id}`);

  return (
    <Sidebar>
      <SidebarHeader className="gap-2.5 px-3 pt-3">
        <div className="flex items-center justify-between px-1">
          <Link href="/ops" className="flex items-center gap-1.5" aria-label="Gradiox, panel interno">
            <Marca size={20} />
            <span className="mt-0.5 font-[family-name:var(--gx-letra-logo)] text-sm font-semibold text-primary">ops</span>
          </Link>
          <button
            type="button"
            data-slot="ops-buscar"
            onClick={buscar}
            aria-label="Buscar o ir a (⌘K)"
            className="flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs text-muted-foreground hover:border-input hover:text-foreground"
          >
            <Search className="size-3.5" strokeWidth={1.6} aria-hidden="true" />
            <kbd className="font-sans text-xs">⌘K</kbd>
          </button>
        </div>

        <SelectorCliente clientes={listaClientes} activo={clienteActivo} />
      </SidebarHeader>

      <SidebarContent>
        {clienteActivo ? (
          <MenuClienteDedicado
            cliente={clienteActivo}
            pasarelas={grupos.deCliente(clienteActivo.id)}
            ahora={ahora}
            ruta={ruta}
            pasoActivo={pasoActivo}
            enInstalacion={enInstalacion}
          />
        ) : (
          <>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta === "/ops"}>
                    <Link href="/ops"><Inbox className={icono} strokeWidth={1.6} aria-hidden="true" />Inicio</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta === "/ops/clientes" || ruta === "/ops/clientes/nuevo"}>
                    <Link href="/ops/clientes" className="justify-between">
                      <span className="flex items-center gap-2"><Building2 className={icono} strokeWidth={1.6} aria-hidden="true" />Clientes</span>
                      {listaClientes.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{listaClientes.length}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            {listaClientes.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Acceso directo</SidebarGroupLabel>
                <SidebarMenu>
                  {listaClientes.map((c) => {
                    const nInst = c.tecnicas.length;
                    return (
                      <SidebarMenuItem key={c.id}>
                        <SidebarMenuButton asChild tooltip={c.nombre}>
                          <Link href={`/ops/clientes/${c.id}`}>
                            <span className="flex size-[18px] shrink-0 items-center justify-center rounded bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">
                              {c.nombre.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <span className="flex-1 truncate">{c.nombre || "Cliente sin nombre"}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{nInst}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
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

            {/* Apartado secundario separado de la operativa diaria (Decisión A3). */}
            <SidebarGroup className="mt-auto border-t pt-2">
              <SidebarGroupLabel>Interno y producto</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/tareas")}>
                    <Link href="/ops/tareas"><ListTodo className={icono} strokeWidth={1.6} aria-hidden="true" />Tareas</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/plan")}>
                    <Link href="/ops/plan"><ListChecks className={icono} strokeWidth={1.6} aria-hidden="true" />Hoja de ruta</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/automatizacion")}>
                    <Link href="/ops/automatizacion"><Bot className={icono} strokeWidth={1.6} aria-hidden="true" />Automatización</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={ruta.startsWith("/ops/arranque")}>
                    <Link href="/ops/arranque"><Gauge className={icono} strokeWidth={1.6} aria-hidden="true" />Arranque (simulado)</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          {clienteActivo && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/ops/clientes"><ArrowLeft className={icono} strokeWidth={1.6} aria-hidden="true" />Todos los clientes</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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

/** Selector superior de cliente estilo workspace: cambia al instante entre la vista global y el panel dedicado de cada cliente. */
function SelectorCliente({ clientes, activo }: { clientes: ResumenCliente[]; activo: ResumenCliente | null }) {
  const ir = useRouter();
  const inicial = activo ? activo.nombre.trim().charAt(0).toUpperCase() || "?" : "G";
  const sub = activo
    ? activo.tecnicas.length === 1
      ? "1 instalación"
      : `${activo.tecnicas.length} instalaciones`
    : clientes.length === 0
      ? "Sin clientes aún"
      : clientes.length === 1
        ? "1 cliente"
        : `${clientes.length} clientes`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-slot="selector-cliente"
          aria-label="Cambiar de cliente o volver a todos los clientes"
          className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:border-input hover:bg-accent/40"
        >
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${activo ? "bg-acento-fondo text-acento-texto" : "bg-muted text-foreground"}`}
            aria-hidden="true"
          >
            {inicial}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium leading-tight text-foreground">{activo ? activo.nombre || "Cliente sin nombre" : "Todos los clientes"}</span>
            <span className="truncate text-xs leading-tight text-muted-foreground">{sub}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem onSelect={() => ir.push("/ops")}>
          <Inbox className="size-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Todos los clientes (Ops)</span>
          {!activo && <Check className="size-3.5 text-primary" aria-hidden="true" />}
        </DropdownMenuItem>
        {clientes.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Panel dedicado por cliente</DropdownMenuLabel>
            {clientes.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => ir.push(`/ops/clientes/${c.id}`)}>
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">
                  {c.nombre.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="flex-1 truncate">{c.nombre || "Cliente sin nombre"}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{c.tecnicas.length}</span>
                {activo?.id === c.id && <Check className="size-3.5 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ir.push("/ops/clientes/nuevo")}>
          <Plus className="size-4" strokeWidth={1.6} aria-hidden="true" />
          <span>Cliente nuevo</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra lateral dedicada cuando hay un cliente elegido: primero sus instalaciones (con estado vivo) y debajo las secciones de su ficha. */
function MenuClienteDedicado({
  cliente,
  pasarelas,
  ahora,
  ruta,
  pasoActivo,
  enInstalacion,
}: {
  cliente: ResumenCliente;
  pasarelas: ReturnType<ReturnType<typeof agrupar>["deCliente"]>;
  ahora: number;
  ruta: string;
  pasoActivo: Pestana;
  enInstalacion: (id: string) => boolean;
}) {
  const naves = cliente.tecnicas.map((t) => ({ ...t, conexion: pasarelas.find((p) => p.ubicacion === t.id) }));
  const sueltas = pasarelas.filter((p) => !cliente.tecnicas.some((t) => t.id === p.ubicacion));
  const enFichaBase = ruta === `/ops/clientes/${cliente.id}`;
  const icono = "size-4";

  const secciones: { id: Pestana; texto: string; Icono: typeof ListChecks }[] = [
    { id: "resumen", texto: "Resumen", Icono: ListChecks },
    { id: "datos", texto: "Datos y visita", Icono: ClipboardList },
    { id: "instalaciones", texto: "Instalaciones", Icono: MapPin },
    { id: "app", texto: "Acceso a la app", Icono: Smartphone },
    { id: "historial", texto: "Historial", Icono: History },
  ];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Instalaciones ({naves.length})</SidebarGroupLabel>
        <SidebarMenu>
          {naves.map((n) => {
            const e = n.conexion ? estadoInstalacion(n.conexion, ahora) : { tono: "neutro" as const, texto: "Sin conectar" };
            const href = `/ops/clientes/${cliente.id}/instalaciones/${n.id}`;
            return <Instalacion key={n.id} href={href} nombre={n.nombre} tono={e.tono} estado={e.texto} activa={ruta.startsWith(href)} />;
          })}
          {sueltas.map((p) => {
            const e = estadoInstalacion(p, ahora);
            return <Instalacion key={p.id} href={`/ops/instalaciones/${p.id}`} nombre={p.nombre} tono={e.tono} estado={`${e.texto}, sin instalación`} activa={enInstalacion(p.id)} />;
          })}
          {naves.length === 0 && sueltas.length === 0 && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={`/ops/clientes/${cliente.id}?paso=instalaciones`} className="text-muted-foreground">
                  <Plus className={icono} strokeWidth={1.6} aria-hidden="true" />Añadir primera instalación
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="border-t pt-2">
        <SidebarGroupLabel>Ficha del cliente</SidebarGroupLabel>
        <SidebarMenu>
          {secciones.map(({ id, texto, Icono }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton asChild isActive={enFichaBase && pasoActivo === id}>
                <Link href={`/ops/clientes/${cliente.id}?paso=${id}`}>
                  <Icono className={icono} strokeWidth={1.6} aria-hidden="true" />
                  <span>{texto}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}

function Instalacion({ href, nombre, tono, estado, activa }: { href: string; nombre: string; tono: Parameters<typeof Punto>[0]["tono"]; estado: string; activa: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={activa} tooltip={`${nombre} · ${estado}`}>
        <Link href={href} title={estado}>
          <MarcadorNave tono={tono} />
          <span className="flex-1 truncate">{nombre}</span>
          <span className="sr-only">, {estado}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
