"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid, LogOut, Wrench, Zap } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { CAMARAS, leer } from "@/lib/sim";
import { useDemo } from "@/lib/store";
import { Marca } from "./marca";

const SECCIONES = [
  { href: "/", texto: "Servicios", Icono: LayoutGrid },
  { href: "/avisos", texto: "Avisos", Icono: Bell },
  { href: "/luz", texto: "Luz", Icono: Zap },
  { href: "/mantenimiento", texto: "Mantenimiento", Icono: Wrench },
];

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/servicios") || ruta.startsWith("/registro") : ruta.startsWith(href));
  const { ahora, ajustes } = useDemo();
  const alarmas = ahora === null ? 0 : CAMARAS.filter((c) => leer(c, ahora, ajustes).estado === "error").length;
  // La pestaña del navegador también avisa, por si Gradiox está en segundo plano.
  useEffect(() => {
    const titulo = alarmas ? `(${alarmas}) Alarma · Gradiox` : "Gradiox";
    if (document.title !== titulo) document.title = titulo;
  }, [alarmas, ahora, ruta]);
  const enlaces = SECCIONES.map(({ href, texto, Icono }) => (
    <Link key={href} href={href} aria-current={activa(href) ? "page" : undefined}>
      <Icono size={20} strokeWidth={1.6} aria-hidden="true" />
      {texto}
      {href === "/avisos" && alarmas > 0 && <span className="gx-globo" aria-label={`${alarmas} en alarma`}>{alarmas}</span>}
    </Link>
  ));
  const salir = async () => {
    await fetch("/api/sesion", { method: "DELETE" }).catch(() => null);
    window.location.assign("/login");
  };
  // La entrada va sola, sin menú.
  if (ruta === "/login") return <>{children}</>;
  return (
    <div className="gx-app">
      <aside className="gx-lado">
        <Link href="/" aria-label="Gradiox, inicio">
          <Marca size={30} oscuro />
        </Link>
        <nav className="gx-nav" aria-label="Secciones">
          {enlaces}
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
          <Link href="/" aria-label="Gradiox, inicio">
            <Marca size={26} />
          </Link>
          <span className="gx-fila" style={{ gap: 4 }}>
            <span className="gx-chip neutro">Datos simulados</span>
            <button type="button" className="gx-salir" aria-label="Salir" onClick={salir}>
              <LogOut size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </span>
        </div>
        {children}
      </main>
      <nav className="gx-abajo" aria-label="Secciones">
        {enlaces}
      </nav>
    </div>
  );
}
