"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ChipEstado, Grafica, Medidor, Temp } from "@/components/piezas";
import { PERIODOS, consumoHoy, historia, marchaCompresor, minutosAlLimite, type Periodo } from "@/lib/analisis";
import { ORDENES, fallosAhora } from "@/lib/fallos";
import { duracion, euros, gradosC, hora } from "@/lib/formato";
import { CAMARAS, eventos, leer, rotulo } from "@/lib/datos";
import { EQUIPOS } from "@/lib/equipos";
import { useDemo } from "@/lib/store";

export default function FichaCamara() {
  const { id } = useParams<{ id: string }>();
  const { ahora, ajustes, fallos, ordenes, quitarAveria, cambiarConsigna, ordenar, notas, anotarServicio, borrarNota, recepciones } = useDemo();
  const camara = CAMARAS.find((c) => c.id === id);
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);

  const [periodo, setPeriodo] = useState<Periodo>("24h");
  // Los periodos largos no hace falta rehacerlos cada minuto.
  const tramo = minuto === null ? null : Math.floor(minuto / PERIODOS[periodo].pasoMin) * PERIODOS[periodo].pasoMin;
  const historico = useMemo(
    () => (camara && tramo !== null ? historia(camara, tramo * 60_000, ajustes, periodo) : null),
    [camara, tramo, ajustes, periodo],
  );
  const sucesos = useMemo(
    () => (camara && minuto !== null ? eventos(minuto * 60_000, ajustes).filter((e) => e.camaraId === camara.id).slice(0, 8) : []),
    [camara, minuto, ajustes],
  );

  const marcha = useMemo(
    () => (camara && minuto !== null ? marchaCompresor(camara, minuto * 60_000, ajustes) : null),
    [camara, minuto, ajustes],
  );
  const consumo = useMemo(
    () => (camara && minuto !== null ? consumoHoy(camara, minuto * 60_000, ajustes) : null),
    [camara, minuto, ajustes],
  );

  if (!camara) return <p className="gx-sub">Ese servicio no existe. <Link href="/servicios" className="gx-volver">Volver a los servicios</Link></p>;
  if (ahora === null) return <p className="gx-sub">Leyendo el servicio…</p>;

  const l = leer(camara, ahora, ajustes);
  const averia = ajustes.averias[camara.id];
  const base = ajustes.consignas[camara.id] ?? camara.consigna;
  const tope = camara.limite - 3;
  const queda = minutosAlLimite(camara, ahora, ajustes);
  const conocidos = fallosAhora(fallos, camara, l);
  const cortos = PERIODOS[periodo].horas <= 24;

  return (
    <>
      <Link href="/servicios" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Servicios
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>{camara.nombre}</h1>
          <p className="gx-sub">{rotulo(camara)} · el género no debe pasar de {gradosC(camara.limite)}</p>
        </div>
        <ChipEstado estado={l.estado} texto={l.motivo} />
      </header>

      {l.estado === "sindatos" && (
        <Link href="/conexiones" className="gx-alerta mudo" role="alert">
          <strong>No llegan datos de este servicio</strong>
          <span>Lo que se ve es la última lectura, de las {hora(l.ultima)}. No se sabe cómo está ahora. Tocar para ver las conexiones.</span>
        </Link>
      )}
      {l.estado === "error" && (
        <div className="gx-alerta" role="alert">
          <strong>{l.temp >= camara.limite ? `Ha pasado el límite de ${gradosC(camara.limite)}` : queda ? `Llega al límite en ${duracion(queda * 60_000)}` : l.motivo}</strong>
          <span>{l.temp >= camara.limite ? "Hay que revisar el género de este servicio." : queda ? `A este ritmo toca los ${gradosC(camara.limite)} a las ${hora(ahora + queda * 60_000)}. Da tiempo a mover el género o a que llegue el técnico.` : "Conviene mirarla ya."}</span>
        </div>
      )}

      {conocidos.length > 0 && (
        <section className="gx-tarjeta gx-conocido">
          <h2>Qué hacer ahora</h2>
          <ul className="gx-lista">
            {conocidos.map((f) => (
              <li key={f.id}>
                <span>
                  <strong style={{ fontWeight: 500 }}>{f.nombre}</strong>
                  <small><b>Revisar:</b> {f.revisar}</small>
                  {f.orden !== "ninguna" && <small><b>Autómata:</b> {ORDENES[f.orden]}{f.auto ? ". Lo hace solo." : ""}</small>}
                </span>
                {f.orden !== "ninguna" && (
                  <button type="button" className="gx-boton secundario" onClick={() => ordenar(f.id, camara.id)}>Enviar la orden</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="gx-dos">
        <div className="gx-pila">
          <section className="gx-tarjeta gx-pila">
            <div className="gx-fila">
              <Temp valor={l.temp} className={`gx-temp grande${l.estado === "error" ? " error" : ""}`} />
              <p className="gx-sub">consigna ahora {gradosC(l.consigna)}</p>
            </div>
            <Medidor temp={l.temp} consigna={l.consigna} limite={camara.limite} estado={l.estado} />
            <div className="gx-datos">
              <div className="gx-dato"><span>{camara.sinCompresor ? "Frío" : "Compresor"}</span><strong>{camara.sinCompresor ? "De la central" : l.compresor ? "En marcha" : "Parado"}</strong></div>
              {!camara.sinPuerta && <div className="gx-dato"><span>Puerta</span><strong>{l.puerta ? `Abierta ${l.puertaMin} min` : "Cerrada"}</strong></div>}
              <div className="gx-dato"><span>Desescarche</span><strong>{camara.desescarche ? (l.desescarche ? "En curso" : `${camara.desescarche} min`) : "No lleva"}</strong></div>
              {marcha && !camara.sinCompresor && <div className="gx-dato"><span>En marcha, 24 h</span><strong>{marcha.porcentaje} % del tiempo</strong></div>}
              {marcha && !camara.sinCompresor && <div className="gx-dato"><span>Arranques</span><strong>{marcha.arranquesHora.toString().replace(".", ",")} por hora</strong></div>}
              {consumo && !camara.sinCompresor && <div className="gx-dato"><span>Consumo de hoy</span><strong>{consumo.kwh} kWh · {euros(consumo.euros)}</strong></div>}
            </div>
            <p className="gx-nota">{camara.sinCompresor ? "Este servicio no tiene compresor propio: el frío le llega de la central, así que aquí no hay marcha ni consumo que contar." : `El consumo sale de la potencia del compresor (${camara.potenciaKw} kW) y de su tiempo de marcha, no de un contador.`}</p>
          </section>

          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <div className="gx-fila">
              <h2>{PERIODOS[periodo].titulo}</h2>
              <Link href={`/registro?camara=${camara.id}`} className="gx-volver"><ClipboardList size={18} aria-hidden="true" /> Registro por días</Link>
            </div>
            <div className="gx-periodos" role="group" aria-label="Periodo de la gráfica">
              {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
                <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>{PERIODOS[p].texto}</button>
              ))}
            </div>
            {historico && <Grafica historia={historico} limite={camara.limite} titulo={PERIODOS[periodo].titulo} />}
            <div className="gx-leyenda">
              <span><i style={{ background: "var(--gx-azul)" }} />Temperatura</span>
              <span><i style={{ background: "var(--gx-gris)" }} />Consigna</span>
              <span><i style={{ background: "var(--gx-error)" }} />Límite y alarmas</span>
              {cortos && camara.desescarche > 0 && <span><i className="raya" style={{ background: "var(--gx-azul)" }} />Desescarche</span>}
              {cortos && !camara.sinPuerta && <span><i className="raya" style={{ background: "var(--gx-aviso)" }} />Puerta abierta</span>}
            </div>
            <p className="gx-nota">{cortos ? "Las rayas de abajo dicen cuándo hubo desescarche, puerta abierta o alarma." : "Cada punto resume un rato: la línea es la media y la sombra, la mínima y la máxima. Abajo, en rojo, las alarmas."}{historico?.marcas.some((m) => m.tipo === "sindatos") ? " La franja gris es un rato sin datos." : ""}</p>
          </section>

          <section className="gx-tarjeta">
            <h2>Avisos de este servicio</h2>
            {sucesos.length === 0 ? (
              <p className="gx-vacio">Sin avisos en las últimas 24 horas.</p>
            ) : (
              <ul className="gx-lista">
                {sucesos.map((e) => (
                  <li key={e.desde}>
                    <span>
                      {e.motivo}
                      <small>A las {hora(e.desde)} · duró {duracion(e.hasta - e.desde)}</small>
                    </span>
                    <ChipEstado estado={e.estado} texto={e.estado === "error" ? "Alarma" : e.estado === "sindatos" ? "Sin datos" : "Aviso"} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="gx-pila">
          {ordenes.some((o) => o.camaraId === camara.id) && (
            <section className="gx-tarjeta">
              <h2>Órdenes al autómata</h2>
              <ul className="gx-lista">
                {ordenes.filter((o) => o.camaraId === camara.id).slice(0, 4).map((o) => (
                  <li key={o.id}>
                    <span>
                      {ORDENES[o.orden]}
                      <small>A las {hora(o.cuando)} · {o.auto ? "sola" : "a mano"} · por «{o.fallo}»</small>
                      <small>{o.resultado}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="gx-nota">Órdenes simuladas: no hay ningún autómata que las reciba.</p>
            </section>
          )}
          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <h2>Consigna</h2>
            <div className="gx-fila">
              <button type="button" className="gx-boton secundario" aria-label="Bajar un grado" onClick={() => cambiarConsigna(camara.id, base - 1)}>
                <Minus size={18} aria-hidden="true" />
              </button>
              <strong style={{ fontFamily: "var(--gx-letra-marca)", fontSize: 24, fontWeight: 500 }}>{gradosC(base)}</strong>
              <button type="button" className="gx-boton secundario" aria-label="Subir un grado" disabled={base + 1 > tope} onClick={() => cambiarConsigna(camara.id, base + 1)}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="gx-nota">No deja subir de {gradosC(tope)}, tres grados por debajo del límite del género.</p>
            {base !== camara.consigna && (
              <button type="button" className="gx-boton secundario" onClick={() => cambiarConsigna(camara.id, camara.consigna)}>
                Volver a {gradosC(camara.consigna)}
              </button>
            )}
          </section>

          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <h2>Notas</h2>
            <form
              className="gx-cierre"
              onSubmit={(ev) => {
                ev.preventDefault();
                const campo = ev.currentTarget.elements.namedItem("nota") as HTMLInputElement;
                if (campo.value.trim()) anotarServicio(camara.id, campo.value.trim());
                campo.value = "";
              }}
            >
              <label className="gx-campo gx-enlinea">
                <input type="text" name="nota" aria-label="Nota nueva" maxLength={160} placeholder="La puerta roza, el miércoles entra pescado…" />
              </label>
              <button type="submit" className="gx-boton secundario">Apuntar</button>
            </form>
            {(notas[camara.id] ?? []).length === 0 ? (
              <p className="gx-nota">Para lo que conviene saber y no es una avería.</p>
            ) : (
              <ul className="gx-lista gx-notas">
                {(notas[camara.id] ?? []).map((n) => (
                  <li key={n.id}>
                    <span>{n.texto}<small>{new Date(n.cuando).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, {hora(n.cuando)}</small></span>
                    <button type="button" className="gx-quitar" aria-label={`Borrar la nota: ${n.texto}`} onClick={() => borrarNota(camara.id, n.id)}><X size={18} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="gx-tarjeta">
            <div className="gx-fila">
              <h2>Entradas de mercancía</h2>
              <Link href={`/recepcion?servicio=${camara.id}`} className="gx-volver">Apuntar una</Link>
            </div>
            {recepciones.filter((r) => r.camaraId === camara.id).length === 0 ? (
              <p className="gx-nota">Ninguna apuntada en este servicio.</p>
            ) : (
              <ul className="gx-lista">
                {recepciones.filter((r) => r.camaraId === camara.id).slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <span>{r.producto} · {gradosC(r.temp)}<small>{new Date(r.cuando).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, {hora(r.cuando)}{r.temp > camara.limite ? " · por encima del límite" : ""}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="gx-tarjeta">
            <h2>Equipos</h2>
            <ul className="gx-lista">
              {EQUIPOS.filter((q) => q.camaraId === camara.id).map((q) => (
                <li key={q.id}><Link href={`/mantenimiento/${q.id}`} style={{ color: "var(--gx-azul)", fontWeight: 500 }}>{q.nombre}</Link></li>
              ))}
            </ul>
          </section>

          {averia && (
            <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
              <h2>Avería de demostración</h2>
              <p className="gx-nota">Este servicio tiene una avería provocada desde <Link href="/demostracion" className="gx-enlace">Demostración</Link>. No es real.</p>
              <button type="button" className="gx-boton" onClick={() => quitarAveria(camara.id)}>Arreglar la avería</button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
