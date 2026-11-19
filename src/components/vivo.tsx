"use client";

// Hoy y Servicios de una instalación conectada: lo que entrega su pasarela,
// con el mismo aspecto que la nave de demostración.

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChartLine, ChevronRight, LayoutGrid, List, Minus, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Medidor, Temp, Trazo } from "@/components/piezas";
import { porGravedad, resumenDe, type Estado, type InstalacionViva, type Rumbo, type ServicioVivo } from "@/vivo/modelo";
import { useDemo } from "@/lib/store";
import { NAVE_DEMO, elegirNave, useInstalaciones } from "@/vivo/cliente";

type Vista = "cuadricula" | "lista";
type Filtro = "todas" | Estado;
const CLAVE_VISTA = "gradiox-vista";
const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todas", texto: "Todos" },
  { id: "correcto", texto: "Bien" },
  { id: "aviso", texto: "Con aviso" },
  { id: "error", texto: "En alarma" },
  { id: "sindatos", texto: "Sin datos" },
];

const gradosC = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v * 10) / 10).toString().replace(".", ",")} °C`;
const reloj = (t: number) => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const haceTexto = (ahora: number, t: number) => {
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
};
const punto = (e: Estado) => `gx-punto ${e === "correcto" ? "" : e}`;
/** Cada servicio abre el histórico de su temperatura. */
export const enlaceServicio = (i: InstalacionViva, s: ServicioVivo) => `/historicos?id=${encodeURIComponent(i.id)}&variable=${encodeURIComponent(s.variable)}`;
/** Límite con el que se dibuja el medidor: la alarma alta del autómata o, sin ella, cinco grados sobre la consigna. */
const limiteDe = (s: ServicioVivo) => s.muyAlta ?? (s.consigna ?? s.temp ?? 0) + 5;

function RumboTexto({ r, alerta }: { r: Rumbo; alerta: boolean }) {
  const Icono = r === "sube" ? ArrowUpRight : r === "baja" ? ArrowDownRight : Minus;
  return (
    <span className={`gx-tendencia${r === "sube" && alerta ? " sube" : ""}`}>
      <Icono size={16} strokeWidth={1.8} aria-hidden="true" />
      {r === "sube" ? "Subiendo" : r === "baja" ? "Bajando" : "Estable"}
    </span>
  );
}

function Lectura({ s, className }: { s: ServicioVivo; className?: string }) {
  return s.temp === null ? <span className={`gx-lectura${className ? ` ${className}` : ""}`}>—</span> : <Temp valor={s.temp} className={className} />;
}

/** Frío, desescarche, humedad y evaporadores en texto, con un punto que dice si está activo. */
function SenalesVivas({ s }: { s: ServicioVivo }) {
  if (s.estado === "sindatos")
    return (
      <span className="gx-senales">
        <span className="apagado"><i aria-hidden="true" />Sin señal</span>
      </span>
    );
  return (
    <span className="gx-senales">
      {s.enfriando !== null && <span className={s.enfriando ? "activo" : "apagado"}><i aria-hidden="true" />{s.enfriando ? "Enfriando" : "Frío parado"}</span>}
      {s.desescarche && <span className="activo"><i aria-hidden="true" />Desescarche</span>}
      {s.enMarcha === false && <span className="alerta"><i aria-hidden="true" />Parado</span>}
      {s.humedad !== null && <span className="apagado"><i aria-hidden="true" />Humedad {Math.round(s.humedad)} %</span>}
      {s.evaporadores.map((e) => (
        <span key={e.nombre} className={e.averia ? "alerta" : e.enfriando ? "activo" : "apagado"}>
          <i aria-hidden="true" />
          {e.nombre.replace(/^.*·\s*/, "")}: {e.averia ? "avería" : e.enfriando ? "enfriando" : "parado"}
        </span>
      ))}
    </span>
  );
}

/** Aviso de que lo que se ve viene de una instalación conectada, y si su autómata es simulado. */
export function OrigenVivo({ i, ahora }: { i: InstalacionViva; ahora: number }) {
  return (
    <p className="gx-vivo-origen">
      <Radio size={15} strokeWidth={1.7} aria-hidden="true" />
      <span>
        Lecturas de la pasarela{i.entrega ? `, última entrega ${haceTexto(ahora, i.entrega)}` : ""}.
        {i.simulada ? " El autómata es simulado: los valores son de prueba." : ""}
      </span>
      <button type="button" className="gx-enlace" onClick={() => elegirNave(NAVE_DEMO)}>Otra ubicación: Nave de demostración</button>
    </p>
  );
}

export function ServiciosVivos({ i }: { i: InstalacionViva }) {
  const ahora = useDemo().ahora ?? Date.now();
  const [vista, setVista] = useState<Vista>("cuadricula");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === "lista") setVista("lista");
    } catch {
      // Sin almacenamiento se queda en cuadrícula.
    }
  }, []);
  const elegir = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ver arriba.
    }
  };

  const todas = [...i.servicios].sort(porGravedad);
  const r = resumenDe(i);
  const cuenta = (f: Filtro) => (f === "todas" ? todas.length : todas.filter((x) => x.estado === f).length);
  const visibles = filtro === "todas" ? todas : todas.filter((x) => x.estado === filtro);
  const debajo = (s: ServicioVivo) => (s.muyAlta !== null && s.temp !== null && s.estado !== "sindatos" && s.temp < s.muyAlta ? `A ${gradosC(s.muyAlta - s.temp)} de la alarma alta` : null);

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Servicios</h1>
          <p className="gx-vivo" aria-live="off">
            <span className={`gx-punto vivo${r.estado === "correcto" ? "" : ` ${r.estado}`}`} />
            {r.titular} · {i.nombre}, {reloj(ahora)}
          </p>
        </div>
        <span className="gx-acciones" style={{ marginTop: 0 }}>
          <Link href={`/historicos?id=${encodeURIComponent(i.id)}`} className="gx-boton secundario">
            <ChartLine size={18} strokeWidth={1.6} aria-hidden="true" /> Históricos
          </Link>
        </span>
      </header>
      <OrigenVivo i={i} ahora={ahora} />

      <div className="gx-estado">
        {FILTROS.filter((f) => f.id !== "sindatos" || r.mudos > 0 || filtro === "sindatos").map((f) => (
          <button key={f.id} type="button" className={f.id !== "todas" && cuenta(f.id) === 0 ? "vacio" : undefined} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.id !== "todas" && <span className={punto(f.id)} />}
            {f.texto} <b>{cuenta(f.id)}</b>
          </button>
        ))}
        <div className="gx-vistas" role="group" aria-label="Cómo verlas">
          <button type="button" aria-pressed={vista === "cuadricula"} aria-label="Ver en cuadrícula" onClick={() => elegir("cuadricula")}>
            <LayoutGrid size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" aria-pressed={vista === "lista"} aria-label="Ver en lista" onClick={() => elegir("lista")}>
            <List size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="gx-pila">
        {visibles.length === 0 ? (
          <p className="gx-tarjeta gx-vacio">Ningún servicio en este estado.</p>
        ) : vista === "cuadricula" ? (
          <div className="gx-rejilla">
            {visibles.map((s) => (
              <Link key={s.clave} href={enlaceServicio(i, s)} className={`gx-tarjeta gx-camara ${s.estado}`}>
                <div className="arriba">
                  <span className="nombre"><i className={punto(s.estado)} aria-hidden="true" /><h2>{s.nombre}</h2></span>
                  <span className="clase">{s.clase === "tunel" ? "Túnel" : s.consigna !== null && s.consigna < -5 ? "Congelado" : "Fresco"}</span>
                </div>
                <div className="medio">
                  <div>
                    <Lectura s={s} className={`gx-temp${s.estado === "error" ? " error" : ""}`} />
                    <RumboTexto r={s.rumbo} alerta={s.estado === "aviso" || s.estado === "error"} />
                  </div>
                  {s.curva.length > 1 && <Trazo valores={s.curva} limite={limiteDe(s)} />}
                </div>
                {s.temp !== null && s.consigna !== null && <Medidor temp={s.temp} consigna={s.consigna} limite={limiteDe(s)} estado={s.estado} />}
                <div className="gx-camara-pie">
                  <p className="gx-camara-motivo">{s.motivo}{s.consigna !== null && <span>Consigna {gradosC(s.consigna)}</span>}</p>
                  {debajo(s) && <p className="gx-nota">{debajo(s)}</p>}
                  <SenalesVivas s={s} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="gx-renglones">
            {visibles.map((s) => (
              <Link key={s.clave} href={enlaceServicio(i, s)} className={`gx-renglon ${s.estado}`}>
                <span className="nombre">
                  <i className={punto(s.estado)} aria-hidden="true" />
                  <span>{s.nombre}<small>{s.consigna !== null ? `Consigna ${gradosC(s.consigna)}` : "Sin consigna leída"}</small></span>
                </span>
                <span className="cifra">
                  <Lectura s={s} />
                  <RumboTexto r={s.rumbo} alerta={s.estado === "aviso" || s.estado === "error"} />
                </span>
                <span className="medida">{s.temp !== null && s.consigna !== null && <Medidor temp={s.temp} consigna={s.consigna} limite={limiteDe(s)} estado={s.estado} />}</span>
                <span className="solo-ancho">{s.curva.length > 1 && <Trazo valores={s.curva} limite={limiteDe(s)} />}</span>
                <span className="solo-ancho"><SenalesVivas s={s} /></span>
                <span className="fin">
                  <b className="gx-camara-motivo">{s.motivo}</b>
                  {debajo(s) && <small className="gx-nota" style={{ display: "block", marginTop: 4 }}>{debajo(s)}</small>}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function HoyVivo({ i }: { i: InstalacionViva }) {
  const ahora = useDemo().ahora ?? Date.now();
  const r = resumenDe(i);
  const servicios = [...i.servicios].sort(porGravedad);
  const peor = servicios[0];
  const enfriando = i.servicios.filter((s) => s.enfriando).length;
  const marcha = i.compresores.filter((c) => c.marcha).length;
  const bloqueados = i.compresores.filter((c) => c.bloqueado);
  const fechaLarga = new Date(ahora).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const tareas: { clave: string; clase: Estado; titulo: string; detalle: string; href: string }[] = [];
  if (!i.conectada) tareas.push({ clave: "pasarela", clase: "sindatos", titulo: "La pasarela no entrega", detalle: i.entrega ? `Última entrega ${haceTexto(ahora, i.entrega)}. Mira que el ordenador de la planta esté encendido y con internet.` : "Todavía no ha entregado nada.", href: "/conexiones" });
  for (const s of servicios) if (s.estado === "error" || s.estado === "aviso") tareas.push({ clave: s.clave, clase: s.estado, titulo: `${s.nombre}: ${s.motivo.charAt(0).toLowerCase()}${s.motivo.slice(1)}`, detalle: s.temp !== null ? `Está a ${gradosC(s.temp)}${s.consigna !== null ? ` con consigna ${gradosC(s.consigna)}` : ""}.` : "Abrir su histórico.", href: enlaceServicio(i, s) });
  for (const c of bloqueados) tareas.push({ clave: c.nombre, clase: "aviso", titulo: `${c.nombre} bloqueado`, detalle: "El autómata lo tiene bloqueado: no arrancará hasta que se desbloquee.", href: `/historicos?id=${encodeURIComponent(i.id)}` });

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Hoy</h1>
          <p className="gx-sub">{fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)} · {i.nombre}</p>
        </div>
      </header>
      <OrigenVivo i={i} ahora={ahora} />

      <div className="gx-pila">
        <div className="gx-mosaico">
          <section className={`gx-tarjeta gx-hoy ${r.estado}`}>
            <span className="gx-hoy-aro" aria-hidden="true" />
            <div className="gx-hoy-texto">
              <strong>{r.titular}</strong>
              <span>{i.servicios.length} servicios{i.entrega ? ` · última entrega ${haceTexto(ahora, i.entrega)}` : ""}</span>
            </div>
            {r.estado !== "correcto" && peor && (
              <Link href={!i.conectada ? "/conexiones" : enlaceServicio(i, peor)} className="gx-boton">
                {!i.conectada ? "Ver las conexiones" : `Ver ${peor.nombre}`}
              </Link>
            )}
          </section>

          <div className="gx-cifras sueltas">
            <Link href="/servicios" className={r.alarmas || r.mudos ? "mal" : undefined}><span>Servicios bien</span><strong>{r.bien} <small>de {i.servicios.length}</small></strong></Link>
            <Link href="/servicios" className={r.alarmas ? "mal" : undefined}><span>Avisos ahora</span><strong>{r.alarmas + r.avisos}</strong></Link>
            <Link href="/servicios"><span>Enfriando ahora</span><strong>{enfriando} <small>de {i.servicios.length}</small></strong></Link>
            {i.compresores.length > 0 ? (
              <Link href={`/historicos?id=${encodeURIComponent(i.id)}`} className={bloqueados.length ? "mal" : "realce"}><span>Compresores en marcha</span><strong>{marcha} <small>de {i.compresores.length}</small></strong></Link>
            ) : (
              <Link href={`/historicos?id=${encodeURIComponent(i.id)}`} className="realce"><span>Históricos</span><strong>Ver</strong></Link>
            )}
          </div>
        </div>

        <div className="gx-dos">
          <section className="gx-tarjeta">
            <h2>Qué mirar ahora</h2>
            {tareas.length === 0 ? (
              <p className="gx-vacio">Nada que mirar: todos los servicios están dentro de sus alarmas.</p>
            ) : (
              <ul className="gx-tareas">
                {tareas.map((t) => (
                  <li key={t.clave}>
                    <Link href={t.href}>
                      <i className={`gx-punto ${t.clase}`} />
                      <span>
                        <strong>{t.titulo}</strong>
                        <small>{t.detalle}</small>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="gx-tarjeta">
            <div className="gx-fila"><h2>Servicios</h2><Link href="/servicios" className="gx-enlace">Ver todos</Link></div>
            <ul className="gx-tareas compacta">
              {servicios.map((s) => (
                <li key={s.clave}>
                  <Link href={enlaceServicio(i, s)}>
                    <i className={punto(s.estado)} />
                    <span><strong>{s.nombre}</strong></span>
                    <Lectura s={s} className={`gx-lectura${s.estado === "sindatos" ? " apagada" : ""}`} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

/** En la nave de demostración, la tarjeta que dice que hay una instalación conectada y lleva a ella. */
export function ConectadasEnDemo() {
  const { instalaciones } = useInstalaciones();
  const ahora = useDemo().ahora ?? Date.now();
  if (!instalaciones?.length) return null;
  return (
    <>
      {instalaciones.map((i) => {
        const r = resumenDe(i);
        return (
          <section key={i.id} className="gx-tarjeta gx-conectada" aria-label={`Instalación conectada: ${i.nombre}`}>
            <i className={`${punto(r.estado)}${i.conectada ? " vivo" : ""}`} aria-hidden="true" />
            <p>
              <strong>{i.nombre}</strong>
              <small>
                {i.servicios.length} servicios · {r.titular.toLowerCase()}
                {i.entrega ? ` · ${haceTexto(ahora, i.entrega)}` : ""}
                {i.simulada ? " · autómata simulado" : ""}
              </small>
            </p>
            <button type="button" className="gx-boton" onClick={() => elegirNave(i.id)}>Verla en directo</button>
          </section>
        );
      })}
    </>
  );
}
