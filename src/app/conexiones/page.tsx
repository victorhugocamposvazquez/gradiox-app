"use client";

import Link from "next/link";
import { ArrowLeft, Cloud, DoorOpen, Fan, LayoutGrid, List, Plug, Router, Server, Thermometer, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { duracion, hora } from "@/lib/formato";
import { AUTOMATAS, CAMARAS, PASARELA, SONDEO_S } from "@/lib/datos";
import { tiempoConectado } from "@/lib/conexiones";
import { useDemo } from "@/lib/store";

type Vista = "esquema" | "lista";
const CLAVE_VISTA = "gradiox-vista-conexiones";
const SENALES: { nombre: string; Icono: LucideIcon }[] = [
  { nombre: "Temperatura", Icono: Thermometer },
  { nombre: "Puerta", Icono: DoorOpen },
  { nombre: "Compresor", Icono: Fan },
];
const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;

function Nodo({ Icono, titulo, detalle, caido, children }: { Icono: LucideIcon; titulo: string; detalle: string; caido: boolean; children?: ReactNode }) {
  return (
    <div className={`gx-nodo${caido ? " caido" : ""}`}>
      <span className="gx-nodo-icono"><Icono size={20} strokeWidth={1.6} aria-hidden="true" /></span>
      <span className="gx-nodo-texto">
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
      {children}
    </div>
  );
}

const Cable = ({ roto }: { roto: boolean }) => <span className={`gx-cable${roto ? " roto" : ""}`} aria-hidden="true" />;

function Senales({ llegan, id }: { llegan: boolean; id: string }) {
  const c = CAMARAS.find((x) => x.id === id);
  return (
    <span className="gx-llegan">
      {SENALES.filter((x) => !(x.nombre === "Compresor" && c?.sinCompresor) && !(x.nombre === "Puerta" && c?.sinPuerta)).map(({ nombre: n, Icono }) => (
        <span key={n} className={llegan ? "si" : "no"} role="img" aria-label={`${n}: ${llegan ? "llega" : "sin señal"}`} title={`${n}: ${llegan ? "llega" : "sin señal"}`}>
          <Icono size={16} strokeWidth={1.7} aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

export default function Conexiones() {
  const { ahora, ajustes, restablecerConexion, cortesPasados } = useDemo();
  const [vista, setVista] = useState<Vista>("esquema");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === "lista") setVista("lista");
    } catch {
      // Sin almacenamiento se queda en esquema.
    }
  }, []);
  if (ahora === null) return <p className="gx-sub">Comprobando las conexiones…</p>;

  const elegir = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ver arriba.
    }
  };
  const cortes = ajustes.cortes ?? {};
  const pasarelaCaida = cortes[PASARELA.id];
  const equipos = AUTOMATAS.map((a) => {
    const propio = cortes[a.id];
    const desde = [pasarelaCaida, propio].filter((d): d is number => d !== undefined);
    return { a, propio, caido: desde.length ? Math.min(...desde) : null };
  });
  const caidos = equipos.filter((e) => e.caido !== null).length;
  const mudos = equipos.filter((e) => e.caido !== null).reduce((n, e) => n + e.a.camaras.length, 0);
  const total = AUTOMATAS.length + 1;
  const conectados = total - caidos - (pasarelaCaida !== undefined ? 1 : 0);
  // Con conexión, la última lectura es la del último sondeo.
  const ultimoSondeo = Math.floor(ahora / (SONDEO_S * 1000)) * SONDEO_S * 1000;
  const hace = (t: number) => {
    const s = Math.max(0, Math.round((ahora - t) / 1000));
    return s < 60 ? `hace ${s} s` : `hace ${duracion(ahora - t)}`;
  };
  const consejo = (propio: number | undefined) => (propio === undefined ? "El autómata puede estar bien: lo que falla es la pasarela." : "Revisar la alimentación del autómata y el cable o la red hasta la pasarela.");
  const corte = (id: string, cortado: boolean) =>
    cortado ? (
      <button type="button" className="gx-boton" onClick={() => restablecerConexion(id)}>
        <Plug size={18} strokeWidth={1.7} aria-hidden="true" /> Restablecer
      </button>
    ) : null;

  return (
    <>
      <Link href="/sistema" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Sistema
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Conexiones</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${caidos || pasarelaCaida ? " error" : ""}`} />
            {pasarelaCaida ? "La pasarela no responde: no llega nada" : caidos ? `${caidos} ${caidos === 1 ? "autómata sin conexión" : "autómatas sin conexión"} · ${mudos} servicios sin datos` : "Todo conectado y leyendo"}
          </p>
        </div>
        <div className="gx-vistas" role="group" aria-label="Cómo verlas">
          <button type="button" aria-pressed={vista === "esquema"} aria-label="Ver en esquema" onClick={() => elegir("esquema")}>
            <LayoutGrid size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" aria-pressed={vista === "lista"} aria-label="Ver en lista" onClick={() => elegir("lista")}>
            <List size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="gx-pila">
        <div className="gx-cifras">
          <div className={conectados < total ? "mal" : undefined}><span>Equipos conectados</span><strong>{conectados} <small>de {total}</small></strong></div>
          <div className={mudos ? "mal" : undefined}><span>Servicios con datos</span><strong>{CAMARAS.length - mudos} <small>de {CAMARAS.length}</small></strong></div>
          <div><span>Última lectura</span><strong>{mudos === CAMARAS.length ? hace(Math.min(...equipos.map((e) => e.caido ?? ahora))) : hace(ultimoSondeo)}</strong></div>
          <div><span>Ritmo de lectura</span><strong>{SONDEO_S} <small>segundos</small></strong></div>
        </div>

        {vista === "esquema" ? (
          <>
            <section className="gx-tarjeta gx-esquema" aria-label="Esquema de la conexión">
              <Nodo Icono={Cloud} titulo="Gradiox" detalle="Este programa" caido={false} />
              <Cable roto={pasarelaCaida !== undefined} />
              <Nodo Icono={Router} titulo={PASARELA.nombre} detalle={pasarelaCaida !== undefined ? `Sin conexión desde las ${hora(pasarelaCaida)}` : `Contestó ${hace(ultimoSondeo)}`} caido={pasarelaCaida !== undefined}>
                {corte(PASARELA.id, pasarelaCaida !== undefined)}
              </Nodo>
              <div className="gx-ramas">
                {equipos.map(({ a, caido }) => (
                  <div key={a.id}>
                    <Cable roto={caido !== null} />
                    <Nodo Icono={Server} titulo={a.nombre} detalle={caido !== null ? `Sin conexión desde las ${hora(caido)}` : `${a.camaras.length} servicios leyendo`} caido={caido !== null} />
                  </div>
                ))}
              </div>
            </section>

            <div className="gx-rejilla" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {equipos.map(({ a, propio, caido }) => (
                <section key={a.id} className={`gx-tarjeta gx-equipo${caido !== null ? " caido" : ""}`}>
                  <div className="gx-fila">
                    <div>
                      <h2>{a.nombre}</h2>
                      <p className="gx-sub">{caido !== null ? `Última lectura ${hace(caido)}` : `Última lectura ${hace(ultimoSondeo)}`}</p>
                    </div>
                    <span className={`gx-chip ${caido !== null ? "error" : "correcto"}`}>{caido !== null ? "Sin conexión" : "Conectado"}</span>
                  </div>
                  <ul className="gx-enlaces">
                    {a.camaras.map((id) => (
                      <li key={id}>
                        <Link href={`/servicios/${id}`}>{nombre(id)}</Link>
                        <Senales llegan={caido === null} id={id} />
                      </li>
                    ))}
                  </ul>
                  {caido !== null && <p className="gx-nota">{consejo(propio)}</p>}
                  <div>{corte(a.id, propio !== undefined)}</div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <div className="gx-renglones gx-red">
            <div className={`gx-renglon${pasarelaCaida !== undefined ? " error" : ""}`}>
              <span className="nombre"><Router size={18} strokeWidth={1.6} aria-hidden="true" />{PASARELA.nombre}</span>
              <span><span className={`gx-chip ${pasarelaCaida !== undefined ? "error" : "correcto"}`}>{pasarelaCaida !== undefined ? "Sin conexión" : "Conectada"}</span></span>
              <span className="cuando">{hace(pasarelaCaida ?? ultimoSondeo)}</span>
              <span className="solo-ancho gx-sub">{AUTOMATAS.length - (pasarelaCaida !== undefined ? AUTOMATAS.length : caidos)} de {AUTOMATAS.length} autómatas</span>
              <span className="fin">{corte(PASARELA.id, pasarelaCaida !== undefined)}</span>
            </div>
            {equipos.map(({ a, propio, caido }) => (
              <div key={a.id} className="gx-grupo">
                <div className={`gx-renglon${caido !== null ? " error" : ""}`}>
                  <span className="nombre"><Server size={18} strokeWidth={1.6} aria-hidden="true" />{a.nombre}</span>
                  <span><span className={`gx-chip ${caido !== null ? "error" : "correcto"}`}>{caido !== null ? "Sin conexión" : "Conectado"}</span></span>
                  <span className="cuando">{hace(caido ?? ultimoSondeo)}</span>
                  <span className="solo-ancho gx-sub">{caido !== null ? consejo(propio) : `${a.camaras.length} servicios`}</span>
                  <span className="fin">{corte(a.id, propio !== undefined)}</span>
                </div>
                {a.camaras.map((id) => (
                  <Link key={id} href={`/servicios/${id}`} className={`gx-renglon hijo${caido !== null ? " sindatos" : ""}`}>
                    <span className="nombre">{nombre(id)}</span>
                    <span><span className={`gx-chip ${caido !== null ? "sindatos" : "correcto"}`}>{caido !== null ? "Sin datos" : "Llegan datos"}</span></span>
                    <span className="cuando">{hace(caido ?? ultimoSondeo)}</span>
                    <span className="solo-ancho"><Senales llegan={caido === null} id={id} /></span>
                    <span className="fin solo-ancho gx-sub">Ver el servicio</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}

        <section className="gx-tarjeta">
          <h2>Histórico de cortes</h2>
          <p className="gx-sub">Tiempo conectado en las últimas 24 horas y cada corte con lo que duró</p>
          <table className="gx-tabla" style={{ marginTop: 8 }}>
            <thead>
              <tr><th scope="col">Equipo</th><th scope="col">Conectado, 24 h</th><th scope="col">Cortes</th></tr>
            </thead>
            <tbody>
              {[PASARELA, ...AUTOMATAS].map((q) => {
                const pct = tiempoConectado(cortesPasados, q.id, ahora, cortes[q.id]);
                return (
                  <tr key={q.id}>
                    <td>{q.nombre}</td>
                    <td style={pct < 100 ? { color: "var(--gx-error)" } : undefined}>{pct.toString().replace(".", ",")} %</td>
                    <td>{cortesPasados.filter((c) => c.equipoId === q.id).length + (cortes[q.id] !== undefined ? 1 : 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cortesPasados.length === 0 && Object.keys(cortes).length === 0 ? (
            <p className="gx-vacio">Ningún corte apuntado.</p>
          ) : (
            <ul className="gx-lista gx-cortes" style={{ marginTop: 8 }}>
              {[PASARELA, ...AUTOMATAS].filter((q) => cortes[q.id] !== undefined).map((q) => (
                <li key={`abierto-${q.id}`}>
                  <span>{q.nombre}<small>Desde las {hora(cortes[q.id])} · sigue, lleva {duracion(ahora - cortes[q.id])}</small></span>
                  <span className="gx-chip error">Sin conexión</span>
                </li>
              ))}
              {cortesPasados.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <span>{[PASARELA, ...AUTOMATAS].find((q) => q.id === c.equipoId)?.nombre ?? c.equipoId}<small>{new Date(c.desde).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, de {hora(c.desde)} a {hora(c.hasta)} · duró {c.hasta - c.desde < 60_000 ? `${Math.max(1, Math.round((c.hasta - c.desde) / 1000))} s` : duracion(c.hasta - c.desde)}</small></span>
                  <span className="gx-chip neutro">Recuperado</span>
                </li>
              ))}
            </ul>
          )}
          <p className="gx-nota" style={{ marginTop: 10 }}>Solo cuenta los cortes vistos desde este dispositivo: antes de eso no hay histórico y no se inventa. Con un servidor vigilando, aquí saldría el mes entero.</p>
        </section>

        <p className="gx-nota">Conexiones simuladas: no hay ningún autómata detrás. Los cortes son para ver cómo reacciona el programa. Con una instalación real aquí saldrían también la marca y el modelo de cada autómata y las sondas que fallan una a una.</p>
      </div>
    </>
  );
}
