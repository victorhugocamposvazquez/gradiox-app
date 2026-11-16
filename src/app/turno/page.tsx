"use client";

import Link from "next/link";
import { Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { duracion, hora } from "@/lib/formato";
import { CAMARAS, eventos, leer } from "@/lib/datos";
import { llegaBien } from "@/lib/recepcion";
import { estadoAlarma, useDemo } from "@/lib/store";
import { avanceRonda, fechaLocal, turnoDe } from "@/lib/turno";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const veces = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function Turno() {
  const { ahora, ajustes, atendidas, seguimientos, trabajos, notas, recepciones, relevos, darRelevo, rondas, puntosRonda, marcarRonda, anadirPunto, quitarPunto } = useDemo();
  const [editando, setEditando] = useState(false);
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const sucesos = useMemo(() => (minuto === null ? [] : eventos(minuto * 60_000, ajustes, 24)), [minuto, ajustes]);
  if (ahora === null) return <p className="gx-sub">Preparando el relevo…</p>;

  const turno = turnoDe(ahora);
  const hoy = fechaLocal(ahora);
  const delTurno = sucesos.filter((e) => e.hasta >= turno.desde);
  const alarmas = delTurno.filter((e) => e.estado === "error");
  const sinResolver = sucesos.filter((e) => e.estado === "error" && estadoAlarma(atendidas[`${e.camaraId}-${e.desde}`], seguimientos[`${e.camaraId}-${e.desde}`]) !== "resuelta");
  const mal = CAMARAS.map((c) => ({ c, l: leer(c, ahora, ajustes) })).filter((x) => x.l.estado !== "correcto");
  const abiertas = trabajos.filter((o) => !o.cerrada);
  const notasTurno = Object.entries(notas).flatMap(([id, lista]) => lista.filter((n) => n.cuando >= turno.desde).map((n) => ({ id, n })));
  const entradas = recepciones.filter((r) => r.cuando >= turno.desde);
  const altas = entradas.filter((r) => { const c = CAMARAS.find((x) => x.id === r.camaraId); return c ? !llegaBien(r.temp, c.limite) : false; });
  const marcas = rondas[hoy];
  const avance = avanceRonda(puntosRonda, marcas);
  const ultimo = relevos[0];
  const lineas: { texto: string; detalle: string; href: string; mal: boolean }[] = [
    { texto: mal.length ? veces(mal.length, "servicio no está bien ahora", "servicios no están bien ahora") : "Todos los servicios están bien ahora", detalle: mal.map((x) => `${x.c.nombre}: ${x.l.motivo.toLowerCase()}`).join(" · "), href: "/servicios", mal: mal.some((x) => x.l.estado !== "aviso") },
    { texto: alarmas.length ? veces(alarmas.length, "alarma en este turno", "alarmas en este turno") : "Ninguna alarma en este turno", detalle: alarmas.slice(0, 4).map((e) => `${nombre(e.camaraId)}, a las ${hora(e.desde)}`).join(" · "), href: "/avisos", mal: false },
    { texto: sinResolver.length ? veces(sinResolver.length, "alarma sin resolver", "alarmas sin resolver") : "Ninguna alarma sin resolver", detalle: sinResolver.length ? "De las últimas 24 horas. Quien entra las hereda." : "", href: "/avisos", mal: sinResolver.length > 0 },
    { texto: abiertas.length ? veces(abiertas.length, "orden de trabajo abierta", "órdenes de trabajo abiertas") : "Ninguna orden de trabajo abierta", detalle: abiertas.slice(0, 3).map((o) => o.tarea).join(" · "), href: "/mantenimiento", mal: false },
    { texto: notasTurno.length ? veces(notasTurno.length, "nota apuntada en este turno", "notas apuntadas en este turno") : "Ninguna nota en este turno", detalle: notasTurno.slice(0, 3).map(({ id, n }) => `${nombre(id)}: ${n.texto}`).join(" · "), href: notasTurno[0] ? `/servicios/${notasTurno[0].id}` : "/servicios", mal: false },
    { texto: entradas.length ? veces(entradas.length, "entrada de mercancía en este turno", "entradas de mercancía en este turno") : "Ninguna entrada de mercancía en este turno", detalle: altas.length ? `${veces(altas.length, "llegó", "llegaron")} por encima del límite: ${altas.slice(0, 3).map((r) => r.producto).join(", ")}` : entradas.slice(0, 3).map((r) => r.producto).join(" · "), href: "/recepcion", mal: altas.length > 0 },
    { texto: `Ronda de hoy: ${avance.hechos} de ${avance.total}${avance.aMirar ? `, ${avance.aMirar} por mirar` : ""}`, detalle: avance.hechos < avance.total ? "Sin terminar." : "", href: "#ronda", mal: avance.aMirar > 0 },
  ];
  const resumen = lineas.map((l) => l.texto).join(". ") + ".";
  const dias = Array.from({ length: 7 }, (_, i) => fechaLocal(ahora - (i + 1) * 86_400_000));

  const novedades = lineas.slice(0, 6).filter((l, i) => (i === 0 ? mal.length > 0 : !/^Ningun/.test(l.texto)));
  const semana = dias.slice().reverse();
  const hechas = semana.filter((f) => { const a = avanceRonda(puntosRonda, rondas[f]); return a.total > 0 && a.hechos === a.total; }).length;
  const estadoRonda = avance.total > 0 && avance.hechos === avance.total ? (avance.aMirar ? "aviso" : "correcto") : "neutro";

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Turno</h1>
          <p className="gx-sub">{turno.nombre}, de {hora(turno.desde)} a {hora(turno.hasta)} · lleva {duracion(ahora - turno.desde)}</p>
        </div>
        <Link href="/recepcion" className="gx-boton secundario"><Truck size={18} strokeWidth={1.6} aria-hidden="true" /> Recepción de mercancía</Link>
      </header>

      <div className="gx-pila">
        <div className="gx-patron ancho">
          <section className="gx-tarjeta realce gx-foco" aria-label="Relevo">
            <span className="gx-chip">{ultimo ? `Último relevo: ${ultimo.quien}, a las ${hora(ultimo.cuando)}` : "Relevo"}</span>
            <p className="titular">{novedades.length === 0 ? "Sin novedades para quien entra" : veces(novedades.length, "novedad para quien entra", "novedades para quien entra")}</p>
            <p className="detalle">{novedades.length === 0 ? `Los ${CAMARAS.length} servicios están bien. En este turno no ha habido alarmas, órdenes de trabajo, notas ni entradas de mercancía.` : `${novedades.map((l) => l.texto).join(". ")}.`}{avance.hechos < avance.total ? " La ronda está sin terminar." : ""}</p>
            <form
              className="gx-cierre"
              onSubmit={(ev) => {
                ev.preventDefault();
                const campo = ev.currentTarget.elements.namedItem("quien") as HTMLInputElement;
                if (!campo.value.trim()) return;
                darRelevo(campo.value.trim(), turno.nombre, resumen);
                campo.value = "";
              }}
            >
              <label className="gx-campo gx-enlinea">
                <input type="text" name="quien" required aria-label="Quién entra" maxLength={40} placeholder="Quién entra" autoComplete="off" />
              </label>
              <button type="submit" className="gx-boton">Enterado, entro yo</button>
            </form>
          </section>
          <section className="gx-tarjeta gx-foco" aria-label="Ronda de hoy">
            <div className="gx-fila">
              <h2>Ronda de hoy</h2>
              <span className={`gx-chip ${estadoRonda}`}>{avance.hechos === 0 ? "Sin empezar" : avance.hechos < avance.total ? "A medias" : avance.aMirar ? `${avance.aMirar} por mirar` : "Hecha"}</span>
            </div>
            <div style={{ alignSelf: "stretch" }}>
              <p className="cifra" style={{ fontSize: 34 }}>{avance.hechos} <small style={{ fontSize: 13, fontWeight: 400, letterSpacing: 0, color: "var(--gx-gris)" }}>de {avance.total} puntos</small></p>
              <span className="gx-avance" aria-hidden="true"><i style={{ width: `${avance.total ? Math.max(2, (avance.hechos / avance.total) * 100) : 0}%` }} /></span>
            </div>
            <p className="detalle">Lo que se mira a mano, que los sensores no ven.</p>
          </section>
        </div>

        <div className="gx-dos igual">
          <section className="gx-tarjeta gx-pila" id="ronda" style={{ gap: 12 }}>
            <div className="gx-fila">
              <h2>Puntos de la ronda · {avance.hechos} de {avance.total}</h2>
              <button type="button" className="gx-boton-enlace" onClick={() => setEditando(!editando)}>{editando ? "Hecho" : "Cambiar los puntos"}</button>
            </div>
          <ul className="gx-lista gx-ronda">
            {puntosRonda.map((p) => {
              const m = marcas?.[p];
              return (
                <li key={p}>
                  <span>
                    {p}
                    {m && <small>{m.ok ? "Bien" : "Hay que mirarlo"} · a las {hora(m.cuando)}{m.nota ? ` · ${m.nota}` : ""}</small>}
                    {m && !m.ok && (
                      <label className="gx-campo gx-enlinea" style={{ marginTop: 6 }}>
                        <input type="text" aria-label={`Qué pasa en: ${p}`} maxLength={120} placeholder="Qué pasa" defaultValue={m.nota} onBlur={(ev) => ev.target.value !== m.nota && marcarRonda(hoy, p, false, ev.target.value.trim())} />
                      </label>
                    )}
                  </span>
                  {editando ? (
                    <button type="button" className="gx-quitar" aria-label={`Quitar de la ronda: ${p}`} onClick={() => quitarPunto(p)}><X size={18} aria-hidden="true" /></button>
                  ) : (
                    <span className="gx-periodos" role="group" aria-label={p}>
                      <button type="button" aria-pressed={m?.ok === true} aria-label={`Bien: ${p}`} onClick={() => marcarRonda(hoy, p, true)}>Bien</button>
                      <button type="button" aria-pressed={m?.ok === false} aria-label={`Hay que mirarlo: ${p}`} onClick={() => marcarRonda(hoy, p, false, m?.nota ?? "")}>Hay que mirarlo</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {editando && (
            <form
              className="gx-cierre"
              onSubmit={(ev) => {
                ev.preventDefault();
                const campo = ev.currentTarget.elements.namedItem("punto") as HTMLInputElement;
                if (campo.value.trim()) anadirPunto(campo.value.trim());
                campo.value = "";
              }}
            >
              <label className="gx-campo gx-enlinea">
                <input type="text" name="punto" aria-label="Punto nuevo de la ronda" maxLength={80} placeholder="Otro punto que mirar" />
              </label>
              <button type="submit" className="gx-boton secundario">Añadir</button>
            </form>
          )}
            <p className="gx-nota">Los puntos son de ejemplo.</p>
          </section>

          <div className="gx-pila">
            <section className="gx-tarjeta">
              <h2>Lo que se encuentra quien entra</h2>
              <ul className="gx-lista gx-relevo" style={{ marginTop: 6 }}>
                {lineas.slice(0, 6).map((l) => (
                  <li key={l.texto}>
                    <span className={`gx-punto ${l.mal ? "error" : ""}`} aria-hidden="true" />
                    <span>
                      {l.texto}
                      {l.detalle && <small>{l.detalle}</small>}
                    </span>
                    <Link href={l.href} className="gx-volver" aria-label={`Ver: ${l.texto}`}>Ver</Link>
                  </li>
                ))}
              </ul>
              <p className="gx-nota" style={{ marginTop: 8 }}>Los horarios de turno son de ejemplo: mañana de 6 a 14, tarde de 14 a 22 y noche de 22 a 6.</p>
            </section>
            <section className="gx-tarjeta">
              <h2>Rondas de los últimos 7 días</h2>
              <ul className="gx-semana">
                {semana.map((f) => {
                  const a = avanceRonda(puntosRonda, rondas[f]);
                  const d = new Date(`${f}T12:00`);
                  const clase = a.hechos === 0 ? "" : a.aMirar ? "mirar" : a.hechos === a.total ? "hecha" : "medias";
                  return (
                    <li key={f} className={clase} aria-label={`${d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}: ${a.hechos === 0 ? "sin hacer" : `${a.hechos} de ${a.total}${a.aMirar ? `, ${a.aMirar} por mirar` : ""}`}`}>
                      <span aria-hidden="true">{d.toLocaleDateString("es-ES", { weekday: "narrow" }).toUpperCase()}</span>
                      <strong aria-hidden="true">{d.getDate()}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className="gx-nota">{hechas === 0 ? "Ninguna completa en estos siete días." : veces(hechas, "ronda completa", "rondas completas") + " en estos siete días."} Cada día se pinta en verde cuando se completa y en ámbar si quedó algo por mirar.</p>
            </section>
            <section className="gx-tarjeta">
              <h2>Relevos dados</h2>
            {relevos.length === 0 ? (
              <p className="gx-vacio">Aún no se ha dado ningún relevo. El primero queda apuntado al pulsar «Enterado, entro yo».</p>
            ) : (
              <ul className="gx-lista gx-relevos">
                {relevos.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{r.quien}</strong> · {r.turno.toLowerCase()}
                      <small>{new Date(r.cuando).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}, {hora(r.cuando)}</small>
                      <small>{r.resumen}</small>
                    </span>
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
