"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, ChevronsUpDown, House, LayoutGrid, LogOut, Moon, Sun, TriangleAlert, Wifi, WifiOff, Wrench, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NAVES } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, leer } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { Marca } from "./marca";
import { GuionProvider, PanelGuion } from "./guion";
import { Vigia } from "./vigia";

const SISTEMA = { href: "/sistema", texto: "Sistema", Icono: Activity };
const NOTIFICACIONES = { href: "/notificaciones", texto: "Notificaciones", Icono: Bell };
const SECCIONES = [
  { href: "/", texto: "Hoy", Icono: House },
  { href: "/servicios", texto: "Servicios", Icono: LayoutGrid },
  { href: "/avisos", texto: "Avisos", Icono: TriangleAlert },
  { href: "/mantenimiento", texto: "Mantenimiento", Icono: Wrench },
];
const LUZ = { href: "/luz", texto: "Luz", Icono: Zap };

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/informe") : href === "/servicios" ? ruta.startsWith("/servicios") || ruta.startsWith("/registro") : href === "/sistema" ? ruta.startsWith("/sistema") || ruta.startsWith("/conexiones") : ruta.startsWith(href));
  const { ahora, ajustes, notis } = useDemo();
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
  const enlace = ({ href, texto, Icono }: (typeof SECCIONES)[number]) => (
    <Link key={href} href={href} aria-current={activa(href) ? "page" : undefined}>
      <Icono size={20} strokeWidth={1.6} aria-hidden="true" />
      {texto}
      {href === "/avisos" && alarmas > 0 && <span className="gx-globo" aria-label={`${alarmas} en alarma`}>{alarmas}</span>}
      {href === "/notificaciones" && sinLeer > 0 && <span className="gx-globo azul" aria-label={`${sinLeer} sin leer`}>{sinLeer > 9 ? "9+" : sinLeer}</span>}
      {href === "/sistema" && caidos > 0 && <span className="gx-globo" aria-label={`${caidos} sin conexión`}>{caidos}</span>}
    </Link>
  );
  const enlaces = SECCIONES.map(enlace);
  const Enlace = caidos ? WifiOff : Wifi;
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
  if (ruta === "/login") return <>{children}</>;
  return (
    <GuionProvider>
    <div className="gx-app">
      <aside className="gx-lado">
        <Link href="/" aria-label="Gradiox, inicio">
          <Marca size={30} oscuro />
        </Link>
        <Link href="/naves" className="gx-nave-actual" aria-label={`Nave: ${NAVES[0].nombre}. Ver todas las naves`} aria-current={ruta.startsWith("/naves") ? "page" : undefined}>
          <span>
            <small>Nave</small>
            {NAVES[0].nombre}
          </span>
          <ChevronsUpDown size={16} strokeWidth={1.6} aria-hidden="true" />
        </Link>
        <nav className="gx-nav" aria-label="Secciones">
          {enlaces}
          {enlace(LUZ)}
          {enlace(SISTEMA)}
          {enlace(NOTIFICACIONES)}
        </nav>
        <div className="gx-pie">
          <p className="gx-demo">Demostración con datos simulados. No hay ninguna instalación conectada.</p>
          <button type="button" className="gx-tema" onClick={cambiarTema}>
            <Tema size={18} strokeWidth={1.6} aria-hidden="true" /> {oscuro ? "Tema claro" : "Tema oscuro"}
          </button>
          <button type="button" className="gx-salir" onClick={salir}>
            <LogOut size={18} strokeWidth={1.6} aria-hidden="true" /> Salir
          </button>
        </div>
      </aside>
      <main className="gx-principal">
        <div className="gx-arriba">
          <Link href="/" aria-label="Gradiox, inicio">
            <Marca size={26} />
          </Link>
          <span className="gx-fila" style={{ gap: 4 }}>
            <Link href="/sistema" className={`gx-chip ${caidos ? "error" : "correcto"}`} aria-label={caidos ? `Sistema: ${caidos} sin conexión` : "Sistema: todo conectado"}>
              <Enlace size={16} strokeWidth={1.8} aria-hidden="true" />
              <span className="texto">{caidos ? "Sin conexión" : "Conectado"}</span>
            </Link>
            <button type="button" className="gx-tema" aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onClick={cambiarTema}>
              <Tema size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <Link href="/notificaciones" className="gx-campana" aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"} aria-current={activa("/notificaciones") ? "page" : undefined}>
              <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
              {sinLeer > 0 && <span className="gx-globo azul" aria-hidden="true">{sinLeer > 9 ? "9+" : sinLeer}</span>}
            </Link>
            <button type="button" className="gx-salir" aria-label="Salir" onClick={salir}>
              <LogOut size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </span>
        </div>
        {children}
      </main>
      <Vigia />
      <PanelGuion />
      <nav className="gx-abajo" aria-label="Secciones">
        {enlaces}
      </nav>
    </div>
    </GuionProvider>
  );
}
