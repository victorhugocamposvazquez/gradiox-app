"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Activity, Bell, BookOpen, ChartColumn, ListTodo, Check, ChevronDown, ClipboardCheck, Ellipsis, FileText, House, LayoutGrid, LogOut, Moon, Sun, TriangleAlert, Truck, Warehouse, Wrench, Zap } from "lucide-react";
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

type Seccion = { href: string; texto: string; Icono: typeof Activity };
const HOY: Seccion = { href: "/", texto: "Hoy", Icono: House };
const SERVICIOS: Seccion = { href: "/servicios", texto: "Servicios", Icono: LayoutGrid };
const AVISOS: Seccion = { href: "/avisos", texto: "Avisos", Icono: TriangleAlert };
const TURNO: Seccion = { href: "/turno", texto: "Turno", Icono: ClipboardCheck };
const MANTENIMIENTO: Seccion = { href: "/mantenimiento", texto: "Mantenimiento", Icono: Wrench };
const RECEPCION: Seccion = { href: "/recepcion", texto: "Recepción", Icono: Truck };
const REGISTRO: Seccion = { href: "/registro", texto: "Registro", Icono: FileText };
const INFORME: Seccion = { href: "/informe", texto: "Informe", Icono: ChartColumn };
const LUZ: Seccion = { href: "/luz", texto: "Luz", Icono: Zap };
const SISTEMA: Seccion = { href: "/sistema", texto: "Sistema", Icono: Activity };
const AYUDA: Seccion = { href: "/como-funciona", texto: "Cómo funciona", Icono: BookOpen };
const TAREAS: Seccion = { href: "/tareas", texto: "Tareas", Icono: ListTodo };
const CLIENTES: Seccion = { href: "/ops", texto: "Clientes", Icono: Building2 };
const GRUPOS: { nombre: string; secciones: Seccion[] }[] = [
  { nombre: "Ahora", secciones: [HOY, SERVICIOS, AVISOS] },
  { nombre: "Trabajo", secciones: [TURNO, MANTENIMIENTO, RECEPCION] },
  { nombre: "Documentos", secciones: [REGISTRO, INFORME] },
  { nombre: "Instalación", secciones: [LUZ, SISTEMA, AYUDA] },
  // Lo de dentro de Gradiox: no es para los clientes.
  { nombre: "Interno", secciones: [CLIENTES, TAREAS] },
];
// En el móvil caben cuatro; el resto va en «Más».
const ABAJO = [HOY, SERVICIOS, AVISOS, TURNO];
const MAS: Seccion[] = [MANTENIMIENTO, RECEPCION, REGISTRO, INFORME, LUZ, SISTEMA, { href: "/naves", texto: "Naves", Icono: Warehouse }, AYUDA, CLIENTES, TAREAS];

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" : href === "/sistema" ? ruta.startsWith("/sistema") || ruta.startsWith("/conexiones") : ruta.startsWith(href));
  const { ahora, ajustes, notis, registro, marcarLeidas } = useDemo();
  const dia = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const atrasadas = useMemo(() => (dia === null ? 0 : EQUIPOS.filter((e) => proxima(e, registro, dia * 3_600_000).dias < 0).length), [dia, registro]);
  const [mas, setMas] = useState(false);
  const [menu, setMenu] = useState<"nave" | "campana" | null>(null);
  const naveAbierta = menu === "nave";
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
  if (ruta === "/login" || ruta === "/presentacion" || ruta === "/pared") return <>{children}</>;
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
          <p className="gx-demo">Demostración con datos simulados. No hay ninguna instalación conectada.</p>
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
            <button type="button" className="gx-pildora nave" aria-haspopup="true" aria-expanded={naveAbierta} aria-controls="gx-naves-menu" aria-label={`Nave: ${NAVES[0].nombre}. Cambiar de nave`} title={NAVES[0].nombre} onClick={() => setMenu(naveAbierta ? null : "nave")}>
              <span>{NAVES[0].nombre}</span>
              <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
            {naveAbierta && ahora !== null && (
              <div id="gx-naves-menu" className="gx-flotante gx-naves-menu">
                <small>Naves</small>
                <ul>
                  {NAVES.map((n, i) => {
                    const e = estadoNave(n, i, ahora, ajustes);
                    return (
                      <li key={n.id} aria-current={n.ejemplo ? undefined : "true"} className={n.ejemplo ? "ejemplo" : undefined}>
                        <i className={`gx-punto ${e.estado === "correcto" ? "" : e.estado}`} />
                        <span>
                          <strong>{n.nombre}</strong>
                          <small>{n.servicios} servicios · {e.resumen}</small>
                        </span>
                        {n.ejemplo ? <span className="gx-chip neutro">Ejemplo</span> : <Check size={18} strokeWidth={1.8} aria-label="Es la que estás viendo" />}
                      </li>
                    );
                  })}
                </ul>
                <Link href="/naves" className="gx-volver">Ver todas las naves</Link>
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
        </div>
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
