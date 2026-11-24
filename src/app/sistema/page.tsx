"use client";

import { PestanasInstalacion } from "@/components/mi-instalacion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InstalarApp } from "@/components/instalar-app";
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
  const { ahora, ajustes, atendidas, seguimientos, registro, trabajos, fallos, preferencias, guardias, esperaMin, precioReal, precioLeido } = useDemo();
  const [latido, setLatido] = useState<Latido | null>(null);
  const [trabajador, setTrabajador] = useState<boolean | null>(null);
  const [abierto, setAbierto] = useState<Grupo | null>(null);

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
    ordenesAbiertas: trabajos.filter((o) => !o.cerrada).length,
    ordenesAtrasadas: trabajos.filter((o) => !o.cerrada && o.fecha < new Date(ahora).toISOString().slice(0, 10)).length,
    fallos: fallos.length,
    fallosAuto: fallos.filter((f) => f.auto).length,
    horaTexto: hora,
  });
  const r = resumen(lista);
  const titular = r.mal ? `${r.mal} ${r.mal === 1 ? "cosa falla" : "cosas fallan"}${r.mirar ? ` y ${r.mirar} por mirar` : ""}` : r.mirar ? `Nada falla · ${r.mirar} ${r.mirar === 1 ? "cosa por mirar" : "cosas por mirar"}` : "Todo en su sitio";
  const pendientes = lista.filter((c) => c.nivel === "mal").concat(lista.filter((c) => c.nivel === "mirar"));
  const foco = pendientes[0];
  const porMirar = pendientes.slice(1);
  const enOrden = lista.filter((c) => c.nivel === "bien" || c.nivel === "simulado");
  const simulados = lista.filter((c) => c.nivel === "simulado");
  const fila = (c: (typeof lista)[number]) => (
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
  );

  return (
    <>
      <PestanasInstalacion />
      <header className="gx-cabecera">
        <div>
          <h1>Comprobaciones</h1>
          <p className="gx-vivo">
            <span className={`gx-punto vivo${r.mal ? " error" : r.mirar ? " aviso" : ""}`} />
            Si Gradiox está leyendo y avisando como debe · comprobado a las {new Date(ahora).toLocaleTimeString("es-ES")}
          </p>
        </div>
      </header>

      <div className="gx-pila">
        <div className="gx-patron">
          <section className="gx-tarjeta realce gx-foco" aria-label="Lo primero">
            <span className="gx-chip">{titular}</span>
            <p className="titular">{foco ? foco.titulo : "Gradiox lee y avisa como debe"}</p>
            <p className="detalle">{foco ? foco.detalle : "Todas las comprobaciones están bien."}</p>
            {foco?.href && <Link href={foco.href} className="gx-boton">Ver cómo arreglarlo</Link>}
          </section>
          <div className="gx-cifras sueltas tres">
            <div className={r.mal ? "mal" : undefined}><span>Comprobaciones bien</span><strong>{r.bien} <small>de {r.cuentan}</small></strong></div>
            <div className={r.mirar ? "mirar" : undefined}><span>Por mirar</span><strong>{r.mirar}</strong></div>
            <div className={latido?.ms === null ? "mal" : undefined}><span>Servidor</span><strong>{latido === null ? "…" : latido.ms === null ? "No contesta" : <>{latido.ms} <small>ms</small></>}</strong></div>
          </div>
        </div>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Por mirar · {porMirar.length}</h2>
            {porMirar.length === 0 ? (
              <p className="gx-vacio">{foco ? "Nada más que mirar." : "Nada que mirar."}</p>
            ) : (
              <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>{porMirar.map(fila)}</ul>
            )}
          </section>

          <section className="gx-tarjeta gx-bien">
            <h2>Lo que va bien · {r.bien}</h2>
            <ul className="gx-lista" style={{ marginTop: 8 }}>
              {(Object.keys(GRUPOS) as Grupo[]).map((g) => {
                const todas = lista.filter((c) => c.grupo === g && c.nivel !== "simulado");
                const filas = enOrden.filter((c) => c.grupo === g);
                const bien = todas.filter((c) => c.nivel === "bien").length;
                const desplegado = abierto === g;
                return (
                  <li key={g} className="gx-grupo">
                    <span>
                      <strong style={{ fontWeight: 500 }}>{GRUPOS[g].titulo}</strong>
                      <small>{GRUPOS[g].detalle}</small>
                      {desplegado && <ul className="gx-lista gx-compro" style={{ marginTop: 6 }}>{filas.map(fila)}</ul>}
                    </span>
                    <span className="fin">
                      <span className={`gx-chip ${bien === todas.length ? "correcto" : "neutro"}`}>{bien} de {todas.length}</span>
                      {filas.length > 0 && <button type="button" className="gx-boton-enlace" aria-expanded={desplegado} aria-label={`${desplegado ? "Plegar" : "Desplegar"}: ${GRUPOS[g].titulo}`} onClick={() => setAbierto(desplegado ? null : g)}>{desplegado ? "Plegar" : "Desplegar"}</button>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {simulados.length > 0 && <p className="gx-plegado" style={{ padding: "12px 16px" }}>Simulado: {simulados.map((c) => c.titulo.toLowerCase()).join(", ")}. No hay ninguna instalación conectada y las guardias no avisan a nadie.</p>}
          </section>
        </div>

        <InstalarApp />

        <p className="gx-nota">Qué es de verdad aquí y qué no: el servidor, el reloj, el precio de la luz y todo lo de «Este dispositivo» se comprueban de verdad. La pasarela, los autómatas y las lecturas son de la simulación.</p>
      </div>
    </>
  );
}
