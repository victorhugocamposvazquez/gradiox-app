"use client";

import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { permiso } from "@/lib/dispositivo";
import { EQUIPOS, proxima } from "@/lib/equipos";
import { hora } from "@/lib/formato";
import { TIPOS, type TipoNoti } from "@/lib/notificaciones";
import { GRUPOS, comprobaciones, resumen, type Grupo, type Nivel } from "@/lib/sistema";
import { AUTOMATAS, CAMARAS, PASARELA, SONDEO_S, eventos, fuenteActual, leer } from "@/lib/datos";
import { estadoAlarma, useDemo } from "@/lib/store";

const ROTULO: Record<Nivel, string> = { bien: "Bien", mirar: "Mirar", mal: "Falla", simulado: "Simulado" };
type Latido = { ms: number | null; desfaseS: number | null };

export default function Sistema() {
  const { ahora, ajustes, atendidas, seguimientos, registro, fallos, preferencias, guardias, esperaMin, precioReal, precioLeido } = useDemo();
  const [latido, setLatido] = useState<Latido | null>(null);
  const [trabajador, setTrabajador] = useState<boolean | null>(null);
  const [soloFallos, setSoloFallos] = useState(false);

  // Pregunta al servidor cada 20 s: si contesta, cuánto tarda y qué hora tiene.
  useEffect(() => {
    let vivo = true;
    const preguntar = async () => {
      const salida = Date.now();
      try {
        const r = await fetch("/api/estado", { cache: "no-store" });
        const llegada = Date.now();
        const d = (await r.json()) as { hora?: number };
        if (!r.ok || typeof d.hora !== "number") throw new Error("sin hora");
        if (vivo) setLatido({ ms: llegada - salida, desfaseS: Math.round(((salida + llegada) / 2 - d.hora) / 1000) });
      } catch {
        if (vivo) setLatido({ ms: null, desfaseS: null });
      }
    };
    void preguntar();
    const id = window.setInterval(preguntar, 20_000);
    navigator.serviceWorker?.getRegistration().then((r) => vivo && setTrabajador(Boolean(r))).catch(() => vivo && setTrabajador(false));
    if (!("serviceWorker" in navigator)) setTrabajador(false);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, []);

  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);
  const nuevas = useMemo(
    () => (minuto === null ? 0 : eventos(minuto * 60_000, ajustes).filter((e) => e.estado === "error" && estadoAlarma(atendidas[`${e.camaraId}-${e.desde}`], seguimientos[`${e.camaraId}-${e.desde}`]) === "nueva").length),
    [minuto, ajustes, atendidas, seguimientos],
  );
  if (ahora === null) return <p className="gx-sub">Comprobando el sistema…</p>;

  const cortes = ajustes.cortes ?? {};
  const lecturas = CAMARAS.map((c) => leer(c, ahora, ajustes));
  const mudos = lecturas.filter((l) => l.estado === "sindatos").length;
  const ultimoSondeo = Math.floor(ahora / (SONDEO_S * 1000)) * SONDEO_S * 1000;
  let guardado = true;
  try {
    window.localStorage.setItem("gradiox-prueba", "1");
    window.localStorage.removeItem("gradiox-prueba");
  } catch {
    guardado = false;
  }
  const tipos = Object.keys(TIPOS) as TipoNoti[];
  const fuente = fuenteActual();
  const lista = comprobaciones({
    fuente: { nombre: fuente.nombre, simulada: fuente.simulada },
    pasarelaCaida: cortes[PASARELA.id] !== undefined,
    automatas: AUTOMATAS.length,
    automatasCaidos: AUTOMATAS.filter((a) => cortes[a.id] !== undefined).length,
    servicios: CAMARAS.length,
    serviciosMudos: mudos,
    ultimaLecturaS: Math.max(0, Math.round((ahora - ultimoSondeo) / 1000)),
    sondeoS: SONDEO_S,
    precio: { real: precioReal, leido: precioLeido },
    servidor: latido,
    enLinea: navigator.onLine,
    guardado,
    permiso: permiso(),
    trabajador,
    tiposActivos: tipos.filter((t) => preferencias[t]).length,
    tiposTotales: tipos.length,
    guardias: guardias.length,
    esperaMin,
    alarmas: lecturas.filter((l) => l.estado === "error").length,
    alarmasNuevas: nuevas,
    revisionesVencidas: EQUIPOS.filter((e) => proxima(e, registro, ahora).dias < 0).length,
    fallos: fallos.length,
    fallosAuto: fallos.filter((f) => f.auto).length,
    horaTexto: hora,
  });
  const r = resumen(lista);
  const titular = r.mal ? `${r.mal} ${r.mal === 1 ? "cosa falla" : "cosas fallan"}${r.mirar ? ` y ${r.mirar} por mirar` : ""}` : r.mirar ? `Nada falla · ${r.mirar} ${r.mirar === 1 ? "cosa por mirar" : "cosas por mirar"}` : "Todo en su sitio";
  const visibles = soloFallos ? lista.filter((c) => c.nivel === "mal" || c.nivel === "mirar") : lista;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Sistema</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${r.mal ? " error" : r.mirar ? " aviso" : ""}`} />
            {titular} · comprobado a las {new Date(ahora).toLocaleTimeString("es-ES")}
          </p>
        </div>
        <Link href="/conexiones" className="gx-boton secundario">
          <Network size={18} strokeWidth={1.6} aria-hidden="true" /> Esquema de conexiones
        </Link>
      </header>

      <div className="gx-pila">
        <div className="gx-cifras">
          <div className={r.mal ? "mal" : undefined}><span>Comprobaciones bien</span><strong>{r.bien} <small>de {r.cuentan}</small></strong></div>
          <div className={mudos ? "mal" : undefined}><span>Servicios con datos</span><strong>{CAMARAS.length - mudos} <small>de {CAMARAS.length}</small></strong></div>
          <div className={latido?.ms === null ? "mal" : undefined}><span>Servidor</span><strong>{latido === null ? "…" : latido.ms === null ? "No contesta" : <>{latido.ms} <small>ms</small></>}</strong></div>
          <div><span>Origen de los datos</span><strong>{fuente.nombre}</strong></div>
        </div>

        <div className="gx-periodos" role="group" aria-label="Qué se ve">
          <button type="button" aria-pressed={!soloFallos} onClick={() => setSoloFallos(false)}>Todo · {lista.length}</button>
          <button type="button" aria-pressed={soloFallos} onClick={() => setSoloFallos(true)}>Solo lo que hay que mirar · {r.mal + r.mirar}</button>
        </div>

        {visibles.length === 0 && <p className="gx-tarjeta gx-vacio">Nada que mirar. Todas las comprobaciones están bien.</p>}
        <div className="gx-dos">
          {(Object.keys(GRUPOS) as Grupo[]).map((g) => {
            const filas = visibles.filter((c) => c.grupo === g);
            if (!filas.length) return null;
            return (
              <section key={g} className="gx-tarjeta">
                <h2>{GRUPOS[g].titulo}</h2>
                <p className="gx-sub">{GRUPOS[g].detalle}</p>
                <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
                  {filas.map((c) => (
                    <li key={c.id}>
                      <span className={`gx-punto ${c.nivel}`} role="img" aria-label={ROTULO[c.nivel]} />
                      <span>
                        <strong style={{ fontWeight: 500 }}>{c.titulo}</strong> · <span className={`gx-nivel ${c.nivel}`}>{ROTULO[c.nivel]}</span>
                        <small>{c.detalle}</small>
                      </span>
                      {c.href && (
                        <Link href={c.href} className="gx-volver" aria-label={`Ver ${c.titulo.toLowerCase()}`}>
                          Ver <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="gx-nota">Qué es de verdad aquí y qué no: el servidor, el reloj, el precio de la luz y todo lo de «Este dispositivo» se comprueban de verdad. La pasarela, los autómatas y las lecturas son de la simulación, y las guardias no avisan a nadie.</p>
      </div>
    </>
  );
}
