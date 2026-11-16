"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EQUIPOS } from "@/lib/equipos";
import { describir } from "@/lib/fallos";
import { CAMARAS, rotulo } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { buscar, type Hallazgo } from "@/lib/turno";

export const PANTALLAS: Hallazgo[] = [
  { grupo: "Pantallas", titulo: "Hoy", detalle: "Cómo está todo y qué toca", href: "/" },
  { grupo: "Pantallas", titulo: "Servicios", detalle: "Cámaras, túnel, muelle y mueble", href: "/servicios" },
  { grupo: "Pantallas", titulo: "Comparar servicios", detalle: "Varias temperaturas en la misma gráfica", href: "/servicios/comparar" },
  { grupo: "Pantallas", titulo: "Avisos", detalle: "Alarmas, avisos e histórico", href: "/avisos" },
  { grupo: "Pantallas", titulo: "Fallos típicos", detalle: "Lo que suele pasar y qué hacer", href: "/avisos/fallos" },
  { grupo: "Pantallas", titulo: "Mantenimiento", detalle: "Órdenes de trabajo, revisiones, calendario y libro", href: "/mantenimiento" },
  { grupo: "Pantallas", titulo: "Turno", detalle: "Relevo y ronda diaria", href: "/turno" },
  { grupo: "Pantallas", titulo: "Recepción de mercancía", detalle: "Temperatura a la que llega el género y dónde entra", href: "/recepcion" },
  { grupo: "Pantallas", titulo: "Pantalla de pared", detalle: "Para un televisor: solo estados, en grande", href: "/pared" },
  { grupo: "Pantallas", titulo: "Demostración", detalle: "Provocar averías, cortar conexiones y empezar de cero", href: "/demostracion" },
  { grupo: "Pantallas", titulo: "Luz", detalle: "Precio por horas, plan y consumo", href: "/luz" },
  { grupo: "Pantallas", titulo: "Registro de temperaturas", detalle: "Mínimas y máximas por días, para descargar", href: "/registro" },
  { grupo: "Pantallas", titulo: "Sistema", detalle: "Comprobaciones de toda la cadena", href: "/sistema" },
  { grupo: "Pantallas", titulo: "Conexiones", detalle: "Pasarela, autómatas e histórico de cortes", href: "/conexiones" },
  { grupo: "Pantallas", titulo: "Notificaciones", detalle: "Recibidas, ajustes, silencio y guardias", href: "/notificaciones" },
  { grupo: "Pantallas", titulo: "Naves", detalle: "Todas las instalaciones", href: "/naves" },
  { grupo: "Pantallas", titulo: "Informe mensual", detalle: "Treinta días: tiempo dentro del límite, alarmas e intervenciones", href: "/informe/mes" },
  { grupo: "Pantallas", titulo: "Informe del día", detalle: "Resumen para imprimir", href: "/informe" },
];

/** Lo que más se hace, para llegar en un paso desde el buscador. */
export const ACCIONES: Hallazgo[] = [
  { grupo: "Acciones", titulo: "Nueva orden de trabajo", detalle: "Algo que hay que hacer, con fecha y responsable", href: "/mantenimiento?orden=1" },
  { grupo: "Acciones", titulo: "Apuntar una intervención", detalle: "Algo ya hecho que debe quedar en el libro", href: "/mantenimiento?apuntar=1" },
  { grupo: "Acciones", titulo: "Apuntar una entrada de mercancía", detalle: "Temperatura a la que llega el género", href: "/recepcion" },
  { grupo: "Acciones", titulo: "Dar el relevo", detalle: "Lo que se encuentra quien entra", href: "/turno" },
  { grupo: "Acciones", titulo: "Hacer la ronda de hoy", detalle: "Lo que se mira a mano", href: "/turno#ronda" },
  { grupo: "Acciones", titulo: "Ver alarmas y avisos", detalle: "Últimas 24 horas, por servicio", href: "/avisos" },
  { grupo: "Acciones", titulo: "Poner en marcha el plan de luz", detalle: "Más frío en las horas de menor coste", href: "/luz" },
  { grupo: "Acciones", titulo: "Sacar el informe del día", detalle: "Resumen para imprimir", href: "/informe" },
  { grupo: "Acciones", titulo: "Descargar el registro de temperaturas", detalle: "Mínimas y máximas por días", href: "/registro" },
  { grupo: "Acciones", titulo: "Abrir la pantalla de pared", detalle: "Para un televisor: solo estados, en grande", href: "/pared" },
];
const DIRECTAS = 6;

/** Todo lo que se puede buscar: servicios, equipos, órdenes abiertas, fallos típicos y pantallas. */
export function useHallazgos(): Hallazgo[] {
  const { fallos, trabajos } = useDemo();
  return useMemo<Hallazgo[]>(
    () => [
      ...ACCIONES,
      ...CAMARAS.map((c) => ({ grupo: "Servicios", titulo: c.nombre, detalle: rotulo(c), href: `/servicios/${c.id}` })),
      ...EQUIPOS.map((e) => ({ grupo: "Equipos", titulo: e.nombre, detalle: e.tipo, href: `/mantenimiento/${e.id}` })),
      ...trabajos.filter((o) => !o.cerrada).map((o) => ({ grupo: "Órdenes de trabajo", titulo: o.tarea, detalle: `${o.tipo} · ${EQUIPOS.find((e) => e.id === o.equipoId)?.nombre ?? ""}`, href: "/mantenimiento" })),
      ...fallos.map((f) => ({ grupo: "Fallos típicos", titulo: f.nombre, detalle: describir(f), href: "/avisos/fallos" })),
      ...PANTALLAS,
    ],
    [fallos, trabajos],
  );
}

const TOPE = 8;

/** Buscador de la barra superior: los resultados salen debajo, sin cambiar de pantalla. */
export function Buscador() {
  const ruta = usePathname();
  const router = useRouter();
  const todo = useHallazgos();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const hallados = consulta.trim() ? buscar(todo, consulta).slice(0, TOPE) : ACCIONES.slice(0, DIRECTAS);
  const cerrar = () => {
    setAbierto(false);
    setConsulta("");
    setActivo(0);
  };
  useEffect(cerrar, [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: PointerEvent) => {
      if (caja.current && !caja.current.contains(ev.target as Node)) cerrar();
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);
  const abrir = () => {
    setAbierto(true);
    // En el móvil el campo aparece al abrir: el foco va después de pintarlo.
    window.setTimeout(() => campo.current?.focus(), 0);
  };
  // Una acción sobre la pantalla en la que ya se está (abrir su formulario) necesita recargarla para que lo lea.
  const misma = (h: Hallazgo) => h.href.includes("?") && h.href.split("?")[0] === ruta;
  const ir = (h: Hallazgo) => {
    cerrar();
    campo.current?.blur();
    if (misma(h)) window.location.assign(h.href);
    else router.push(h.href);
  };

  return (
    <div ref={caja} className={`gx-busca${abierto ? " abierto" : ""}`}>
      <button type="button" className="gx-pildora redonda gx-busca-abrir" aria-label="Buscar" onClick={abrir}>
        <Search size={19} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <label className="gx-pildora gx-busca-campo">
        <Search size={19} strokeWidth={1.6} aria-hidden="true" />
        <input
          ref={campo}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="gx-busca-lista"
          aria-autocomplete="list"
          aria-label="Buscar servicios, equipos y pantallas"
          placeholder="Buscar servicios, equipos y pantallas"
          autoComplete="off"
          value={consulta}
          onFocus={() => setAbierto(true)}
          onChange={(ev) => { setConsulta(ev.target.value); setActivo(0); setAbierto(true); }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") { cerrar(); campo.current?.blur(); }
            else if (ev.key === "ArrowDown") { ev.preventDefault(); setActivo((a) => Math.min(a + 1, hallados.length - 1)); }
            else if (ev.key === "ArrowUp") { ev.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            else if (ev.key === "Enter" && hallados[activo]) { ev.preventDefault(); ir(hallados[activo]); }
          }}
        />
        {abierto && (
          <button type="button" className="gx-busca-cerrar" aria-label="Cerrar el buscador" onClick={(ev) => { ev.preventDefault(); cerrar(); }}>
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
      </label>
      {abierto && (
        <div id="gx-busca-lista" className="gx-flotante gx-busca-panel" role="listbox" aria-label="Resultados">
          {hallados.length === 0 ? (
            <p className="gx-nota">Nada con «{consulta.trim()}». Prueba con el nombre de un servicio o de un equipo.</p>
          ) : (
            <>
            {!consulta.trim() && <small className="gx-flotante-titulo">Acciones directas</small>}
            {hallados.map((h, i) => (
              <Link key={h.href + h.titulo} href={h.href} role="option" aria-selected={i === activo} onMouseEnter={() => setActivo(i)} onClick={(ev) => { if (misma(h)) { ev.preventDefault(); ir(h); } else cerrar(); }}>
                <span>
                  <strong>{h.titulo}</strong>
                  <small>{h.detalle}</small>
                </span>
                <em>{h.grupo}</em>
              </Link>
            ))}
            {!consulta.trim() && <p className="gx-nota">O escribe el nombre de un servicio, un equipo, una orden o una pantalla.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
