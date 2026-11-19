"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, ChartColumn, Check, ChevronDown, ClipboardCheck, Ellipsis, FileText, History, House, LayoutGrid, LogOut, Moon, Sun, TriangleAlert, Truck, Warehouse, Wrench, Zap } from "lucide-react";
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
import { NAVE_DEMO, claveUbicacion, elegirNave, useNaveViva } from "@/vivo/cliente";
import { MenuUsuario } from "./menu-usuario";
import { resumenDe } from "@/vivo/modelo";

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
const SISTEMA: Seccion = { href: "/sistema", texto: "Sistema", Icono: Activity };
const AYUDA: Seccion = { href: "/como-funciona", texto: "Cómo funciona", Icono: BookOpen };
const GRUPOS: { nombre: string; secciones: Seccion[] }[] = [
  { nombre: "Ahora", secciones: [HOY, SERVICIOS, AVISOS] },
  { nombre: "Trabajo", secciones: [TURNO, MANTENIMIENTO, RECEPCION] },
  { nombre: "Documentos", secciones: [HISTORICOS, REGISTRO, INFORME] },
  { nombre: "Instalación", secciones: [LUZ, SISTEMA, AYUDA] },
];
// En el móvil caben cuatro; el resto va en «Más».
const ABAJO = [HOY, SERVICIOS, AVISOS, TURNO];
const MAS: Seccion[] = [MANTENIMIENTO, RECEPCION, HISTORICOS, REGISTRO, INFORME, LUZ, SISTEMA, { href: "/naves", texto: "Naves", Icono: Warehouse }, AYUDA];

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" : href === "/sistema" ? ruta.startsWith("/sistema") || ruta.startsWith("/conexiones") : ruta.startsWith(href));
  const { ahora, ajustes, notis, registro, marcarLeidas } = useDemo();
  const dia = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const atrasadas = useMemo(() => (dia === null ? 0 : EQUIPOS.filter((e) => proxima(e, registro, dia * 3_600_000).dias < 0).length), [dia, registro]);
  const [mas, setMas] = useState(false);
  const [menu, setMenu] = useState<"nave" | "campana" | "usuario" | null>(null);
  const naveAbierta = menu === "nave";
  const fuera = ruta === "/login" || ruta === "/presentacion" || ruta === "/pared" || ruta === "/ops" || ruta.startsWith("/ops/") || ruta.startsWith("/ficha/");
  const { viva, vivo } = useNaveViva(!fuera);
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
    setMas(false);
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
  const enlace = ({ href, texto, Icono }: Seccion) => (
    <Link key={href} href={href} aria-current={activa(href) ? "page" : undefined}>
      <Icono size={19} strokeWidth={1.6} aria-hidden="true" />
      {texto}
      {href === "/avisos" && alarmas > 0 && <span className="gx-globo" aria-label={`${alarmas} en alarma`}>{alarmas}</span>}
      {href === "/mantenimiento" && atrasadas > 0 && <span className="gx-globo suave" aria-label={`${atrasadas} revisiones atrasadas`}>{atrasadas}</span>}
      {href === "/sistema" && caidos > 0 && <span className="gx-globo" aria-label={`${caidos} sin conexión`}>{caidos}</span>}
    </Link>
  );
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
    <div className="gx-app">
      <aside className="gx-lado">
        <Link href="/" aria-label="Gradiox, inicio">
          <Marca size={30} oscuro />
        </Link>
        <nav className="gx-nav" aria-label="Secciones">
          {GRUPOS.map((g) => (
            <div key={g.nombre} role="group" aria-label={g.nombre}>
              <small aria-hidden="true">{g.nombre}</small>
              {g.secciones.map(enlace)}
            </div>
          ))}
        </nav>
        <div className="gx-pie">
          <p className="gx-demo">{viva ? `Viendo ${viva.nombre}: lecturas de su pasarela. La nave de demostración usa datos simulados.` : vivo.instalaciones?.length ? "Nave de demostración: datos simulados en el navegador." : "Demostración con datos simulados. No hay ninguna instalación conectada."}</p>
          <button type="button" className="gx-salir" onClick={salir}>
            <LogOut size={18} strokeWidth={1.6} aria-hidden="true" /> Salir
          </button>
        </div>
      </aside>
      <main className="gx-principal">
        <div className="gx-arriba">
          <Link href="/" className="gx-arriba-marca" aria-label="Gradiox, inicio">
            <Marca size={26} />
          </Link>
          <Buscador />
          <span className="hueco" />
          <Link href="/sistema" className={`gx-pildora vivo${caidos ? " mal" : ""}`} aria-label={caidos ? `Sistema: ${caidos} sin conexión` : "Sistema: en vivo, todo conectado"}>
            <i className={`gx-punto${caidos ? " error" : ""}`} />
            <span>{caidos ? "Sin conexión" : "En vivo"}</span>
            {ahora !== null && !caidos && <time>{new Date(ahora).toLocaleTimeString("es-ES")}</time>}
          </Link>
          <div className="gx-menu gx-menu-nave">
            <button type="button" className="gx-pildora nave" aria-haspopup="true" aria-expanded={naveAbierta} aria-controls="gx-naves-menu" aria-label={`Nave: ${nombreNave}. Cambiar de nave`} title={nombreNave} onClick={() => setMenu(naveAbierta ? null : "nave")}>
              {viva && <i className={`gx-punto${viva.conectada ? " vivo" : " sindatos"}`} aria-hidden="true" />}
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
                        <i className={`gx-punto ${ed.estado === "correcto" ? "" : ed.estado}`} />
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
                                <i className={`gx-punto ${r.estado === "correcto" ? "" : r.estado}`} />
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
                                  <i className={`gx-punto ${e.estado === "correcto" ? "" : e.estado}`} />
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
      <Vigia />
      <PanelGuion />
      {mas && (
        <nav id="gx-mas" className="gx-mas" aria-label="Más secciones">
          {MAS.map(enlace)}
          <button type="button" onClick={salir}>
            <LogOut size={19} strokeWidth={1.6} aria-hidden="true" /> Salir
          </button>
        </nav>
      )}
      <nav className="gx-abajo" aria-label="Secciones">
        {ABAJO.map(enlace)}
        <button type="button" aria-expanded={mas} aria-controls="gx-mas" data-activa={MAS.some((m) => activa(m.href)) || undefined} onClick={() => setMas(!mas)}>
          <Ellipsis size={19} strokeWidth={1.6} aria-hidden="true" />
          Más
          {(atrasadas > 0 || caidos > 0) && <span className="gx-globo suave" aria-hidden="true">{atrasadas + caidos}</span>}
        </button>
      </nav>
    </div>
    </GuionProvider>
  );
}
