"use client";

import Link from "next/link";
import { ChevronRight, FileText, Play } from "lucide-react";
import { useMemo } from "react";
import { useGuion } from "@/components/guion";
import { Temp } from "@/components/piezas";
import { consumoHoy, minutosAlLimite } from "@/lib/analisis";
import { EQUIPOS, proxima } from "@/lib/equipos";
import { fallosAhora } from "@/lib/fallos";
import { duracion, euros, hora } from "@/lib/formato";
import { planDelDia, preciosDelDia } from "@/lib/luz";
import { NAVES } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, SONDEO_S, leer, type Estado } from "@/lib/datos";
import { useDemo } from "@/lib/store";

type Tarea = { clave: string; clase: Estado | "neutro"; titulo: string; detalle: string; href: string };
const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
const horas = (hs: number[]) => hs.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ");

export default function Hoy() {
  const { ahora, ajustes, fallos, registro, notis, precioReal } = useDemo();
  const { empezar, paso } = useGuion();
  const tramo = ahora === null ? null : Math.floor(ahora / 300_000);
  const gasto = useMemo(() => (tramo === null ? 0 : CAMARAS.reduce((a, c) => a + consumoHoy(c, tramo * 300_000, ajustes).euros, 0)), [tramo, ajustes]);
  if (ahora === null) return <p className="gx-sub">Mirando cómo está todo…</p>;

  const servicios = CAMARAS.map((c) => ({ c, l: leer(c, ahora, ajustes) }));
  const cuenta = (e: Estado) => servicios.filter((s) => s.l.estado === e).length;
  const alarmas = cuenta("error");
  const avisos = cuenta("aviso");
  const mudos = cuenta("sindatos");
  const cortes = ajustes.cortes ?? {};
  const equiposCaidos = [PASARELA, ...AUTOMATAS].filter((e) => cortes[e.id] !== undefined);
  const totalEquipos = AUTOMATAS.length + 1;
  const general: Estado = alarmas ? "error" : mudos ? "sindatos" : avisos ? "aviso" : "correcto";
  const peor = [...servicios].sort((a, b) => GRAVEDAD[a.l.estado] - GRAVEDAD[b.l.estado])[0];
  const titular =
    general === "error" ? `${alarmas} ${alarmas === 1 ? "servicio en alarma" : "servicios en alarma"}`
    : general === "sindatos" ? `${mudos} ${mudos === 1 ? "servicio sin datos" : "servicios sin datos"}`
    : general === "aviso" ? `${avisos} ${avisos === 1 ? "servicio con aviso" : "servicios con aviso"}`
    : "Todo en orden";
  const segundos = Math.round((ahora - Math.floor(ahora / (SONDEO_S * 1000)) * SONDEO_S * 1000) / 1000);
  const fechaLarga = new Date(ahora).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const fecha = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);

  const tareas: Tarea[] = [];
  for (const e of equiposCaidos) tareas.push({ clave: e.id, clase: "error", titulo: `${e.nombre} sin conexión`, detalle: `Desde las ${hora(cortes[e.id])}. Sus servicios no mandan datos.`, href: "/conexiones" });
  for (const { c, l } of [...servicios].sort((a, b) => GRAVEDAD[a.l.estado] - GRAVEDAD[b.l.estado])) {
    if (l.estado !== "error" && l.estado !== "aviso") continue;
    const fallo = fallosAhora(fallos, c, l)[0];
    const queda = minutosAlLimite(c, ahora, ajustes);
    const plazo = queda !== null && l.temp < c.limite ? ` Llega al límite en ${duracion(queda * 60_000)}.` : "";
    tareas.push({ clave: c.id, clase: l.estado, titulo: `${c.nombre}: ${l.motivo.toLowerCase()}`, detalle: `${fallo ? fallo.revisar : "Abrir la ficha para ver qué hacer."}${plazo}`, href: `/servicios/${c.id}` });
  }
  const revisiones = EQUIPOS.map((e) => ({ e, p: proxima(e, registro, ahora) })).filter((x) => x.p.dias <= 7).sort((a, b) => a.p.dias - b.p.dias).slice(0, 3);
  for (const { e, p } of revisiones)
    tareas.push({ clave: e.id, clase: p.dias < 0 ? "aviso" : "neutro", titulo: `Revisión de ${e.nombre.toLowerCase()}`, detalle: p.dias < 0 ? `Vencida hace ${-p.dias} ${p.dias === -1 ? "día" : "días"}.` : p.dias === 0 ? "Toca hoy." : `Toca en ${p.dias} ${p.dias === 1 ? "día" : "días"}.`, href: `/mantenimiento?equipo=${e.id}&tipo=Revisión` });
  const plan = planDelDia(preciosDelDia(new Date(ahora)));
  if (!ajustes.planActivo) tareas.push({ clave: "luz", clase: "neutro", titulo: "El plan de luz está parado", detalle: `Las horas baratas de hoy son ${horas(plan.baratas)}.${precioReal ? "" : " Precio simulado."}`, href: "/luz" });

  const sinLeer = notis.filter((n) => !n.leida).length;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Hoy</h1>
          <p className="gx-sub">{fecha} · <Link href="/naves" className="gx-enlace">{NAVES[0].nombre}</Link></p>
        </div>
        <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
          <Link href="/informe" className="gx-boton secundario">
            <FileText size={16} strokeWidth={1.7} aria-hidden="true" /> Informe del día
          </Link>
          {paso === null && (
            <button type="button" className="gx-boton secundario" onClick={empezar}>
              <Play size={16} strokeWidth={1.7} aria-hidden="true" /> Ver una demostración
            </button>
          )}
        </div>
      </header>

      <div className="gx-pila">
        <section className={`gx-tarjeta gx-hoy ${general}`}>
          <span className="gx-hoy-aro" aria-hidden="true" />
          <div className="gx-hoy-texto">
            <strong>{titular}</strong>
            <span>{CAMARAS.length} servicios · última lectura hace {segundos} s</span>
          </div>
          {general !== "correcto" && (
            <Link href={general === "sindatos" ? "/conexiones" : `/servicios/${peor.c.id}`} className="gx-boton">
              {general === "sindatos" ? "Ver las conexiones" : `Ver ${peor.c.nombre}`}
            </Link>
          )}
        </section>

        <div className="gx-cifras">
          <Link href="/servicios" className={alarmas || mudos ? "mal" : undefined}><span>Servicios bien</span><strong>{cuenta("correcto")} <small>de {CAMARAS.length}</small></strong></Link>
          <Link href="/avisos" className={alarmas ? "mal" : undefined}><span>Avisos abiertos</span><strong>{alarmas + avisos}</strong></Link>
          <Link href="/conexiones" className={equiposCaidos.length ? "mal" : undefined}><span>Equipos conectados</span><strong>{totalEquipos - equiposCaidos.length} <small>de {totalEquipos}</small></strong></Link>
          <Link href="/luz"><span>Gasto de luz de hoy</span><strong>{euros(gasto)} <small>estimado</small></strong></Link>
        </div>

        <div className="gx-dos">
          <section className="gx-tarjeta">
            <h2>Qué toca hoy</h2>
            {tareas.length === 0 ? (
              <p className="gx-vacio">Nada pendiente. Las revisiones de esta semana están al día.</p>
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

          <div className="gx-pila">
            <section className="gx-tarjeta">
              <div className="gx-fila"><h2>Servicios</h2><Link href="/servicios" className="gx-enlace">Ver todos</Link></div>
              <ul className="gx-tareas compacta">
                {servicios.map(({ c, l }) => (
                  <li key={c.id}>
                    <Link href={`/servicios/${c.id}`}>
                      <i className={`gx-punto ${l.estado === "correcto" ? "" : l.estado}`} />
                      <span><strong>{c.nombre}</strong></span>
                      <Temp valor={l.temp} className={`gx-lectura${l.estado === "sindatos" ? " apagada" : ""}`} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section className="gx-tarjeta">
              <div className="gx-fila"><h2>Notificaciones</h2><Link href="/notificaciones" className="gx-enlace">{sinLeer ? `${sinLeer} sin leer` : "Ver todas"}</Link></div>
              {notis.length === 0 ? (
                <p className="gx-vacio">Ninguna desde que abriste Gradiox.</p>
              ) : (
                <ul className="gx-tareas compacta">
                  {notis.slice(0, 3).map((n) => (
                    <li key={n.id}>
                      <Link href={n.href}>
                        <i className={`gx-punto ${n.tipo === "alarma" || n.tipo === "conexion" ? "error" : n.tipo === "recuperado" ? "" : "aviso"}`} />
                        <span><strong style={{ fontWeight: n.leida ? 400 : 600 }}>{n.titulo}</strong></span>
                        <time>{hora(n.cuando)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
