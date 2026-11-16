"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, ChartColumn, ChevronDown, ClipboardCheck, Ellipsis, FileText, House, LayoutGrid, LogOut, Moon, Search, Sun, TriangleAlert, Truck, Warehouse, Wrench, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EQUIPOS, proxima } from "@/lib/equipos";
import { NAVES } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, leer } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { Marca } from "./marca";
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
const GRUPOS: { nombre: string; secciones: Seccion[] }[] = [
  { nombre: "Ahora", secciones: [HOY, SERVICIOS, AVISOS] },
  { nombre: "Trabajo", secciones: [TURNO, MANTENIMIENTO, RECEPCION] },
  { nombre: "Documentos", secciones: [REGISTRO, INFORME] },
  { nombre: "Instalación", secciones: [LUZ, SISTEMA] },
];
// En el móvil caben cuatro; el resto va en «Más».
const ABAJO = [HOY, SERVICIOS, AVISOS, TURNO];
const MAS: Seccion[] = [MANTENIMIENTO, RECEPCION, REGISTRO, INFORME, LUZ, SISTEMA, { href: "/naves", texto: "Naves", Icono: Warehouse }];

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" : href === "/sistema" ? ruta.startsWith("/sistema") || ruta.startsWith("/conexiones") : ruta.startsWith(href));
  const { ahora, ajustes, notis, registro } = useDemo();
  const dia = ahora === null ? null : Math.floor(ahora / 3_600_000);
  const atrasadas = useMemo(() => (dia === null ? 0 : EQUIPOS.filter((e) => proxima(e, registro, dia * 3_600_000).dias < 0).length), [dia, registro]);
  const [mas, setMas] = useState(false);
  useEffect(() => setMas(false), [ruta]);
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
          <Link href="/buscar" className="gx-pildora gx-busca" aria-label="Buscar servicios, equipos y pantallas" aria-current={activa("/buscar") ? "page" : undefined}>
            <Search size={19} strokeWidth={1.6} aria-hidden="true" />
            <span>Buscar servicios, equipos y pantallas</span>
          </Link>
          <span className="hueco" />
          <Link href="/sistema" className={`gx-pildora vivo${caidos ? " mal" : ""}`} aria-label={caidos ? `Sistema: ${caidos} sin conexión` : "Sistema: en vivo, todo conectado"}>
            <i className={`gx-punto${caidos ? " error" : ""}`} />
            <span>{caidos ? "Sin conexión" : "En vivo"}</span>
            {ahora !== null && !caidos && <time>{new Date(ahora).toLocaleTimeString("es-ES")}</time>}
          </Link>
          <Link href="/naves" className="gx-pildora nave" aria-label={`Nave: ${NAVES[0].nombre}. Ver todas las naves`} title={NAVES[0].nombre} aria-current={ruta.startsWith("/naves") ? "page" : undefined}>
            <span>{NAVES[0].nombre}</span>
            <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Link href="/notificaciones" className="gx-pildora redonda" aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"} aria-current={activa("/notificaciones") ? "page" : undefined}>
            <Bell size={19} strokeWidth={1.6} aria-hidden="true" />
            {sinLeer > 0 && <span className="gx-globo azul" aria-hidden="true">{sinLeer > 9 ? "9+" : sinLeer}</span>}
          </Link>
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
