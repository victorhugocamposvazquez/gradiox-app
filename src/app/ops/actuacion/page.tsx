"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SinBase } from "@/components/sin-base";
import { conJson, pedir } from "@/clientes/navegador";
import type { ActuacionVista, CamaraVista, EstadoActua, Resumen } from "@/actua/servicio";
import { HORAS_MINIMAS } from "@/actua/actuacion";
import type { FichaCamara } from "@/actua/camaras";
import { PERIODOS, type Periodo, type Tarifa } from "@/actua/optimiza";
import type { ResumenPasarela } from "@/pasarelas/modelo";

const NOMBRE: Record<Periodo, string> = { punta: "Punta", llana: "Llana", valle: "Valle" };
const num = (n: number, d = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: d, minimumFractionDigits: 0 }).replace("-", "−");
const grados = (n: number | null | undefined) => (n === null || n === undefined ? "sin dato" : `${num(n)} °C`);
const euros = (n: number, d = 0) => `${num(n, d)} €`;
const pct = (x: number | null) => (x === null ? "sin dato" : `${Math.round(x * 100)} %`);
const cuantas = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;
const cuando = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Las 24 horas del día: la temperatura del aire como está ahora y como quedaría, sobre los tramos de la tarifa. */
function Curvas({ ahora, despues, tarifa, techo }: { ahora: Resumen; despues: Resumen; tarifa: Tarifa; techo?: number }) {
  const W = 480, H = 132, IZQ = 34, ABAJO = 18, ARRIBA = 8;
  const todos = [...ahora.aire, ...despues.aire, ...(techo === undefined ? [] : [techo])];
  const min = Math.floor(Math.min(...todos) - 0.5), max = Math.ceil(Math.max(...todos) + 0.5);
  const x = (h: number) => IZQ + (h / 24) * (W - IZQ);
  const y = (t: number) => ARRIBA + (1 - (t - min) / (max - min)) * (H - ARRIBA - ABAJO);
  const linea = (v: number[]) => v.map((t, i) => `${i ? "L" : "M"}${x(i + 0.5).toFixed(1)} ${y(t).toFixed(1)}`).join(" ");
  return (
    <svg className="gx-act-curvas" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperatura del aire a lo largo del día. Ahora, entre ${grados(ahora.aireMin)} y ${grados(ahora.aireMax)}. Con la propuesta, entre ${grados(despues.aireMin)} y ${grados(despues.aireMax)}.`}>
      {tarifa.horas.map((p, h) => <rect key={h} className={p} x={x(h)} y={ARRIBA} width={(W - IZQ) / 24} height={H - ARRIBA - ABAJO} />)}
      {[min, max].map((t) => <text key={t} x={IZQ - 6} y={y(t) + 4} textAnchor="end">{num(t, 0)}°</text>)}
      {[0, 6, 12, 18].map((h) => <text key={h} x={x(h) + 2} y={H - 4}>{h} h</text>)}
      {techo !== undefined && <path className="techo" d={`M${IZQ} ${y(techo)} H${W}`} />}
      <path className="antes" d={linea(ahora.aire)} />
      <path className="despues" d={linea(despues.aire)} />
    </svg>
  );
}

function FichaForm({ camara, guardar, ocupado }: { camara: CamaraVista; guardar: (f: FichaCamara) => void; ocupado: boolean }) {
  const [volumen, setVolumen] = useState(camara.ficha?.volumenM3 ? String(camara.ficha.volumenM3) : "");
  const [frio, setFrio] = useState(camara.ficha?.frioKw ? String(camara.ficha.frioKw) : "");
  const [potencia, setPotencia] = useState(camara.ficha?.potenciaKw ? String(camara.ficha.potenciaKw) : "");
  const [limite, setLimite] = useState(camara.ficha?.limite !== undefined ? String(camara.ficha.limite) : "");
  const n = (s: string) => Number(s.replace(",", "."));
  const lista = n(volumen) >= 5 && (n(frio) >= 0.2 || n(potencia) >= 0.2);
  return (
    <form className="gx-formulario gx-act-ficha" onSubmit={(ev) => { ev.preventDefault(); if (lista) guardar({ volumenM3: n(volumen), frioKw: n(frio) || 0, ...(n(potencia) > 0 ? { potenciaKw: n(potencia) } : {}), ...(limite.trim() ? { limite: n(limite) } : {}) }); }}>
      <label className="gx-campo">Volumen (m³)<input inputMode="decimal" value={volumen} onChange={(ev) => setVolumen(ev.target.value)} placeholder="p. ej. 3000" /></label>
      <label className="gx-campo">Frío que le llega (kW)<input inputMode="decimal" value={frio} onChange={(ev) => setFrio(ev.target.value)} placeholder="p. ej. 60" /></label>
      <label className="gx-campo">Compresor propio (kW eléctricos)<input inputMode="decimal" value={potencia} onChange={(ev) => setPotencia(ev.target.value)} placeholder="Solo si no cuelga de la central" /></label>
      <label className="gx-campo">Lo más caliente que puede estar (°C)<input inputMode="decimal" value={limite} onChange={(ev) => setLimite(ev.target.value)} placeholder="Si se deja vacío, el de su género" /></label>
      <div className="ancho"><button className="gx-boton secundario" disabled={!lista || ocupado}>Guardar la ficha</button></div>
    </form>
  );
}

function TarjetaCamara({ c, estado, hacer, ocupado }: { c: CamaraVista; estado: EstadoActua; hacer: (cuerpo: Record<string, unknown>) => void; ocupado: boolean }) {
  const [confirma, setConfirma] = useState(false);
  const [editar, setEditar] = useState(false);
  const p = c.propuesta;
  const puedeAplicar = p && !c.activa && estado.ordenesActivas && estado.programaPermite && c.faltanEscribibles.length === 0;
  return (
    <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
      <div className="gx-fila">
        <div>
          <h2>{c.nombre}</h2>
          <p className="gx-sub">Ahora a {grados(c.temperatura)}{c.techo !== undefined && <> · Gradiox no la deja pasar de {grados(c.techo)}</>}</p>
        </div>
        {c.activa ? <span className="gx-chip correcto">Actuación en marcha</span> : p ? <span className="gx-chip azul">Ahorraría {euros(p.eurosAno)} al año</span> : <span className="gx-chip neutro">{c.falta ? "Faltan datos" : "Sin propuesta"}</span>}
      </div>

      {c.falta && <p className="gx-nota">{c.falta}</p>}
      {c.avisos.map((a) => <p key={a} className="gx-chip aviso gx-act-aviso">{a}</p>)}
      {!c.falta && !p && <p className="gx-act-cambios">{PERIODOS.map((per) => <span key={per}><i className={`gx-act-tramo ${per}`} />{NOMBRE[per]}: {grados(c.consignas[per])}</span>)}</p>}
      {!c.falta && !p && c.motivo && <p className="gx-nota">{c.motivo}</p>}

      {p && (
        <>
          <div className="gx-act-dos">
            <table className="gx-tabla">
              <thead><tr><th>Tramo</th><th>Consigna ahora</th><th>Propuesta</th><th>En marcha</th></tr></thead>
              <tbody>
                {PERIODOS.map((per) => {
                  const de = c.consignas[per], a = p.consignas[per];
                  return (
                    <tr key={per}>
                      <td><i className={`gx-act-tramo ${per}`} />{NOMBRE[per]}</td>
                      <td>{grados(de)}</td>
                      <td className={de !== a ? "cambia" : undefined}>{grados(a)}</td>
                      <td>{pct(p.ahora.marcha[per])} <ArrowRight size={13} aria-label="pasa a" /> {pct(p.despues.marcha[per])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div>
              <Curvas ahora={p.ahora} despues={p.despues} tarifa={estado.tarifa} techo={c.techo} />
              <p className="gx-act-leyenda"><span className="antes">Como está</span><span className="despues">Con la propuesta</span><span className="techo">Límite</span></p>
            </div>
          </div>
          <dl className="gx-datos-cifras">
            <div><dt>Ahorro previsto</dt><dd>{euros(p.eurosDia, 2)} al día</dd><small>{euros(p.eurosAno)} al año, en días laborables</small></div>
            <div><dt>Sobre lo que gasta hoy</dt><dd>{pct(p.parte)}</dd><small>De {euros(p.ahora.eurosDia, 2)} a {euros(p.despues.eurosDia, 2)} al día</small></div>
            <div><dt>Energía</dt><dd>{p.kwhDia >= 0 ? "−" : "+"}{num(Math.abs(p.kwhDia))} kWh al día</dd><small>{p.kwhDia >= 0 ? "Gasta menos y en horas más baratas" : "Gasta algo más, pero en horas baratas"}</small></div>
          </dl>
          {!c.activa && c.faltanEscribibles.length > 0 && (
            <div className="gx-act-paso">
              <p className="gx-nota">Para aplicarla, Gradiox tiene que tener permiso para cambiar estas tres consignas, cada una entre sus límites ({grados(c.suelo)} y {grados(c.techo)}). El programa de la planta no escribe nada que se salga de ahí.</p>
              <button className="gx-boton secundario" disabled={ocupado} onClick={() => hacer({ accion: "permitir", camara: c.clave })}><ShieldCheck size={16} strokeWidth={1.7} aria-hidden="true" /> Permitir estas tres consignas</button>
            </div>
          )}
          {!c.activa && c.faltanEscribibles.length === 0 && !estado.ordenesActivas && <p className="gx-nota">Las órdenes están apagadas en esta instalación. Se encienden en <Link className="gx-boton-enlace" href="/ops/pasarelas">Pasarelas</Link>, en «Órdenes al PLC».</p>}
          {!c.activa && c.faltanEscribibles.length === 0 && estado.ordenesActivas && !estado.programaPermite && <p className="gx-nota">Falta la segunda llave: en el programa de la planta, en «Conexión», hay que marcar «Permitir órdenes de Gradiox».</p>}
          {puedeAplicar && !confirma && <div><button className="gx-boton" disabled={ocupado} onClick={() => setConfirma(true)}>Aplicar la propuesta</button></div>}
          {puedeAplicar && confirma && (
            <div className="gx-act-paso confirma" role="alertdialog" aria-label="Confirmar la actuación">
              <p><strong>Se van a cambiar las consignas de {c.nombre} en {estado.simulado ? "el PLC simulado" : "el PLC de la planta"}.</strong> Se puede deshacer con un botón, y si la temperatura se queda en {grados(c.techo)} Gradiox las devuelve solo.</p>
              <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
                <button className="gx-boton" disabled={ocupado} onClick={() => { setConfirma(false); hacer({ accion: "aplicar", camara: c.clave }); }}>Sí, aplicar</button>
                <button className="gx-boton secundario" onClick={() => setConfirma(false)}>Ahora no</button>
              </div>
            </div>
          )}
        </>
      )}

      {(c.falta && !c.ficha) || editar ? (
        <FichaForm camara={c} ocupado={ocupado} guardar={(ficha) => { setEditar(false); hacer({ accion: "ficha", camara: c.clave, ficha }); }} />
      ) : (
        c.ficha && <p className="gx-nota">Ficha: {num(c.ficha.volumenM3, 0)} m³, {c.ficha.potenciaKw ? `compresor propio de ${num(c.ficha.potenciaKw)} kW` : `${num(c.ficha.frioKw)} kW de frío`}{c.ficha.limite !== undefined && `, límite ${grados(c.ficha.limite)}`}. <button className="gx-boton-enlace" onClick={() => setEditar(true)}>Cambiar</button></p>
      )}
    </section>
  );
}

function FilaActuacion({ a, hacer, ocupado }: { a: ActuacionVista; hacer: (cuerpo: Record<string, unknown>) => void; ocupado: boolean }) {
  const chip = a.estado === "revertida" ? ["aviso", "Devuelta sola"] : a.estado === "deshecha" ? ["neutro", "Deshecha"] : a.situacion === "en-marcha" ? ["correcto", "En marcha"] : a.situacion === "esperando" ? ["azul", "Esperando al programa"] : ["error", "No se ha aplicado"];
  const m = a.medido;
  return (
    <li>
      <div className="gx-fila">
        <div>
          <strong>{a.nombre}</strong>
          <p className="gx-sub">{cuando(a.aplicada)}{a.cerrada ? ` · hasta ${cuando(a.cerrada)}` : ""}</p>
        </div>
        <span className={`gx-chip ${chip[0]}`}>{chip[1]}</span>
      </div>
      <p className="gx-act-cambios">{PERIODOS.filter((p) => a.antes[p] !== a.despues[p]).map((p) => <span key={p}>{NOMBRE[p]}: {grados(a.antes[p])} <ArrowRight size={13} aria-label="pasa a" /> {grados(a.despues[p])}</span>)}</p>
      {a.motivo && <p className="gx-nota">{a.motivo}</p>}
      {a.situacion === "no-aplicada" && <p className="gx-nota">Las consignas del PLC no son las que se pidieron. Mira qué pasó con las órdenes en Pasarelas; mientras tanto conviene deshacerla.</p>}
      <dl className="gx-datos-cifras">
        <div><dt>Previsto</dt><dd>{euros(a.previsto.eurosDia, 2)} al día</dd><small>{euros(a.previsto.eurosAno)} al año</small></div>
        <div>
          <dt>Medido</dt>
          <dd>{m?.eurosDia != null ? `${euros(m.eurosDia, 2)} al día` : "Todavía no"}</dd>
          <small>{!a.vars.enfriando ? "Esta cámara no tiene la variable «está enfriando»" : m?.eurosDia != null ? "Con sus horas de marcha de verdad" : `Hacen falta ${HORAS_MINIMAS} h laborables antes y después; hay ${num(m?.horasAntes ?? 0, 0)} y ${num(m?.horasDespues ?? 0, 0)}`}</small>
        </div>
        <div><dt>En marcha en punta</dt><dd>{pct(m?.marchaAntes.punta ?? null)} <ArrowRight size={14} aria-label="pasa a" /> {pct(m?.marchaDespues.punta ?? null)}</dd><small>Previsto: {pct(a.previsto.marchaAntes.punta)} a {pct(a.previsto.marchaDespues.punta)}</small></div>
      </dl>
      {a.estado === "aplicada" && <div><button className="gx-boton secundario" disabled={ocupado} onClick={() => hacer({ accion: "deshacer", actuacion: a.id })}><RotateCcw size={16} strokeWidth={1.7} aria-hidden="true" /> Deshacer y volver a como estaba</button></div>}
    </li>
  );
}

function EditorTarifa({ tarifa, guardar, ocupado }: { tarifa: Tarifa; guardar: (t: Tarifa) => void; ocupado: boolean }) {
  const [horas, setHoras] = useState(tarifa.horas);
  const [precio, setPrecio] = useState<Record<Periodo, string>>({ punta: String(tarifa.precio.punta), llana: String(tarifa.precio.llana), valle: String(tarifa.precio.valle) });
  const siguiente = (p: Periodo): Periodo => PERIODOS[(PERIODOS.indexOf(p) + 1) % PERIODOS.length];
  const n = (s: string) => Number(s.replace(",", "."));
  const vale = PERIODOS.every((p) => n(precio[p]) > 0 && n(precio[p]) < 2 && horas.includes(p));
  return (
    <div className="gx-pila" style={{ gap: 10 }}>
      <p className="gx-nota">Toca una hora para cambiarla de tramo. Son las horas de un día laborable; los fines de semana no se cuentan en el ahorro.</p>
      <div className="gx-act-horas">
        {horas.map((p, h) => <button key={h} type="button" className={p} aria-label={`${h} h, ${NOMBRE[p]}`} onClick={() => setHoras(horas.map((x, i) => (i === h ? siguiente(x) : x)))}>{h}</button>)}
      </div>
      <div className="gx-formulario gx-act-precios">
        {PERIODOS.map((p) => <label key={p} className="gx-campo"><span><i className={`gx-act-tramo ${p}`} />{NOMBRE[p]} (€/kWh)</span><input inputMode="decimal" value={precio[p]} onChange={(ev) => setPrecio({ ...precio, [p]: ev.target.value })} /></label>)}
      </div>
      <div><button className="gx-boton secundario" disabled={!vale || ocupado} onClick={() => guardar({ horas, precio: { punta: n(precio.punta), llana: n(precio.llana), valle: n(precio.valle) }, dePartida: false })}>Guardar la tarifa</button></div>
    </div>
  );
}

/** Actuación: lo que Gradiox propone cambiar en cada cámara para gastar menos, lo que ha cambiado ya y lo que se ha ahorrado de verdad. */
export default function Actuacion() {
  const [lista, setLista] = useState<{ guardado: string; pasarelas: ResumenPasarela[] } | null>(null);
  const [id, setId] = useState("");
  const [estado, setEstado] = useState<EstadoActua | null>(null);
  const [fallo, setFallo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    pedir<{ guardado: string; pasarelas: ResumenPasarela[] }>("/api/ops/pasarelas")
      .then((l) => {
        setLista(l);
        const pedida = new URLSearchParams(window.location.search).get("id");
        setId(l.pasarelas.find((p) => p.id === pedida)?.id ?? l.pasarelas[0]?.id ?? "");
      })
      .catch((e: Error) => setFallo(e.message));
  }, []);

  const cargar = useCallback(() => {
    if (!id) return;
    pedir<EstadoActua>(`/api/ops/actuacion/${id}`).then(setEstado).catch((e: Error) => setFallo(e.message));
  }, [id]);
  useEffect(() => {
    setEstado(null);
    cargar();
    const reloj = window.setInterval(cargar, 30_000);
    return () => window.clearInterval(reloj);
  }, [cargar]);

  const hacer = (cuerpo: Record<string, unknown>) => {
    setOcupado(true);
    setFallo("");
    pedir<EstadoActua>(`/api/ops/actuacion/${id}`, conJson("POST", cuerpo))
      .then(setEstado)
      .catch((e: Error) => setFallo(e.message))
      .finally(() => setOcupado(false));
  };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Actuación</h1>
          <p className="gx-sub">Lo que Gradiox cambia en la instalación para gastar menos, cuánto espera ahorrar y cuánto se ha ahorrado de verdad.</p>
        </div>
        {lista && lista.pasarelas.length > 1 && (
          <label className="gx-campo gx-filtro">
            Instalación
            <select value={id} onChange={(ev) => setId(ev.target.value)}>{lista.pasarelas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          </label>
        )}
      </header>

      <div className="gx-pila">
        {lista?.guardado === "memoria" && <SinBase />}
        {fallo && <p className="gx-chip error gx-act-aviso" role="alert">{fallo}</p>}

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Primera actuación: enfriar cuando la luz es barata</h2>
            <p className="gx-sub">El autómata ya tiene una consigna distinta para las horas punta, llanas y valle de cada cámara. Casi siempre están las tres iguales. Gradiox calcula las tres que menos cuestan sin que el género se caliente.</p>
          </div>
          <ol className="gx-datos-pasos gx-act-pasos">
            <li><strong>Calcula</strong><p>Con el volumen, el frío que le llega y la tarifa, prueba todas las combinaciones de consignas en pasos de medio grado y se queda con la más barata que cumple los límites. Son cuentas de calor, no una caja negra.</p></li>
            <li><strong>Propone y tú decides</strong><p>Enseña el antes y el después, y el ahorro en euros. No cambia nada hasta que alguien pulsa «Aplicar». La orden viaja con la doble llave: encendida aquí y permitida en la planta.</p></li>
            <li><strong>Vigila</strong><p>Cada cámara tiene un límite que sale del género, de sus alarmas y de lo que anote el técnico. Si la temperatura se queda un cuarto de hora en el límite, o lo pasa de largo, Gradiox devuelve las consignas solo. También se deshace con un botón.</p></li>
            <li><strong>Mide</strong><p>Compara las horas que el frío estuvo en marcha antes y después, tramo a tramo, y dice el ahorro de verdad. Si no coincide con lo previsto, se ve.</p></li>
          </ol>
        </section>

        {lista && lista.pasarelas.length === 0 && (
          <section className="gx-tarjeta"><h2>Todavía no hay ninguna instalación</h2><p className="gx-vacio">El primer paso es crear una en <Link className="gx-boton-enlace" href="/ops/pasarelas">Pasarelas</Link> y encender su programa. Con las lecturas de sus cámaras, aquí salen las propuestas.</p></section>
        )}
        {id && !estado && !fallo && <p className="gx-vacio">Haciendo las cuentas…</p>}

        {estado && (
          <>
            <dl className="gx-datos-cifras gx-act-totales">
              <div><dt>Ahorro previsto en marcha</dt><dd>{euros(estado.totales.enMarchaAno)} al año</dd><small>{cuantas(estado.actuaciones.filter((a) => a.estado === "aplicada").length, "actuación aplicada", "actuaciones aplicadas")}</small></div>
              <div><dt>Propuesto sin aplicar</dt><dd>{euros(estado.totales.propuestoAno)} al año</dd><small>{cuantas(estado.camaras.filter((c) => c.propuesta && !c.activa).length, "cámara con propuesta", "cámaras con propuesta")}</small></div>
              <div><dt>Órdenes al PLC</dt><dd>{estado.ordenesActivas && estado.programaPermite ? "Las dos llaves puestas" : estado.ordenesActivas ? "Falta permitirlas en la planta" : "Apagadas"}</dd><small>{estado.simulado ? "PLC simulado: no se toca ninguna planta" : "PLC de la planta"}</small></div>
            </dl>

            {estado.camaras.length === 0 && (
              <section className="gx-tarjeta"><h2>Esta instalación no tiene cámaras con consignas por tarifa</h2><p className="gx-vacio">Hacen falta, de cada cámara, su temperatura (TT9) y las tres consignas (Hora_punta_ac, Hora_llana_ac y Hora_valle_ac) en la lista de variables que lee la pasarela.</p></section>
            )}
            {estado.camaras.map((c) => <TarjetaCamara key={`${c.clave}-${c.activa ?? ""}`} c={c} estado={estado} hacer={hacer} ocupado={ocupado} />)}

            {estado.actuaciones.length > 0 && (
              <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
                <div><h2>Lo que se ha hecho</h2><p className="gx-sub">Cada actuación, con lo que esperaba ahorrar y lo que se ha visto después.</p></div>
                <ul className="gx-act-hechas">{estado.actuaciones.map((a) => <FilaActuacion key={a.id} a={a} hacer={hacer} ocupado={ocupado} />)}</ul>
              </section>
            )}

            <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
              <div className="gx-fila">
                <div><h2>Tarifa eléctrica</h2><p className="gx-sub">Qué horas son punta, llana y valle, y cuánto cuesta el kWh en cada una.</p></div>
                {estado.tarifa.dePartida && <span className="gx-chip aviso">De partida: falta la factura</span>}
              </div>
              {estado.tarifa.dePartida && <p className="gx-nota">Estos precios y horas son un punto de partida razonable, no los de este cliente. Los euros de esta pantalla valen lo que valga la tarifa: hay que ponerla con una factura delante.</p>}
              <EditorTarifa key={JSON.stringify(estado.tarifa)} tarifa={estado.tarifa} ocupado={ocupado} guardar={(tarifa) => hacer({ accion: "tarifa", tarifa })} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
