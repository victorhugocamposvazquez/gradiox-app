"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EQUIPOS } from "@/lib/equipos";
import { describir } from "@/lib/fallos";
import { CAMARAS, rotulo } from "@/lib/datos";
import { useDemo } from "@/lib/store";
import { buscar, type Hallazgo } from "@/lib/turno";

const PANTALLAS: Hallazgo[] = [
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

export default function Buscar() {
  const { fallos, trabajos } = useDemo();
  const [consulta, setConsulta] = useState("");
  const todo = useMemo<Hallazgo[]>(
    () => [
      ...CAMARAS.map((c) => ({ grupo: "Servicios", titulo: c.nombre, detalle: rotulo(c), href: `/servicios/${c.id}` })),
      ...EQUIPOS.map((e) => ({ grupo: "Equipos", titulo: e.nombre, detalle: e.tipo, href: `/mantenimiento/${e.id}` })),
      ...trabajos.filter((o) => !o.cerrada).map((o) => ({ grupo: "Órdenes de trabajo", titulo: o.tarea, detalle: `${o.tipo} · ${EQUIPOS.find((e) => e.id === o.equipoId)?.nombre ?? ""}`, href: "/mantenimiento" })),
      ...fallos.map((f) => ({ grupo: "Fallos típicos", titulo: f.nombre, detalle: describir(f), href: "/avisos/fallos" })),
      ...PANTALLAS,
    ],
    [fallos, trabajos],
  );
  const hallados = consulta.trim() ? buscar(todo, consulta) : PANTALLAS;
  const grupos = [...new Set(hallados.map((h) => h.grupo))];

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Buscar</h1>
          <p className="gx-sub">Un servicio, un equipo, una orden o una pantalla</p>
        </div>
      </header>
      <div className="gx-pila">
        <label className="gx-campo gx-buscador">
          <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          <input type="search" aria-label="Qué buscas" placeholder="Cámara 2, compresor, luz…" autoFocus value={consulta} onChange={(ev) => setConsulta(ev.target.value)} />
        </label>
        {hallados.length === 0 ? (
          <p className="gx-tarjeta gx-vacio">Nada con «{consulta.trim()}». Prueba con el nombre de un servicio o de un equipo.</p>
        ) : (
          grupos.map((g) => (
            <section key={g} className="gx-tarjeta">
              <h2>{g}</h2>
              <ul className="gx-lista gx-hallazgos">
                {hallados.filter((h) => h.grupo === g).map((h) => (
                  <li key={h.href + h.titulo}>
                    <Link href={h.href}>
                      <strong style={{ fontWeight: 500 }}>{h.titulo}</strong>
                      <small>{h.detalle}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
