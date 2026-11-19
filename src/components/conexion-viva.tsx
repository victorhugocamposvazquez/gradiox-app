"use client";

// Conexiones y «Cómo funciona» de una ubicación conectada: se pintan con lo
// que tiene configurado cada instalación (su pasarela y su ficha del panel
// interno) y con cómo está ahora mismo, no con un esquema fijo.

import Link from "next/link";
import { ArrowLeft, BellRing, Cloud, Cpu, Eye, Fan, Globe, ListChecks, type LucideIcon, Router, Server, ShieldCheck, SlidersHorizontal, Snowflake, Thermometer } from "lucide-react";
import type { ReactNode } from "react";
import { haceTexto } from "@/components/vivo";
import { useDemo } from "@/lib/store";
import { ordenadorDe, recorridoDe, type PasoVivo } from "@/vivo/conexion";
import type { InstalacionViva, ServicioVivo, UbicacionViva } from "@/vivo/modelo";

function Nodo({ Icono, titulo, detalle, caido }: { Icono: LucideIcon; titulo: string; detalle: string; caido: boolean }) {
  return (
    <div className={`gx-nodo${caido ? " caido" : ""}`}>
      <span className="gx-nodo-icono"><Icono size={20} strokeWidth={1.6} aria-hidden="true" /></span>
      <span className="gx-nodo-texto">
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
    </div>
  );
}
const Cable = ({ roto }: { roto: boolean }) => <span className={`gx-cable${roto ? " roto" : ""}`} aria-hidden="true" />;

const SENALES: { nombre: string; Icono: LucideIcon; llega: (s: ServicioVivo) => boolean | null }[] = [
  { nombre: "Temperatura", Icono: Thermometer, llega: (s) => s.temp !== null },
  { nombre: "Consigna", Icono: SlidersHorizontal, llega: (s) => (s.consigna !== null ? true : null) },
  { nombre: "Frío en marcha", Icono: Snowflake, llega: (s) => (s.enfriando !== null ? true : null) },
  { nombre: "Alarma alta del autómata", Icono: BellRing, llega: (s) => (s.muyAlta !== null ? true : null) },
];

/** Qué señales llegan de un servicio. Las que su autómata no tiene, no se pintan. */
function Senales({ s }: { s: ServicioVivo }) {
  const viva = s.estado !== "sindatos";
  return (
    <span className="gx-llegan">
      {SENALES.map(({ nombre, Icono, llega }) => {
        const l = llega(s);
        if (l === null) return null;
        const si = l && viva;
        return (
          <span key={nombre} className={si ? "si" : "no"} role="img" aria-label={`${nombre}: ${si ? "llega" : "sin señal"}`} title={`${nombre}: ${si ? "llega" : "sin señal"}`}>
            <Icono size={16} strokeWidth={1.7} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}

const nombreAutomata = (i: InstalacionViva) => (i.simulada ? "Autómata simulado" : i.ficha?.automata || i.ficha?.cpu || "Autómata (PLC)");

function UnaInstalacion({ i, ahora, titulo }: { i: InstalacionViva; ahora: number; titulo: boolean }) {
  const c = i.conexion;
  const sinPlc = c?.plc === false;
  const callada = !i.conectada;
  const mudos = i.servicios.filter((s) => s.estado === "sindatos").length;
  return (
    <>
      {titulo && <h2 className="gx-titulo-seccion suelto">{i.nombre}</h2>}
      <section className="gx-tarjeta gx-esquema" aria-label={`Esquema de la conexión de ${i.nombre}`}>
        <Nodo Icono={Cloud} titulo="Gradiox" detalle="Este programa" caido={false} />
        <Cable roto={callada} />
        <Nodo
          Icono={Router}
          titulo={`Pasarela${c?.programa ? ` · programa ${c.programa}` : ""}`}
          detalle={callada ? (i.entrega ? `No entrega desde ${haceTexto(ahora, i.entrega)}` : "Todavía no ha entregado nada") : `En ${ordenadorDe(c?.plataforma ?? "")} de la planta · entregó ${i.entrega ? haceTexto(ahora, i.entrega) : "—"}`}
          caido={callada}
        />
        <div className="gx-ramas">
          <div>
            <Cable roto={callada || sinPlc} />
            <Nodo
              Icono={i.simulada ? Cpu : Server}
              titulo={nombreAutomata(i)}
              detalle={sinPlc ? `El programa no llega al autómata${c?.detalle ? `: ${c.detalle}` : ""}` : `${i.servicios.length} servicios${i.compresores.length ? ` y ${i.compresores.length} compresores` : ""}${i.simulada ? " · valores de prueba" : ""}`}
              caido={sinPlc}
            />
          </div>
        </div>
      </section>

      <div className="gx-rejilla" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        <section className={`gx-tarjeta gx-equipo${callada || sinPlc ? " caido" : ""}`}>
          <div className="gx-fila">
            <div>
              <h2>Servicios · {i.servicios.length}</h2>
              <p className="gx-sub">{mudos ? `${mudos} sin datos` : "Todos con lectura"}</p>
            </div>
            <span className={`gx-chip ${callada || sinPlc ? "error" : "correcto"}`}>{callada ? "Sin entregas" : sinPlc ? "Sin autómata" : "Leyendo"}</span>
          </div>
          <ul className="gx-enlaces">
            {i.servicios.map((s) => (
              <li key={s.clave}>
                <Link href={`/historicos?id=${encodeURIComponent(s.pasarela)}&variable=${encodeURIComponent(s.variable)}`}>{s.nombre}</Link>
                <Senales s={s} />
              </li>
            ))}
          </ul>
        </section>
        {i.compresores.length > 0 && (
          <section className={`gx-tarjeta gx-equipo${callada || sinPlc ? " caido" : ""}`}>
            <div className="gx-fila">
              <div>
                <h2>Compresores · {i.compresores.length}</h2>
                <p className="gx-sub">{i.compresores.filter((x) => x.marcha).length} en marcha</p>
              </div>
            </div>
            <ul className="gx-enlaces">
              {i.compresores.map((x) => (
                <li key={x.nombre}>
                  <span>{x.nombre}</span>
                  <span className={`gx-chip ${x.bloqueado ? "aviso" : x.marcha ? "correcto" : "neutro"}`}>{x.bloqueado ? "Bloqueado" : x.marcha ? "En marcha" : x.marcha === false ? "Parado" : "Sin dato"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

export function ConexionesVivas({ u }: { u: UbicacionViva }) {
  const ahora = useDemo().ahora ?? Date.now();
  const partes = u.partes ?? [];
  const calladas = partes.filter((i) => !i.conectada).length;
  const sinPlc = partes.filter((i) => i.conectada && i.conexion?.plc === false).length;
  const mudos = u.servicios.filter((s) => s.estado === "sindatos").length;
  const leidas = partes.reduce((n, i) => n + (i.conexion?.leidas ?? 0), 0);
  const total = partes.reduce((n, i) => n + (i.conexion?.total ?? 0), 0);
  const ritmo = Math.min(...partes.map((i) => i.conexion?.cadaSegundos || Infinity));
  const titular = calladas ? (partes.length === 1 ? "La pasarela no entrega: no llega nada" : `${calladas} de ${partes.length} pasarelas no entregan`) : sinPlc ? "La pasarela no llega al autómata" : mudos ? `${mudos} servicios sin datos` : "Todo conectado y leyendo";
  return (
    <>
      <Link href="/sistema" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Sistema
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Conexiones</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${calladas || sinPlc || mudos ? " error" : ""}`} />
            {titular} · {u.nombre}
          </p>
        </div>
      </header>
      <div className="gx-pila">
        <div className="gx-cifras">
          <div className={calladas ? "mal" : undefined}><span>Pasarelas entregando</span><strong>{partes.length - calladas} <small>de {partes.length}</small></strong></div>
          <div className={mudos ? "mal" : undefined}><span>Servicios con datos</span><strong>{u.servicios.length - mudos} <small>de {u.servicios.length}</small></strong></div>
          <div><span>Variables con valor</span><strong>{leidas} <small>de {total}</small></strong></div>
          <div><span>Ritmo de lectura</span><strong>{Number.isFinite(ritmo) ? ritmo : "El del programa"} <small>{Number.isFinite(ritmo) ? "segundos" : ""}</small></strong></div>
        </div>
        {partes.map((i) => <UnaInstalacion key={i.id} i={i} ahora={ahora} titulo={partes.length > 1} />)}
        <p className="gx-nota">
          Este esquema sale de lo configurado para {u.cliente?.nombre ?? "esta instalación"} y de lo que dice su pasarela ahora mismo. <Link href="/como-funciona" className="gx-volver">Cómo funciona aquí</Link>
        </p>
      </div>
    </>
  );
}

const ICONOS: Record<PasoVivo["id"], LucideIcon> = { automata: Server, pasarela: Router, internet: Globe, nube: Cloud, avisos: BellRing, ordenes: Fan };
const CHIP: Record<PasoVivo["estado"], string> = { bien: "correcto", mal: "error", falta: "neutro" };

function Recorrido({ i }: { i: InstalacionViva }) {
  const pasos = recorridoDe(i);
  return (
    <ol className="gx-recorrido">
      {pasos.map((p, n) => {
        const Icono = p.id === "ordenes" && p.estado !== "bien" ? Eye : ICONOS[p.id];
        return (
          <li key={p.id}>
            <span className="numero" aria-hidden="true">{n + 1}</span>
            <div className="contenido">
              <h3>
                <Icono size={18} strokeWidth={1.6} aria-hidden="true" />
                {p.titulo}
              </h3>
              <p>{p.texto}</p>
              {p.datos.length > 0 && (
                <dl className="gx-paso-datos">
                  {p.datos.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              )}
              <span className={`gx-chip ${CHIP[p.estado]}`}>Ahora: {p.ahora}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Las otras páginas de documentación: qué hace la app y cómo se protege. */
export function EnlacesDocs({ conexiones = false }: { conexiones?: boolean }) {
  return (
    <p className="gx-docs">
      {conexiones && <Link href="/conexiones" className="gx-boton secundario"><Router size={16} strokeWidth={1.7} aria-hidden="true" /> Esquema de conexiones</Link>}
      <Link href="/como-funciona/funciones" className="gx-boton secundario"><ListChecks size={16} strokeWidth={1.7} aria-hidden="true" /> Qué hace Gradiox</Link>
      <Link href="/como-funciona/seguridad" className="gx-boton secundario"><ShieldCheck size={16} strokeWidth={1.7} aria-hidden="true" /> Seguridad</Link>
    </p>
  );
}

/** «Cómo funciona» contado para la ubicación elegida. Debajo queda, plegada, la explicación general. */
export function ComoFuncionaVivo({ u, general }: { u: UbicacionViva; general: ReactNode }) {
  const partes = u.partes ?? [];
  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Cómo funciona</h1>
          <p className="gx-sub">Así está montado Gradiox en {u.nombre}{u.cliente ? `, de ${u.cliente.nombre}` : ""}: lo que hay configurado y cómo está ahora mismo.</p>
        </div>
      </header>
      <div className="gx-pila">
        <EnlacesDocs conexiones />
        {partes.map((i) => (
          <section key={i.id} className="gx-tarjeta" aria-label={`El recorrido en ${i.nombre}`}>
            <h2 className="gx-titulo-seccion">{partes.length > 1 ? i.nombre : "El recorrido, del autómata a tu pantalla"}</h2>
            <p className="gx-sub">{i.simulada ? "Instalación de prueba, con autómata simulado" : "En el orden en que ocurre"}</p>
            <Recorrido i={i} />
          </section>
        ))}
        <details className="gx-general">
          <summary>Gradiox en general: cómo funciona con cualquier instalación</summary>
          <div className="gx-pila">{general}</div>
        </details>
      </div>
    </>
  );
}
