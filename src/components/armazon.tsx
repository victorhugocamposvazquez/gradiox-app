"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, ChartColumn, Check, ChevronDown, ClipboardCheck, Ellipsis, FileText, History, House, LayoutGrid, LifeBuoy, LogOut, Moon, Sun, TriangleAlert, Truck, Warehouse, Wrench, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EQUIPOS, proxima } from "@/lib/equipos";
import { hora } from "@/lib/formato";
import { NAVES, estadoNave } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, leer } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { Buscador } from "./buscador";
import { Marca } from "./marca";
import { prepararInstalacion } from "@/lib/instalacion";
import { GuionProvider, PanelGuion } from "./guion";
import { Vigia } from "./vigia";
import { NAVE_DEMO, claveUbicacion, elegirNave, useNaveViva, useYo } from "@/vivo/cliente";
import { MenuUsuario } from "./menu-usuario";
import { enMiInstalacion } from "./mi-instalacion";
import { MarcadorNave } from "./ops/punto";
import { resumenDe } from "@/vivo/modelo";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "./ui/sidebar";

// Cómo se pinta el estado de una nave en su marcador.
const TONO_ESTADO = { correcto: "bien", aviso: "aviso", error: "mal", sindatos: "neutro" } as const;

type Seccion = { href: string; texto: string; Icono: typeof Activity };
const HOY: Seccion = { href: "/", texto: "Hoy", Icono: House };
const SERVICIOS: Seccion = { href: "/servicios", texto: "Servicios", Icono: LayoutGrid };
const AVISOS: Seccion = { href: "/avisos", texto: "Avisos", Icono: TriangleAlert };
const TURNO: Seccion = { href: "/turno", texto: "Turno", Icono: ClipboardCheck };
const MANTENIMIENTO: Seccion = { href: "/mantenimiento", texto: "Mantenimiento", Icono: Wrench };
const RECEPCION: Seccion = { href: "/recepcion", texto: "Recepción", Icono: Truck };
const REGISTRO: Seccion = { href: "/registro", texto: "Registro", Icono: FileText };
const HISTORICOS: Seccion = { href: "/historicos", texto: "Históricos", Icono: History };
const INFORME: Seccion = { href: "/informe", texto: "Informe", Icono: ChartColumn };
const LUZ: Seccion = { href: "/luz", texto: "Luz", Icono: Zap };
const AYUDA: Seccion = { href: "/como-funciona", texto: "Cómo funciona", Icono: BookOpen };
// Conexiones, comprobaciones y naves van juntas, en pestañas, dentro de «Mi instalación».
const MI_INSTALACION: Seccion = { href: "/conexiones", texto: "Mi instalación", Icono: Warehouse };
// Arriba lo que se mira cada día; debajo, por temas, lo demás. En el móvil, las cuatro primeras van abajo y el resto en «Más».
const PRINCIPALES = [HOY, SERVICIOS, AVISOS, HISTORICOS];
const GRUPOS: { nombre: string; secciones: Seccion[]; equipo?: boolean }[] = [
  { nombre: "Día a día", secciones: [TURNO, MANTENIMIENTO, RECEPCION] },
  { nombre: "Documentos", secciones: [REGISTRO, INFORME, LUZ] },
  { nombre: "Instalación", secciones: [MI_INSTALACION, AYUDA] },
];
/** Pantallas que ya enseñan lo de una instalación conectada; las demás son de ejemplo y el menú lo dice. */
const conectada = (href: string) => ["/", "/servicios", "/historicos", "/conexiones", "/como-funciona", "/buscar", "/demostracion"].includes(href);

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" : href === MI_INSTALACION.href ? enMiInstalacion(ruta) : ruta.startsWith(href));
  const { ahora, ajustes, notis, registro, marcarLeidas } = useDemo();
  const dia = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const atrasadas = useMemo(() => (dia === null ? 0 : EQUIPOS.filter((e) => proxima(e, registro, dia * 3_600_000).dias < 0).length), [dia, registro]);
  const [menu, setMenu] = useState<"nave" | "campana" | "usuario" | null>(null);
  const naveAbierta = menu === "nave";
  const fuera = ruta === "/login" || ruta === "/presentacion" || ruta === "/pared" || ruta === "/ops" || ruta.startsWith("/ops/") || ruta.startsWith("/ficha/");
  const { viva, vivo } = useNaveViva(!fuera);
  const yo = useYo(!fuera);
  const soporte = yo?.tipo === "cliente" && yo.soporte ? yo : null;
  const nombreNave = viva ? viva.nombre : NAVES[0].nombre;
  // Con una instalación conectada elegida, estas pantallas ya enseñan lo suyo; las demás siguen con el ejemplo y lo dicen.
  const real = ["/", "/servicios", "/conexiones", "/como-funciona", "/buscar", "/demostracion"].includes(ruta) || ruta.startsWith("/historicos") || ruta.startsWith("/como-funciona/");
  const deEjemplo = !!viva && !real;
  const cambiar = (id: string) => {
    elegirNave(id);
    setMenu(null);
  };
  const campanaAbierta = menu === "campana";
  useEffect(() => {
    setMenu(null);
  }, [ruta]);
  useEffect(() => {
    if (!menu) return;
    const fuera = (ev: PointerEvent) => {
      if (!(ev.target as Element).closest?.(".gx-menu")) setMenu(null);
    };
    const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);
  const cuandoNoti = (t: number) => {
    const d = new Date(t);
    return ahora !== null && new Date(ahora).toDateString() === d.toDateString() ? hora(t) : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, ${hora(t)}`;
  };
  const sinLeer = notis.filter((n) => !n.leida).length;
  const estados = ahora === null ? [] : CAMARAS.map((c) => leer(c, ahora, ajustes).estado);
  const alarmas = estados.filter((e) => e === "error").length;
  const mudos = estados.filter((e) => e === "sindatos").length;
  const cortes = ajustes.cortes ?? {};
  const caidos = cortes[PASARELA.id] !== undefined ? AUTOMATAS.length + 1 : AUTOMATAS.filter((a) => cortes[a.id] !== undefined).length;
  // La pestaña del navegador también avisa, por si Gradiox está en segundo plano.
  useEffect(() => {
    const titulo = alarmas ? `(${alarmas}) Alarma · Gradiox` : mudos ? `(${mudos}) Sin datos · Gradiox` : "Gradiox";
    if (document.title !== titulo) document.title = titulo;
  }, [alarmas, mudos, ahora, ruta]);
  const globo = (href: string) =>
    href === "/avisos" && alarmas > 0 ? { n: alarmas, texto: `${alarmas} en alarma`, suave: false }
    : href === "/mantenimiento" && atrasadas > 0 ? { n: atrasadas, texto: `${atrasadas} revisiones atrasadas`, suave: true }
    : href === MI_INSTALACION.href && caidos > 0 ? { n: caidos, texto: `${caidos} sin conexión`, suave: false }
    : null;
  const elemento = ({ href, texto, Icono }: Seccion) => {
    const g = globo(href);
    const ejemplo = !!viva && !conectada(href);
    return (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton asChild isActive={activa(href)}>
          <Link href={href}>
            <Icono className="size-4" strokeWidth={1.6} aria-hidden="true" />
            <span className={ejemplo ? "text-muted-foreground" : undefined}>{texto}</span>
            {ejemplo && <span className="sr-only">, de ejemplo</span>}
          </Link>
        </SidebarMenuButton>
        {g ? (
          <SidebarMenuBadge className={g.suave ? "bg-aviso-fondo text-aviso" : "bg-mal text-white dark:text-background"} aria-label={g.texto}>{g.n}</SidebarMenuBadge>
        ) : ejemplo ? (
          <SidebarMenuBadge className="font-normal text-muted-foreground" aria-hidden="true">Ejemplo</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    );
  };
  const abajo = ({ href, texto, Icono }: Seccion) => {
    const g = globo(href);
    return (
      <Link key={href} href={href} aria-current={activa(href) ? "page" : undefined} className="relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground">
        <Icono className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        {texto}
        {g && <span className={`absolute top-1 left-[58%] flex h-4 min-w-4 items-center justify-center rounded px-1 text-[12px] leading-none ${g.suave ? "bg-aviso-fondo text-aviso" : "bg-mal text-white dark:text-background"}`} aria-label={g.texto}>{g.n}</span>}
      </Link>
    );
  };
  useEffect(() => prepararInstalacion(), []);
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.theme === "dark"), []);
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
  const Tema = oscuro ? Sun : Moon;
  const salir = async () => {
    await fetch("/api/sesion", { method: "DELETE" }).catch(() => null);
    window.location.assign("/login");
  };
  // La entrada va sola, sin menú.
  // El panel interno tampoco usa este menú: tiene el suyo.
  if (fuera) return <>{children}</>;
  return (
    <GuionProvider>
      <SidebarProvider className="gx-nuevo gx-app bg-background text-foreground">
        <Lado ruta={ruta} elemento={elemento} demo={viva ? `Viendo ${viva.nombre}: lecturas de su pasarela. Lo marcado «Ejemplo» aún no está conectado y usa datos simulados.` : vivo.instalaciones?.length ? "Nave de demostración: datos simulados en el navegador." : "Demostración con datos simulados. No hay ninguna instalación conectada."} salir={salir} />
        <SidebarInset className="min-w-0 bg-background">
          <main className="gx-principal">
          <div className="gx-arriba">
            <SidebarTrigger className="md:hidden" aria-label="Abrir el menú" />
            <Link href="/" className="gx-arriba-marca" aria-label="Gradiox, inicio">
              <Marca size={24} />
            </Link>
            <Buscador />
            <span className="hueco" />
            <Link href="/sistema" className={`gx-pildora vivo${caidos ? " mal" : ""}`} aria-label={caidos ? `Comprobaciones: ${caidos} sin conexión` : "Comprobaciones: en vivo, todo conectado"}>
              <i className={`gx-punto${caidos ? " error" : ""}`} />
              <span>{caidos ? "Sin conexión" : "En vivo"}</span>
              {ahora !== null && !caidos && <time>{new Date(ahora).toLocaleTimeString("es-ES")}</time>}
            </Link>
            <div className="gx-menu gx-menu-nave">
              <button type="button" className="gx-pildora nave" aria-haspopup="true" aria-expanded={naveAbierta} aria-controls="gx-naves-menu" aria-label={`Nave: ${nombreNave}. Cambiar de nave`} title={nombreNave} onClick={() => setMenu(naveAbierta ? null : "nave")}>
                {viva && <MarcadorNave tono={viva.conectada ? "bien" : "neutro"} />}
                <span>{nombreNave}</span>
                <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
              {naveAbierta && ahora !== null && (
                <div id="gx-naves-menu" className="gx-flotante gx-naves-menu">
                  {(() => {
                    const ubs = vivo.ubicaciones ?? [];
                    const esCliente = vivo.quien === "cliente";
                    const grupos = new Map<string, { nombre: string; ubs: typeof ubs }>();
                    for (const u of ubs) {
                      const k = u.cliente?.id ?? "";
                      const g = grupos.get(k) ?? { nombre: u.cliente?.nombre ?? "Sin cliente asignado", ubs: [] };
                      g.ubs.push(u);
                      grupos.set(k, g);
                    }
                    const demo = NAVES.find((n) => !n.ejemplo)!;
                    const ed = estadoNave(demo, 0, ahora, ajustes);
                    const filaDemo = (
                      <li key="demo" aria-current={!viva ? "true" : undefined}>
                        <button type="button" onClick={() => cambiar(NAVE_DEMO)}>
                          <MarcadorNave tono={TONO_ESTADO[ed.estado]} />
                          <span>
                            <strong>{demo.nombre}</strong>
                            <small>{demo.servicios} servicios · {ed.resumen} · datos simulados</small>
                          </span>
                          {!viva && <Check size={18} strokeWidth={1.8} aria-label="Es la que estás viendo" />}
                        </button>
                      </li>
                    );
                    const listas = [...grupos.values()].map((g, gi) => (
                      <div key={g.nombre + gi}>
                        <small>{g.nombre} · ubicaciones</small>
                        <ul>
                          {g.ubs.map((x) => {
                            const r = resumenDe(x);
                            const esta = viva !== null && claveUbicacion(viva) === claveUbicacion(x);
                            const nombres = x.instalaciones.map((y) => y.nombre);
                            return (
                              <li key={claveUbicacion(x)} aria-current={esta ? "true" : undefined}>
                                <button type="button" onClick={() => cambiar(claveUbicacion(x))}>
                                  <MarcadorNave tono={TONO_ESTADO[r.estado]} />
                                  <span>
                                    <strong>{x.nombre}</strong>
                                    <small>{x.servicios.length} servicios · {r.titular}</small>
                                    {(nombres.length > 1 || nombres[0] !== x.nombre) && <small>{nombres.length === 1 ? "Instalación" : "Instalaciones"}: {nombres.join(", ")}</small>}
                                  </span>
                                  {esta && <Check size={18} strokeWidth={1.8} aria-label="Es la que estás viendo" />}
                                </button>
                              </li>
                            );
                          })}
                          {esCliente && vivo.demo && gi === 0 && filaDemo}
                        </ul>
                      </div>
                    ));
                    return (
                      <>
                        {listas}
                        {esCliente && vivo.demo && ubs.length === 0 && <ul>{filaDemo}</ul>}
                        {!esCliente && (
                          <>
                            <small>Demostración</small>
                            <ul>{filaDemo}</ul>
                            <small>Ejemplos de la lista · solo los ve el equipo de Gradiox</small>
                            <ul>
                              {NAVES.map((n, i) => {
                                if (!n.ejemplo) return null;
                                const e = estadoNave(n, i, ahora, ajustes);
                                return (
                                  <li key={n.id} className="ejemplo">
                                    <MarcadorNave tono={TONO_ESTADO[e.estado]} />
                                    <span>
                                      <strong>{n.nombre}</strong>
                                      <small>{n.servicios} servicios · {e.resumen}</small>
                                    </span>
                                    <span className="gx-chip neutro">Ejemplo</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </>
                        )}
                      </>
                    );
                  })()}
                  {vivo.quien !== "cliente" && <Link href="/naves" className="gx-volver">Ver todas las naves</Link>}
                </div>
              )}
            </div>
            <div className="gx-menu gx-menu-campana">
              <button type="button" className="gx-pildora redonda" aria-haspopup="true" aria-expanded={campanaAbierta} aria-controls="gx-notis-menu" aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"} onClick={() => setMenu(campanaAbierta ? null : "campana")}>
                <Bell size={17} strokeWidth={1.6} aria-hidden="true" />
                {sinLeer > 0 && <span className="gx-globo azul" aria-hidden="true">{sinLeer > 9 ? "9+" : sinLeer}</span>}
              </button>
              {campanaAbierta && (
                <div id="gx-notis-menu" className="gx-flotante gx-notis-menu">
                  <div className="gx-fila">
                    <small className="gx-flotante-titulo">Notificaciones{sinLeer ? ` · ${sinLeer} sin leer` : ""}</small>
                    {sinLeer > 0 && <button type="button" className="gx-boton-enlace" onClick={() => marcarLeidas()}>Marcar todo como leído</button>}
                  </div>
                  {notis.length === 0 ? (
                    <p className="gx-nota">Ninguna desde que abriste Gradiox.</p>
                  ) : (
                    <ul>
                      {notis.slice(0, 6).map((n) => (
                        <li key={n.id} className={n.leida ? "leida" : undefined}>
                          <Link href={n.href} onClick={() => marcarLeidas(n.id)}>
                            <i className={`gx-punto ${n.tipo === "alarma" || n.tipo === "conexion" ? "error" : n.tipo === "recuperado" ? "" : "aviso"}`} />
                            <span>
                              <strong>{n.titulo}</strong>
                              <small>{n.texto}</small>
                            </span>
                            <time>{cuandoNoti(n.cuando)}</time>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/notificaciones" className="gx-volver">Ver todas y los ajustes</Link>
                </div>
              )}
            </div>
            <button type="button" className="gx-pildora redonda" aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onClick={cambiarTema}>
              <Tema size={19} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <MenuUsuario abierto={menu === "usuario"} alAbrir={(si) => setMenu(si ? "usuario" : null)} salir={salir} />
          </div>
          {soporte && (
            <p className="gx-soporte" role="status">
              <span><LifeBuoy size={16} strokeWidth={1.7} aria-hidden="true" /> Visita de soporte: ves la app como la ve {soporte.empresa || "este cliente"}. Solo ver, hasta las {hora(soporte.soporte!)}. Queda apuntada.</span>
              <button type="button" onClick={salir}>Terminar la visita</button>
            </p>
          )}
          {deEjemplo && (
            <p className="gx-de-ejemplo" role="note">
              <TriangleAlert size={16} strokeWidth={1.7} aria-hidden="true" />
              <span>
                Esta pantalla todavía no está conectada a {nombreNave}: lo que ves aquí es un ejemplo con datos simulados, no lo que pasa en la instalación. Lo real está en <Link href="/">Hoy</Link>, <Link href="/servicios">Servicios</Link>, <Link href="/historicos">Históricos</Link> y <Link href="/conexiones">Conexiones</Link>.
              </span>
            </p>
          )}
            {children}
          </main>
        </SidebarInset>
        <Vigia />
        <PanelGuion />
        <Abajo ruta={ruta} abajo={abajo} avisoMas={atrasadas + caidos} />
      </SidebarProvider>
    </GuionProvider>
  );
}

/** La barra de la izquierda (en el móvil, la que abre «Más»): lo de cada día arriba y el resto por temas. */
function Lado({ ruta, elemento, demo, salir }: { ruta: string; elemento: (s: Seccion) => ReactNode; demo: string; salir: () => void }) {
  const { setOpenMobile } = useSidebar();
  // En el móvil la barra se cierra sola al elegir un sitio.
  useEffect(() => setOpenMobile(false), [ruta, setOpenMobile]);
  return (
    <Sidebar>
      <SidebarHeader className="px-3 pt-3">
        <Link href="/" className="flex items-center px-1" aria-label="Gradiox, inicio">
          <Marca size={24} />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>{PRINCIPALES.map(elemento)}</SidebarMenu>
        </SidebarGroup>
        {GRUPOS.map((g) => (
          <SidebarGroup key={g.nombre}>
            <SidebarGroupLabel>{g.nombre}</SidebarGroupLabel>
            <SidebarMenu>{g.secciones.map(elemento)}</SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t">
        <p className="px-2 text-xs leading-snug text-muted-foreground">{demo}</p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={salir}><LogOut className="size-4" strokeWidth={1.6} aria-hidden="true" />Salir</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** En el móvil: las cuatro de cada día abajo y «Más», que abre la barra con todo lo demás. */
function Abajo({ ruta, abajo, avisoMas }: { ruta: string; abajo: (s: Seccion) => ReactNode; avisoMas: number }) {
  const { openMobile, setOpenMobile } = useSidebar();
  const enOtra = !PRINCIPALES.some((x) => (x.href === "/" ? ruta === "/" : ruta.startsWith(x.href)));
  return (
    <nav data-slot="abajo" aria-label="Secciones" className="gx-no-imprimir fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t bg-background/95 px-2 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {PRINCIPALES.map(abajo)}
      <button type="button" data-slot="mas" aria-expanded={openMobile} onClick={() => setOpenMobile(!openMobile)} className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium ${enOtra || openMobile ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
        <Ellipsis className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        Más
        {avisoMas > 0 && <span className="absolute top-1 left-[58%] flex h-4 min-w-4 items-center justify-center rounded bg-aviso-fondo px-1 text-[12px] leading-none text-aviso" aria-hidden="true">{avisoMas}</span>}
      </button>
    </nav>
  );
}
