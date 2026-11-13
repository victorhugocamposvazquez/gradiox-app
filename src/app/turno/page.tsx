"use client";

import Link from "next/link";
import { Check, Eye, X } from "lucide-react";
import { useMemo, useState } from "react";
import { duracion, hora } from "@/lib/formato";
import { CAMARAS, eventos, leer } from "@/lib/datos";
import { estadoAlarma, useDemo } from "@/lib/store";
import { avanceRonda, fechaLocal, turnoDe } from "@/lib/turno";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const veces = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function Turno() {
  const { ahora, ajustes, atendidas, seguimientos, trabajos, notas, relevos, darRelevo, rondas, puntosRonda, marcarRonda, anadirPunto, quitarPunto } = useDemo();
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
  const marcas = rondas[hoy];
  const avance = avanceRonda(puntosRonda, marcas);
  const ultimo = relevos[0];
  const lineas: { texto: string; detalle: string; href: string; mal: boolean }[] = [
    { texto: mal.length ? veces(mal.length, "servicio no está bien ahora", "servicios no están bien ahora") : "Todos los servicios están bien ahora", detalle: mal.map((x) => `${x.c.nombre}: ${x.l.motivo.toLowerCase()}`).join(" · "), href: "/servicios", mal: mal.some((x) => x.l.estado !== "aviso") },
    { texto: alarmas.length ? veces(alarmas.length, "alarma en este turno", "alarmas en este turno") : "Ninguna alarma en este turno", detalle: alarmas.slice(0, 4).map((e) => `${nombre(e.camaraId)}, a las ${hora(e.desde)}`).join(" · "), href: "/avisos", mal: false },
    { texto: sinResolver.length ? veces(sinResolver.length, "alarma sin resolver", "alarmas sin resolver") : "Ninguna alarma sin resolver", detalle: sinResolver.length ? "De las últimas 24 horas. Quien entra las hereda." : "", href: "/avisos", mal: sinResolver.length > 0 },
    { texto: abiertas.length ? veces(abiertas.length, "orden de trabajo abierta", "órdenes de trabajo abiertas") : "Ninguna orden de trabajo abierta", detalle: abiertas.slice(0, 3).map((o) => o.tarea).join(" · "), href: "/mantenimiento", mal: false },
    { texto: notasTurno.length ? veces(notasTurno.length, "nota apuntada en este turno", "notas apuntadas en este turno") : "Ninguna nota en este turno", detalle: notasTurno.slice(0, 3).map(({ id, n }) => `${nombre(id)}: ${n.texto}`).join(" · "), href: notasTurno[0] ? `/servicios/${notasTurno[0].id}` : "/servicios", mal: false },
    { texto: `Ronda de hoy: ${avance.hechos} de ${avance.total}${avance.aMirar ? `, ${avance.aMirar} por mirar` : ""}`, detalle: avance.hechos < avance.total ? "Sin terminar." : "", href: "#ronda", mal: avance.aMirar > 0 },
  ];
  const resumen = lineas.map((l) => l.texto).join(". ") + ".";
  const dias = Array.from({ length: 7 }, (_, i) => fechaLocal(ahora - (i + 1) * 86_400_000));

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Turno</h1>
          <p className="gx-sub">{turno.nombre}, de {hora(turno.desde)} a {hora(turno.hasta)} · lleva {duracion(ahora - turno.desde)}</p>
        </div>
        {ultimo && <span className="gx-chip neutro">Último relevo: {ultimo.quien}, a las {hora(ultimo.cuando)}</span>}
      </header>

      <div className="gx-dos">
        <div className="gx-pila">
          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <div>
              <h2>Relevo</h2>
              <p className="gx-sub">Lo que se encuentra quien entra</p>
            </div>
            <ul className="gx-lista gx-relevo">
              {lineas.map((l) => (
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
            <p className="gx-nota">Los horarios de turno son de ejemplo: mañana de 6 a 14, tarde de 14 a 22 y noche de 22 a 6.</p>
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

        <section className="gx-tarjeta gx-pila" id="ronda" style={{ gap: 12 }}>
          <div className="gx-fila">
            <div>
              <h2>Ronda de hoy</h2>
              <p className="gx-sub">Lo que se mira a mano, que los sensores no ven</p>
            </div>
            <span className={`gx-chip ${avance.hechos === avance.total && avance.total > 0 ? (avance.aMirar ? "aviso" : "correcto") : "neutro"}`}>{avance.hechos} de {avance.total}</span>
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
                    <span className="gx-vistas" role="group" aria-label={p}>
                      <button type="button" aria-pressed={m?.ok === true} aria-label={`Bien: ${p}`} onClick={() => marcarRonda(hoy, p, true)}><Check size={18} strokeWidth={2} aria-hidden="true" /></button>
                      <button type="button" aria-pressed={m?.ok === false} aria-label={`Hay que mirarlo: ${p}`} onClick={() => marcarRonda(hoy, p, false, m?.nota ?? "")}><Eye size={18} strokeWidth={1.8} aria-hidden="true" /></button>
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
          <div className="gx-fila">
            <p className="gx-nota"><Check size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> bien · <Eye size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> hay que mirarlo. Los puntos son de ejemplo.</p>
            <button type="button" className="gx-boton secundario" onClick={() => setEditando(!editando)}>{editando ? "Hecho" : "Cambiar los puntos"}</button>
          </div>
          <div>
            <h3 className="gx-sub" style={{ margin: "4px 0" }}>Últimos 7 días</h3>
            <ul className="gx-lista">
              {dias.map((f) => {
                const a = avanceRonda(puntosRonda, rondas[f]);
                return (
                  <li key={f}>
                    <span style={{ textTransform: "none" }}>{new Date(`${f}T12:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</span>
                    <span className={`gx-chip ${a.hechos === 0 ? "neutro" : a.aMirar ? "aviso" : a.hechos === a.total ? "correcto" : "neutro"}`}>{a.hechos === 0 ? "Sin hacer" : `${a.hechos} de ${a.total}${a.aMirar ? `, ${a.aMirar} por mirar` : ""}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
