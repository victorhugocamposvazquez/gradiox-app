"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Cable, ClipboardList, ListChecks, ListTodo, LogOut, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Marca } from "./marca";

const SECCIONES: { href: string; texto: string; Icono: LucideIcon }[] = [
  { href: "/ops", texto: "Clientes", Icono: Building2 },
  { href: "/ops/tecnica", texto: "Fichas técnicas", Icono: Cable },
  { href: "/ops/visita", texto: "Guía de visita", Icono: ClipboardList },
  { href: "/ops/tareas", texto: "Tareas", Icono: ListTodo },
  { href: "/ops/plan", texto: "Plan", Icono: ListChecks },
];

/** El armazón del panel interno de Gradiox: barra propia, sin nada de la app del cliente. */
export function PanelInterno({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.dataset.theme === "dark"), []);
  if (ruta === "/ops/entrar") return <>{children}</>;

  const activa = (href: string) => (href === "/ops" ? ruta === "/ops" || (ruta.startsWith("/ops/clientes") && !ruta.endsWith("/tecnica")) : href === "/ops/tecnica" ? ruta.startsWith(href) || ruta.endsWith("/tecnica") : ruta.startsWith(href));
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
  const Tema = oscuro ? Sun : Moon;

  return (
    <div className="gx-panel">
      <header className="gx-panel-barra">
        <Link href="/ops" className="gx-panel-marca" aria-label="Gradiox, panel interno">
          <Marca size={24} />
          <span className="gx-panel-ops">ops</span>
        </Link>
        <nav aria-label="Secciones del panel">
          {SECCIONES.map(({ href, texto, Icono }) => (
            <Link key={href} href={href} aria-current={activa(href) ? "page" : undefined}>
              <Icono size={17} strokeWidth={1.6} aria-hidden="true" />
              {texto}
            </Link>
          ))}
        </nav>
        <div className="gx-panel-fin">
          <button type="button" className="gx-pildora" onClick={cambiarTema} aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
            <Tema size={17} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" className="gx-pildora" onClick={salir}>
            <LogOut size={17} strokeWidth={1.6} aria-hidden="true" /> <span className="texto">Salir</span>
          </button>
        </div>
      </header>
      <main className="gx-panel-cuerpo">{children}</main>
    </div>
  );
}
