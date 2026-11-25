"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, ChartColumn, Check, ChevronsUpDown, ClipboardCheck, Ellipsis, FileText, History, House, LayoutGrid, LifeBuoy, LogOut, Moon, Sun, TriangleAlert, Truck, Warehouse, Wrench, Zap } from "lucide-react";
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
import { BotonMenu } from "./boton-menu";
import { useRastro } from "./ops/movil";
import { MenuUsuario } from "./menu-usuario";
import { enMiInstalacion } from "./mi-instalacion";
import { MarcadorNave } from "./ops/punto";
import { resumenDe } from "@/vivo/modelo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar } from "./ui/sidebar";

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
const PRINCIPALES_REALES = [HOY, SERVICIOS, HISTORICOS];
const GRUPOS: { nombre: string; secciones: Seccion[]; equipo?: boolean }[] = [
  { nombre: "Día a día", secciones: [TURNO, MANTENIMIENTO, RECEPCION] },
  { nombre: "Documentos", secciones: [REGISTRO, INFORME, LUZ] },
  { nombre: "Instalación", secciones: [MI_INSTALACION, AYUDA] },
];
const GRUPOS_REALES: { nombre: string; secciones: Seccion[]; secundaria?: boolean }[] = [
  { nombre: "Instalación", secciones: [MI_INSTALACION, AYUDA] },
  { nombre: "En preparación (ejemplo)", secciones: [AVISOS, TURNO, MANTENIMIENTO, RECEPCION, REGISTRO, INFORME, LUZ], secundaria: true },
];
/** Pantallas que ya enseñan lo de una instalación conectada; las demás son de ejemplo y el menú lo dice. */
const conectada = (href: string) => ["/", "/servicios", "/historicos", "/conexiones", "/como-funciona", "/buscar", "/demostracion"].includes(href);

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  useRastro();
  const activa = (href: string) => (href === "/" ? ruta === "/" : href === MI_INSTALACION.href ? enMiInstalacion(ruta) : ruta.startsWith(href));
  const { ahora, ajustes, notis, registro, marcarLeidas } = useDemo();
  const dia = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const atrasadasDemo = useMemo(() => (dia === null ? 0 : EQUIPOS.filter((e) => proxima(e, registro, dia * 3_600_000).dias < 0).length), [dia, registro]);
  const [menu, setMenu] = useState<"campana" | "usuario" | null>(null);
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
    const clicFuera = (ev: PointerEvent) => {
      if (!(ev.target as Element).closest?.(".gx-menu")) setMenu(null);
    };
    const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", clicFuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", clicFuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);
  const cuandoNoti = (t: number) => {
    const d = new Date(t);
    return ahora !== null && new Date(ahora).toDateString() === d.toDateString() ? hora(t) : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, ${hora(t)}`;
  };

  // En una instalación real conectada no se mezclan avisos, títulos ni contadores del simulador.
  const resumenVivo = viva ? resumenDe(viva) : null;
  const alarmasVivas = viva ? viva.servicios.filter((s) => s.estado === "error").length : 0;
  const sinConexionViva = viva ? (viva.conectada ? 0 : 1) : 0;

  const sinLeerDemo = notis.filter((n) => !n.leida).length;
  const estadosDemo = ahora === null ? [] : CAMARAS.map((c) => leer(c, ahora, ajustes).estado);
  const alarmasDemo = estadosDemo.filter((e) => e === "error").length;
  const mudosDemo = estadosDemo.filter((e) => e === "sindatos").length;
  const cortesDemo = ajustes.cortes ?? {};
  const caidosDemo = cortesDemo[PASARELA.id] !== undefined ? AUTOMATAS.length + 1 : AUTOMATAS.filter((a) => cortesDemo[a.id] !== undefined).length;

  const alarmas = viva ? alarmasVivas : alarmasDemo;
  const mudos = viva ? sinConexionViva : mudosDemo;
  const caidos = viva ? sinConexionViva : caidosDemo;
  const atrasadas = viva ? 0 : atrasadasDemo;
  const sinLeer = viva ? 0 : sinLeerDemo;

  // La pestaña del navegador también avisa, siempre con los datos de la instalación activa.
  useEffect(() => {
    const titulo = viva
      ? !viva.conectada
        ? `Sin conexión · ${viva.nombre} · Gradiox`
        : alarmasVivas
          ? `(${alarmasVivas}) Alarma · ${viva.nombre} · Gradiox`
          : `${viva.nombre} · Gradiox`
      : alarmasDemo
        ? `(${alarmasDemo}) Alarma · Gradiox`
        : mudosDemo
          ? `(${mudosDemo}) Sin datos · Gradiox`
          : "Gradiox";
    if (document.title !== titulo) document.title = titulo;
  }, [viva, alarmasVivas, alarmasDemo, mudosDemo, ahora, ruta]);

  const globo = (href: string) =>
    viva
      ? href === "/servicios" && alarmas > 0
        ? { n: alarmas, texto: `${alarmas} en alarma`, suave: false }
        : href === MI_INSTALACION.href && caidos > 0
          ? { n: caidos, texto: "Sin conexión", suave: false }
          : null
      : href === "/avisos" && alarmas > 0
        ? { n: alarmas, texto: `${alarmas} en alarma`, suave: false }
        : href === "/mantenimiento" && atrasadas > 0
          ? { n: atrasadas, texto: `${atrasadas} revisiones atrasadas`, suave: true }
          : href === MI_INSTALACION.href && caidos > 0
            ? { n: caidos, texto: `${caidos} sin conexión`, suave: false }
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

  const tonoSelector: "bien" | "aviso" | "mal" | "neutro" = viva
    ? TONO_ESTADO[resumenVivo?.estado ?? (viva.conectada ? "correcto" : "sindatos")]
    : caidos
      ? "mal"
      : "neutro";
  const subSelector = viva
    ? viva.conectada
      ? viva.simulada
        ? "En vivo · simulado"
        : `${viva.servicios.length} servicios · en vivo`
      : "Sin conexión"
    : caidos
      ? "Simulado · sin conexión"
      : "Datos simulados";

  const selectorSidebar = (
    <SelectorInstalacion
      nombre={nombreNave}
      sub={subSelector}
      tono={tonoSelector}
      viva={viva}
      vivo={vivo}
      ahora={ahora}
      ajustes={ajustes}
      alElegir={cambiar}
    />
  );

  return (
    <GuionProvider>
      <SidebarProvider className="gx-nuevo gx-app bg-background text-foreground">
        <Lado
          ruta={ruta}
          viva={!!viva}
          selector={selectorSidebar}
          elemento={elemento}
          tema={{ oscuro, cambiar: cambiarTema }}
          demo={viva ? `Viendo ${viva.nombre}: lecturas reales de su pasarela.` : "Instalación de demostración con datos simulados."}
          salir={salir}
        />
        <SidebarInset className="min-w-0 bg-background">
          <main className="gx-principal">
          <div className="gx-arriba">
            <BotonMenu aviso={atrasadas + caidos} />
            <Link href="/" className="gx-arriba-marca" aria-label="Gradiox, inicio">
              <Marca size={22} />
            </Link>
            <Buscador />
            <span className="hueco max-md:hidden" />
            {/* En escritorio la píldora de estado va junto al buscador; en móvil el propio selector de instalación lleva el marcador para dejar espacio legible. */}
            <div className="hidden md:flex">
              {viva ? (
                <Link href="/conexiones" className={`gx-pildora vivo${viva.conectada ? "" : " mal"}`} aria-label={viva.conectada ? `${viva.nombre}: en vivo, leyendo de su pasarela` : `${viva.nombre}: sin conexión`}>
                  <i className={`gx-punto${viva.conectada ? "" : " error"}`} />
                  <span>{viva.conectada ? (viva.simulada ? "En vivo · simulado" : "En vivo") : "Sin conexión"}</span>
                  {ahora !== null && viva.conectada && <time>{new Date(ahora).toLocaleTimeString("es-ES")}</time>}
                </Link>
              ) : (
                <Link href="/sistema" className={`gx-pildora vivo${caidos ? " mal" : ""}`} aria-label={caidos ? `Datos simulados: ${caidos} sin conexión en la demostración` : "Datos simulados: es la instalación de demostración"}>
                  <i className={`gx-punto${caidos ? " error" : " simulado"}`} />
                  <span>{caidos ? "Simulado · sin conexión" : "Datos simulados"}</span>
                </Link>
              )}
            </div>
            {/* En móvil el selector compacto ocupa el espacio flexible entre buscador y campana; en escritorio vive en la barra lateral. */}
            <div className="min-w-0 flex-1 md:hidden">
              <SelectorInstalacion
                compacto
                nombre={nombreNave}
                sub={subSelector}
                tono={tonoSelector}
                viva={viva}
                vivo={vivo}
                ahora={ahora}
                ajustes={ajustes}
                alElegir={cambiar}
              />
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
                    {!viva && sinLeer > 0 && <button type="button" className="gx-boton-enlace" onClick={() => marcarLeidas()}>Marcar todo como leído</button>}
                  </div>
                  {viva ? (
                    <p className="gx-nota">Las notificaciones automáticas para {viva.nombre} todavía están en preparación. Los avisos reales de temperatura aparecen en Hoy y Servicios.</p>
                  ) : notis.length === 0 ? (
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
            {/* En el móvil el tema se cambia desde «Más», para dejar la barra de arriba despejada. */}
            <span className="contents max-md:hidden">
              <button type="button" className="gx-pildora redonda" aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onClick={cambiarTema}>
                <Tema size={19} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </span>
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
        {!viva && <Vigia />}
        <PanelGuion />
        <Abajo ruta={ruta} abajo={abajo} secciones={viva ? [HOY, SERVICIOS, HISTORICOS, MI_INSTALACION] : PRINCIPALES} avisoMas={atrasadas + (viva ? 0 : caidos)} />
      </SidebarProvider>
    </GuionProvider>
  );
}

/** Selector de instalación estilo workspace (en la barra lateral en escritorio y compacto en móvil). */
function SelectorInstalacion({
  compacto = false,
  nombre,
  sub,
  tono,
  viva,
  vivo,
  ahora,
  ajustes,
  alElegir,
}: {
  compacto?: boolean;
  nombre: string;
  sub: string;
  tono: "bien" | "aviso" | "mal" | "neutro";
  viva: ReturnType<typeof useNaveViva>["viva"];
  vivo: ReturnType<typeof useNaveViva>["vivo"];
  ahora: number | null;
  ajustes: ReturnType<typeof useDemo>["ajustes"];
  alElegir: (id: string) => void;
}) {
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
  const ed = ahora !== null ? estadoNave(demo, 0, ahora, ajustes) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compacto ? (
          <button
            type="button"
            data-slot="selector-nave-movil"
            aria-label={`Cambiar instalación: ${nombre}`}
            title={nombre}
            className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border bg-card px-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent/50"
          >
            <MarcadorNave tono={tono} />
            <span className="min-w-0 flex-1 truncate">{nombre}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            data-slot="selector-nave"
            aria-label={`Instalación: ${nombre}. Cambiar de instalación`}
            title={nombre}
            className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:border-input hover:bg-accent/40"
          >
            <MarcadorNave tono={tono} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight text-foreground">{nombre}</span>
              <span className="truncate text-xs leading-tight text-muted-foreground">{sub}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compacto ? "end" : "start"} className="gx-naves-menu w-72">
        {[...grupos.values()].map((g, gi) => (
          <div key={g.nombre + gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{g.nombre}</DropdownMenuLabel>
            {g.ubs.map((x) => {
              const r = resumenDe(x);
              const esta = viva !== null && claveUbicacion(viva) === claveUbicacion(x);
              return (
                <DropdownMenuItem key={claveUbicacion(x)} onSelect={() => alElegir(claveUbicacion(x))} className="items-start gap-2.5 py-2">
                  <span className="mt-0.5"><MarcadorNave tono={TONO_ESTADO[r.estado]} /></span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">{x.nombre}</span>
                    <span className="truncate text-xs text-muted-foreground">{x.servicios.length} servicios · {r.titular}</span>
                  </span>
                  {esta && <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Es la que estás viendo" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}

        {(esCliente ? vivo.demo : true) && (
          <>
            {grupos.size > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Demostración</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => alElegir(NAVE_DEMO)} className="items-start gap-2.5 py-2">
              <span className="mt-0.5"><MarcadorNave tono={ed ? TONO_ESTADO[ed.estado] : "neutro"} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">{demo.nombre}</span>
                <span className="truncate text-xs text-muted-foreground">{demo.servicios} servicios · {ed ? `${ed.resumen} · ` : ""}datos simulados</span>
              </span>
              {!viva && <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Es la que estás viendo" />}
            </DropdownMenuItem>
          </>
        )}

        {!esCliente && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Ejemplos · solo equipo Gradiox</DropdownMenuLabel>
            {NAVES.map((n, i) => {
              if (!n.ejemplo) return null;
              const e = ahora !== null ? estadoNave(n, i, ahora, ajustes) : null;
              return (
                <DropdownMenuItem key={n.id} disabled className="items-start gap-2.5 py-1.5 opacity-75">
                  <span className="mt-0.5"><MarcadorNave tono={e ? TONO_ESTADO[e.estado] : "neutro"} /></span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">{n.nombre}</span>
                    <span className="truncate text-xs text-muted-foreground">{n.servicios} servicios{e ? ` · ${e.resumen}` : ""}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Ejemplo</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/instalaciones" className="justify-center font-medium text-acento-texto">Ver todas las instalaciones</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** La barra de la izquierda (en el móvil, la que abre «Más»): marca + selector de instalación arriba, y secciones ordenadas debajo. */
function Lado({ ruta, viva, selector, elemento, demo, salir, tema }: { ruta: string; viva: boolean; selector: ReactNode; elemento: (s: Seccion) => ReactNode; demo: string; salir: () => void; tema: { oscuro: boolean; cambiar: () => void } }) {
  const { setOpenMobile } = useSidebar();
  // En el móvil la barra se cierra sola al elegir un sitio.
  useEffect(() => setOpenMobile(false), [ruta, setOpenMobile]);
  const principales = viva ? PRINCIPALES_REALES : PRINCIPALES;
  const grupos = viva ? GRUPOS_REALES : GRUPOS;
  return (
    <Sidebar>
      <SidebarHeader className="gap-2.5 px-3 pt-3">
        <Link href="/" className="flex items-center px-1" aria-label="Gradiox, inicio">
          <Marca size={22} />
        </Link>
        {selector}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>{principales.map(elemento)}</SidebarMenu>
        </SidebarGroup>
        {grupos.map((g) => (
          <SidebarGroup key={g.nombre} className={"secundaria" in g && g.secundaria ? "mt-auto border-t pt-2" : undefined}>
            <SidebarGroupLabel>{g.nombre}</SidebarGroupLabel>
            <SidebarMenu>{g.secciones.map(elemento)}</SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t">
        <p className="px-2 text-xs leading-snug text-muted-foreground">{demo}</p>
        <SidebarMenu>
          <SidebarMenuItem className="md:hidden">
            <SidebarMenuButton onClick={tema.cambiar}>
              {tema.oscuro ? <Sun className="size-4" strokeWidth={1.6} aria-hidden="true" /> : <Moon className="size-4" strokeWidth={1.6} aria-hidden="true" />}
              {tema.oscuro ? "Tema claro" : "Tema oscuro"}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={salir}><LogOut className="size-4" strokeWidth={1.6} aria-hidden="true" />Salir</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** En el móvil: las cuatro de cada día abajo y «Más», que abre la barra con todo lo demás. */
function Abajo({ ruta, abajo, secciones, avisoMas }: { ruta: string; abajo: (s: Seccion) => ReactNode; secciones: Seccion[]; avisoMas: number }) {
  const { openMobile, setOpenMobile } = useSidebar();
  const enOtra = !secciones.some((x) => (x.href === "/" ? ruta === "/" : x.href === MI_INSTALACION.href ? enMiInstalacion(ruta) : ruta.startsWith(x.href)));
  return (
    <nav data-slot="abajo" aria-label="Secciones" className="gx-no-imprimir fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t bg-background/95 px-2 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {secciones.map(abajo)}
      <button type="button" data-slot="mas" aria-expanded={openMobile} onClick={() => setOpenMobile(!openMobile)} className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium ${enOtra || openMobile ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
        <Ellipsis className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        Más
        {avisoMas > 0 && <span className="absolute top-1 left-[58%] flex h-4 min-w-4 items-center justify-center rounded bg-aviso-fondo px-1 text-[12px] leading-none text-aviso" aria-hidden="true">{avisoMas}</span>}
      </button>
    </nav>
  );
}
