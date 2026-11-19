"use client";

import { Check, Play, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FASES, MARGEN_LIMITE_C, MINUTOS, MINUTOS_TOTAL, avance, avanzar, comprobaciones, empezar, parar, pasoPlanta, planDePrueba, plantaNueva, type EstadoPrueba, type Fase, type Lectura, type Planta } from "@/huella/prueba";
import { ritmoReal } from "@/huella/demo";
import { azar, leer, type Camara } from "@/lib/sim";

const grados = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
const hora = (t: number) => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/** Lo que queda guardado de una prueba terminada. */
export type PruebaHecha = { t: number; quien: string; subidaCh: number; bajadaCh: number; minutos: number; ordenes: { t: number; consigna: number; texto: string }[] };

/** La temperatura durante la prueba, con la consigna, el tope de la prueba y el límite del género. */
function GraficaPrueba({ e }: { e: EstadoPrueba }) {
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setW(Math.max(260, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { plan } = e;
  const H = W < 480 ? 190 : 220;
  const M = { izq: 44, der: 8, arr: 12, aba: 22 };
  const min = plan.consigna - 1.4, max = plan.limite + 0.6;
  const x = (t: number) => M.izq + Math.min(1, (t - e.inicio) / (MINUTOS_TOTAL * 60_000)) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + ((max - v) / (max - min)) * (H - M.arr - M.aba);
  const linea = e.lecturas.map((l, i) => `${i ? "L" : "M"}${x(l.t).toFixed(1)},${y(l.temp).toFixed(1)}`).join("");
  const rayas: { v: number; texto: string; clase: string }[] = [
    { v: plan.limite, texto: "Límite del género", clase: "limite" },
    { v: plan.tope, texto: "Hasta aquí sube", clase: "tope" },
    { v: plan.consigna, texto: "Consigna", clase: "consigna" },
  ];
  // Dónde empieza cada fase, para pintar su franja.
  const cambios: { fase: Fase; t: number }[] = [];
  for (const l of e.lecturas) if (!cambios.length || cambios[cambios.length - 1].fase !== l.fase) cambios.push({ fase: l.fase, t: l.t });
  const ultima = e.lecturas[e.lecturas.length - 1];

  return (
    <div ref={caja} className="gx-arr-grafica">
      <svg className="gx-grafica" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperatura durante la prueba${ultima ? `: ahora ${grados(ultima.temp)}` : ""}`}>
        {cambios.map((c, i) => {
          const fin = cambios[i + 1]?.t ?? ultima.t;
          return <rect key={c.t} className={`franja ${c.fase}`} x={x(c.t)} y={M.arr} width={Math.max(0, x(fin) - x(c.t))} height={H - M.arr - M.aba} />;
        })}
        {rayas.map((r) => (
          <g key={r.clase}>
            <line className={`raya ${r.clase}`} x1={M.izq} x2={W - M.der} y1={y(r.v)} y2={y(r.v)} />
            <text x={M.izq - 6} y={y(r.v) + 4} textAnchor="end" fontSize="12" fill="var(--gx-gris)">{String(Math.round(r.v * 10) / 10).replace(".", ",")}</text>
            <text x={W - M.der - 4} y={y(r.v) - 5} textAnchor="end" fontSize="12" fill="var(--gx-gris)">{r.texto}</text>
          </g>
        ))}
        {linea && <path className="temp" d={linea} />}
        {ultima && <circle className="punto" cx={x(ultima.t)} cy={y(ultima.temp)} r="4" />}
        {[0, 20, 40, 60].map((m) => (
          <text key={m} x={x(e.inicio + m * 60_000)} y={H - 5} textAnchor={m === 0 ? "start" : m === 60 ? "end" : "middle"} fontSize="12" fill="var(--gx-gris)">{m === 0 ? "Inicio" : `${m} min`}</text>
        ))}
      </svg>
    </div>
  );
}

/**
 * La prueba de arranque de un servicio: el plan con sus límites, las
 * comprobaciones, el permiso del técnico y la prueba en marcha. En esta versión
 * la cámara que responde es simulada: no se manda ninguna orden a ningún equipo.
 */
export function PruebaArranque({ camara, exteriorC, ahora, hecha, alTerminar }: { camara: Camara; exteriorC: number; ahora: number; hecha?: PruebaHecha; alTerminar: (p: PruebaHecha) => void }) {
  const plan = useMemo(() => planDePrueba(camara.consigna, camara.limite), [camara]);
  const [quien, setQuien] = useState("");
  const [permiso, setPermiso] = useState(false);
  const [rapida, setRapida] = useState(true);
  const [estado, ponerEstado] = useState<EstadoPrueba | null>(null);
  // El estado también va en una referencia: el reloj lo lee y lo cambia sin depender del pintado.
  const vivo = useRef<EstadoPrueba | null>(null);
  const setEstado = (e: EstadoPrueba | null) => {
    vivo.current = e;
    ponerEstado(e);
  };
  const planta = useRef<Planta | null>(null);
  const reloj = useRef(0);
  const guardada = useRef(false);

  // Al cambiar de servicio se suelta la prueba que hubiera.
  useEffect(() => {
    setEstado(null);
    setPermiso(false);
    planta.current = null;
  }, [camara.id]);

  const actual = leer(camara, ahora);
  const lectura: Lectura = { t: ahora, temp: actual.temp, puerta: actual.puerta, desescarche: actual.desescarche, alarma: actual.estado === "error" };
  const previas = comprobaciones(plan, actual.estado === "sindatos" ? null : lectura, ahora);
  const listo = previas.every((c) => c.bien) && quien.trim().length >= 2 && permiso;
  const enMarcha = estado !== null && !estado.fin;

  useEffect(() => {
    if (!enMarcha) return;
    // Cada medio segundo la cámara simulada avanza: 30 segundos si va acelerada, medio si va a su ritmo.
    const paso = rapida ? 30 : 0.5;
    const id = window.setInterval(() => {
      const e = vivo.current;
      if (!e || e.fin || !planta.current) return;
      planta.current = pasoPlanta(planta.current, e.consignaPedida, paso);
      reloj.current += paso * 1000;
      // Una lectura cada diez segundos de cámara, como la pasarela.
      if (!rapida && Math.round(reloj.current / 500) % 20 !== 0) return;
      const tiembla = (azar(7, Math.round(reloj.current / 1000)) - 0.5) * 0.08;
      setEstado(avanzar(e, { t: e.inicio + reloj.current, temp: planta.current.temp + tiembla, puerta: false, desescarche: false, alarma: false }));
    }, 500);
    return () => window.clearInterval(id);
  }, [enMarcha, rapida]);

  useEffect(() => {
    if (!estado?.fin?.bien || !estado.resultado || guardada.current) return;
    guardada.current = true;
    alTerminar({ t: estado.inicio, quien: estado.quien, subidaCh: estado.resultado.subidaCh, bajadaCh: estado.resultado.bajadaCh, minutos: Math.round((estado.fin.t - estado.inicio) / 60_000), ordenes: estado.ordenes });
  }, [estado, alTerminar]);

  const lanzar = () => {
    if (!listo) return;
    guardada.current = false;
    reloj.current = 0;
    planta.current = { ...plantaNueva(ritmoReal(camara, exteriorC), actual.temp), compresor: actual.compresor };
    setEstado(empezar(plan, quien.trim(), exteriorC, Date.now()));
  };
  const detener = () => {
    if (vivo.current) setEstado(parar(vivo.current, vivo.current.inicio + reloj.current, "Parada por el técnico"));
  };

  const cabecera = (
    <div className="gx-fila">
      <div>
        <h2>Prueba de arranque</h2>
        <p className="gx-sub">Una hora guiada para medir la huella sin esperar a los ciclos. Solo se sube la consigna y se vuelve a dejar donde estaba.</p>
      </div>
      <span className="gx-chip neutro">Cámara simulada: no se manda nada a ningún equipo</span>
    </div>
  );

  if (!plan.posible)
    return (
      <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
        {cabecera}
        <p className="gx-chip aviso gx-arr-largo">En este servicio no se puede hacer la prueba</p>
        <p className="gx-nota">{plan.motivo}</p>
      </section>
    );

  if (estado) {
    const { minutos, parte } = avance(estado, estado.inicio + reloj.current);
    const ultima = estado.lecturas[estado.lecturas.length - 1];
    const indice = FASES.findIndex((f) => f.fase === estado.fase);
    return (
      <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
        {cabecera}
        <div className="gx-fila">
          <span className={`gx-chip ${estado.fin ? (estado.fin.bien ? "correcto" : "aviso") : "azul"}`}>
            {estado.fin ? estado.fin.motivo : `Paso ${indice + 1} de ${FASES.length}: ${FASES[indice].nombre}`}
          </span>
          <span className="gx-sub">{Math.floor(minutos)} min de {MINUTOS_TOTAL} · consigna pedida {grados(estado.consignaPedida)}{ultima ? ` · ahora ${grados(ultima.temp)}` : ""}</span>
        </div>
        <div className="gx-arr-avance" role="progressbar" aria-label="Avance de la prueba" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(parte * 100)}><i style={{ width: `${parte * 100}%` }} /></div>
        <GraficaPrueba e={estado} />
        {!estado.fin && <p className="gx-nota">{FASES[indice].hace} <b>Se mide:</b> {FASES[indice].mide.toLowerCase()}</p>}
        {estado.fin && !estado.fin.bien && <p className="gx-nota">La consigna ha vuelto a {grados(plan.consigna)} en el mismo momento. No se ha guardado ninguna huella de esta prueba.</p>}
        {estado.fin?.bien && estado.resultado && (
          <p className="gx-nota">Huella guardada: parada pierde {estado.resultado.subidaCh.toLocaleString("es-ES", { maximumFractionDigits: 1 })} °C por hora y en marcha baja {estado.resultado.bajadaCh.toLocaleString("es-ES", { maximumFractionDigits: 1 })} °C por hora. Ya se usa arriba, en «Lo esperado frente a lo medido».</p>
        )}
        <ul className="gx-lista gx-arr-ordenes">
          {estado.ordenes.map((o) => (
            <li key={o.t}><span><strong style={{ fontWeight: 500 }}>{o.texto}</strong><small>Consigna a {grados(o.consigna)} · {hora(o.t)} · con permiso de {estado.quien}</small></span></li>
          ))}
          {estado.ordenes.length === 0 && <li><span><small>Todavía no se ha dado ninguna orden.</small></span></li>}
        </ul>
        <div className="gx-acciones">
          {!estado.fin && <button type="button" className="gx-boton peligro" onClick={detener}><Square size={15} strokeWidth={1.8} aria-hidden="true" /> Parar y devolver la consigna</button>}
          {!estado.fin && <button type="button" className="gx-boton secundario" onClick={() => setRapida(!rapida)}>{rapida ? "Ver a su ritmo real" : "Acelerar (solo en simulado)"}</button>}
          {estado.fin && <button type="button" className="gx-boton secundario" onClick={() => { setEstado(null); setPermiso(false); }}>Cerrar</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
      {cabecera}
      {hecha && <p className="gx-chip correcto gx-arr-largo">Hecha el {new Date(hecha.t).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} a las {hora(hecha.t)}, con permiso de {hecha.quien}</p>}
      <ol className="gx-arr-fases">
        {FASES.map((f) => (
          <li key={f.fase}>
            <strong>{f.nombre}</strong>
            <span className="tiempo">{f.fase === "reposo" || f.fase === "final" ? `${MINUTOS[f.fase]} min` : `hasta ${MINUTOS[f.fase]} min`}</span>
            <p>{f.hace}</p>
            <p><b>Se mide:</b> {f.mide}</p>
          </li>
        ))}
      </ol>
      <dl className="gx-datos-cifras">
        <div><dt>Consigna de siempre</dt><dd>{grados(plan.consigna)}</dd><small>Se devuelve al acabar</small></div>
        <div><dt>Sube como mucho a</dt><dd>{grados(plan.tope)}</dd><small>Si pasa de {grados(plan.corte)}, se para sola</small></div>
        <div><dt>Límite del género</dt><dd>{grados(plan.limite)}</dd><small>La prueba se queda {MARGEN_LIMITE_C} °C por debajo</small></div>
      </dl>
      <p className="gx-nota">La prueba se para sola y devuelve la consigna si se abre la puerta más de un minuto, empieza un desescarche, salta una alarma, dejan de llegar lecturas o la temperatura sube más de lo previsto. También se puede parar a mano en cualquier momento.</p>

      <div className="gx-arr-previas">
        <h3>Antes de empezar</h3>
        <ul>
          {previas.map((c) => (
            <li key={c.texto} className={c.bien ? "bien" : "mal"}>
              {c.bien ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <X size={16} strokeWidth={2} aria-hidden="true" />}
              {c.texto}
              <span className="gx-solo-lector">{c.bien ? ": correcto" : ": falta"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="gx-arr-permiso">
        <label className="gx-campo">
          Quién da el permiso
          <input value={quien} onChange={(ev) => setQuien(ev.target.value)} placeholder="Nombre del técnico responsable" maxLength={80} autoComplete="off" />
        </label>
        <label className="gx-arr-casilla">
          <input type="checkbox" checked={permiso} onChange={(ev) => setPermiso(ev.target.checked)} />
          <span>Estoy en la instalación o en contacto con quien está, sé qué género hay dentro y doy permiso para subir la consigna de {camara.nombre} hasta {grados(plan.tope)} durante una hora como mucho.</span>
        </label>
      </div>
      <div className="gx-acciones">
        <button type="button" className="gx-boton" disabled={!listo} onClick={lanzar}><Play size={15} strokeWidth={1.8} aria-hidden="true" /> {hecha ? "Repetir la prueba" : "Empezar la prueba"}</button>
      </div>
      {!listo && <p className="gx-nota">{previas.every((c) => c.bien) ? "Para empezar hace falta el nombre de quien da el permiso y marcar la casilla." : "Ahora mismo no se puede empezar: hay una comprobación sin cumplir. Se vuelve a mirar sola cada minuto."}</p>}
    </section>
  );
}
