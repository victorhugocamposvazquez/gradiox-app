"use client";

import Link from "next/link";
import { Router, Server } from "lucide-react";
import { duracion, hora } from "@/lib/formato";
import { AUTOMATAS, CAMARAS, PASARELA, SONDEO_S } from "@/lib/sim";
import { useDemo } from "@/lib/store";

const SENALES = ["Temperatura", "Puerta", "Compresor"];
const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;

export default function Conexiones() {
  const { ahora, ajustes, cortarConexion, restablecerConexion } = useDemo();
  if (ahora === null) return <p className="gx-sub">Comprobando las conexiones…</p>;

  const cortes = ajustes.cortes ?? {};
  const pasarelaCaida = cortes[PASARELA.id];
  const equipos = AUTOMATAS.map((a) => {
    const propio = cortes[a.id];
    const desde = [pasarelaCaida, propio].filter((d): d is number => d !== undefined);
    return { a, propio, caido: desde.length ? Math.min(...desde) : null };
  });
  const caidos = equipos.filter((e) => e.caido !== null).length;
  const mudos = equipos.filter((e) => e.caido !== null).reduce((n, e) => n + e.a.camaras.length, 0);
  // Con conexión, la última lectura es la del último sondeo.
  const ultimoSondeo = Math.floor(ahora / (SONDEO_S * 1000)) * SONDEO_S * 1000;
  const hace = (t: number) => {
    const s = Math.max(0, Math.round((ahora - t) / 1000));
    return s < 60 ? `hace ${s} s` : `hace ${duracion(ahora - t)}`;
  };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Conexiones</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${caidos || pasarelaCaida ? " error" : ""}`} />
            {pasarelaCaida ? "La pasarela no responde: no llega nada" : caidos ? `${caidos} ${caidos === 1 ? "autómata sin conexión" : "autómatas sin conexión"} · ${mudos} servicios sin datos` : "Todo conectado y leyendo"}
          </p>
        </div>
      </header>

      <div className="gx-pila">
        <section className={`gx-tarjeta gx-equipo${pasarelaCaida ? " caido" : ""}`}>
          <div className="gx-fila">
            <div className="gx-fila" style={{ gap: 12, justifyContent: "flex-start" }}>
              <Router size={22} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <h2>{PASARELA.nombre}</h2>
                <p className="gx-sub">Une los autómatas con Gradiox</p>
              </div>
            </div>
            <span className={`gx-chip ${pasarelaCaida ? "error" : "correcto"}`}>{pasarelaCaida ? `Sin conexión desde las ${hora(pasarelaCaida)}` : "Conectada"}</span>
          </div>
          <div className="gx-datos">
            <div className="gx-dato"><span>Último contacto</span><strong>{hace(pasarelaCaida ?? ultimoSondeo)}</strong></div>
            <div className="gx-dato"><span>Autómatas</span><strong>{AUTOMATAS.length - (pasarelaCaida ? AUTOMATAS.length : caidos)} de {AUTOMATAS.length} respondiendo</strong></div>
            <div className="gx-dato"><span>Lectura</span><strong>Cada {SONDEO_S} segundos</strong></div>
          </div>
          <div>
            {pasarelaCaida ? (
              <button type="button" className="gx-boton" onClick={() => restablecerConexion(PASARELA.id)}>Restablecer la conexión</button>
            ) : (
              <button type="button" className="gx-boton peligro" onClick={() => cortarConexion(PASARELA.id)}>Probar un corte de la pasarela</button>
            )}
          </div>
        </section>

        <div className="gx-rejilla" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {equipos.map(({ a, propio, caido }) => (
            <section key={a.id} className={`gx-tarjeta gx-equipo${caido !== null ? " caido" : ""}`}>
              <div className="gx-fila">
                <div className="gx-fila" style={{ gap: 12, justifyContent: "flex-start" }}>
                  <Server size={22} strokeWidth={1.6} aria-hidden="true" />
                  <div>
                    <h2>{a.nombre}</h2>
                    <p className="gx-sub">{a.camaras.length} servicios</p>
                  </div>
                </div>
                <span className={`gx-chip ${caido !== null ? "error" : "correcto"}`}>{caido !== null ? "Sin conexión" : "Conectado"}</span>
              </div>
              <p className="gx-nota">
                {caido !== null
                  ? `Última lectura ${hace(caido)}, a las ${hora(caido)}. ${propio === undefined ? "El autómata puede estar bien: lo que falla es la pasarela." : "Revisar la alimentación del autómata y el cable o la red hasta la pasarela."}`
                  : `Última lectura ${hace(ultimoSondeo)}.`}
              </p>
              <table className="gx-sondas">
                <thead>
                  <tr>
                    <th scope="col">Servicio</th>
                    {SENALES.map((s) => <th key={s} scope="col">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {a.camaras.map((id) => (
                    <tr key={id}>
                      <td><Link href={`/servicios/${id}`} style={{ fontWeight: 500 }}>{nombre(id)}</Link></td>
                      {SENALES.map((s) => (
                        <td key={s}>
                          <span>
                            <i className={`gx-punto${caido !== null ? " sindatos" : ""}`} />
                            {caido !== null ? "Sin señal" : "Llega"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {propio !== undefined ? (
                <div><button type="button" className="gx-boton" onClick={() => restablecerConexion(a.id)}>Restablecer la conexión</button></div>
              ) : caido === null ? (
                <div><button type="button" className="gx-boton peligro" onClick={() => cortarConexion(a.id)}>Probar un corte</button></div>
              ) : null}
            </section>
          ))}
        </div>
        <p className="gx-nota">Conexiones simuladas: no hay ningún autómata detrás. Los cortes son para ver cómo reacciona el programa. Con una instalación real aquí saldrían también la marca y el modelo de cada autómata y las sondas que fallan una a una.</p>
      </div>
    </>
  );
}
