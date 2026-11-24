"use client";

import { ArrowDownRight, ArrowUpRight, ChevronDown, Download, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GraficaHistorico } from "@/components/grafica-historico";
import type { Instalacion, RespuestaResumen, RespuestaSerie } from "@/historicos/consulta";
import { DIA, HORA, TEXTO_ESTADO, arranquesAntes, cambios, comparable, csvEjecutado, csvLecturas, type Cambio, type Ejecutado, type EstadoOrden, type MetaVariable, type Valor } from "@/historicos/modelo";
import { ID_SIMULADA, VARIABLES_SIMULADAS, resumenSimulado, serieSimulada } from "@/historicos/simulada";
import { NAVES } from "@/lib/naves";
import { useDemo } from "@/lib/store";

type IdPeriodo = "24h" | "7d" | "30d" | "fechas";
const PERIODOS: { id: IdPeriodo; texto: string; ms: number; anterior: string }[] = [
  { id: "24h", texto: "24 horas", ms: DIA, anterior: "las 24 horas anteriores" },
  { id: "7d", texto: "7 días", ms: 7 * DIA, anterior: "los 7 días anteriores" },
  { id: "30d", texto: "30 días", ms: 30 * DIA, anterior: "los 30 días anteriores" },
  { id: "fechas", texto: "Entre fechas", ms: 0, anterior: "los mismos días de antes" },
];
const CLAVE = "gradiox-historicos";
const CUANTOS = 5;

const numero = (n: number, unidad?: string) => {
  const d = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  const s = Math.abs(n).toLocaleString("es-ES", { maximumFractionDigits: d, minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(d, 1) });
  return `${n < 0 && s !== "0" ? "−" : ""}${s}${unidad ? ` ${unidad}` : ""}`;
};
const porciento = (n: number) => `${Math.round(n * 100)} %`;
const veces = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`;
const cuando = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const diaIso = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const valorTexto = (x: Valor | undefined, unidad?: string) => (x === undefined || x === null ? "sin dato" : typeof x === "boolean" ? (x ? "sí" : "no") : typeof x === "number" ? numero(x, unidad) : x);
const CHIP: Record<EstadoOrden, string> = { hecha: "correcto", pendiente: "azul", enviada: "azul", rechazada: "error", caducada: "neutro", anulada: "neutro" };

function descargar(nombre: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lo que ha cambiado, dicho en claro. No se dice si es bueno o malo: depende de qué mida la variable. */
function frase(c: Cambio, m: MetaVariable): { texto: string; sube: boolean; chip: string } {
  const sube = c.tipo === "deriva" ? c.ahora > 0 : c.ahora > (c.antes ?? 0);
  switch (c.tipo) {
    case "media":
      return { sube, chip: `${sube ? "Sube" : "Baja"} ${numero(Math.abs(c.ahora - (c.antes as number)), m.unidad)}`, texto: `Media ${numero(c.ahora, m.unidad)}; antes, ${numero(c.antes as number, m.unidad)}` };
    case "deriva":
      return { sube, chip: sube ? "Subiendo" : "Bajando", texto: `Lleva el periodo ${sube ? "subiendo" : "bajando"}: ${numero(Math.abs(c.ahora), m.unidad)} cada día` };
    case "marcha":
      return { sube, chip: sube ? "Más tiempo" : "Menos tiempo", texto: `En «sí» el ${porciento(c.ahora)} del tiempo; antes, el ${porciento(c.antes as number)}` };
    case "arranques":
      return { sube, chip: sube ? "Más veces" : "Menos veces", texto: `Ha pasado a «sí» ${veces(c.ahora)}; antes, ${veces(c.antes as number)}` };
  }
}

function ElegirVariable({ variables, elegida, alElegir }: { variables: MetaVariable[]; elegida: MetaVariable | null; alElegir: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: PointerEvent) => !caja.current?.contains(ev.target as Node) && setAbierto(false);
    const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const dentro = q ? variables.filter((m) => `${m.grupo} ${m.nombre} ${m.v}`.toLowerCase().includes(q)) : variables;
    const out = new Map<string, MetaVariable[]>();
    for (const m of dentro.slice(0, 120)) out.set(m.grupo, [...(out.get(m.grupo) ?? []), m]);
    return { grupos: [...out], total: dentro.length };
  }, [variables, busca]);
  return (
    <div className="gx-his-elegir" ref={caja}>
      <button type="button" className="gx-his-elegida" aria-expanded={abierto} aria-haspopup="listbox" onClick={() => setAbierto(!abierto)}>
        <span>
          <small>{elegida ? elegida.grupo : "Variable"}</small>
          {elegida ? elegida.nombre : "Elegir una variable"}
        </span>
        <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="gx-his-lista">
          <label className="gx-his-busca">
            <Search size={17} strokeWidth={1.6} aria-hidden="true" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar qué ver" aria-label={`Buscar entre ${variables.length} datos`} />
          </label>
          <div role="listbox" aria-label="Variables">
            {grupos.grupos.map(([g, ms]) => (
              <div key={g} role="group" aria-label={g}>
                <p>{g}</p>
                {ms.map((m) => (
                  <button key={m.v} type="button" role="option" aria-selected={m.v === elegida?.v} onClick={() => { alElegir(m.v); setAbierto(false); setBusca(""); }}>
                    {m.nombre}
                    <small>{m.clase === "numero" ? (m.unidad ?? "número") : "sí / no"}</small>
                  </button>
                ))}
              </div>
            ))}
            {grupos.total === 0 && <p className="vacio">Ninguna variable se llama así.</p>}
            {grupos.total > 120 && <p className="vacio">Hay {grupos.total}. Escribe algo más para acotar.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La pantalla de históricos. En la app del cliente lleva también la nave de
 * demostración; en el panel interno, solo las instalaciones conectadas.
 */
/** Con `fija`, enseña solo esa instalación y sin cabecera: así va dentro de la página de la instalación en ops. */
export function PantallaHistoricos({ api = "/api/historicos", conDemo = true, fija }: { api?: string; conDemo?: boolean; fija?: string }) {
  const { ajustes, ordenes } = useDemo();
  const [reales, setReales] = useState<Instalacion[] | null>(null);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<IdPeriodo>("7d");
  const [fechas, setFechas] = useState({ desde: "", hasta: "" });
  const [base, setBase] = useState<number | null>(null);
  const [res, setRes] = useState<{ clave: string; datos: RespuestaResumen } | null>(null);
  const [ser, setSer] = useState<{ clave: string; datos: RespuestaSerie } | null>(null);
  const [fallo, setFallo] = useState("");
  const [elegida, setElegida] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "hechas" | "no">("todas");
  const grafica = useRef<HTMLElement>(null);

  useEffect(() => {
    const ahora = Date.now();
    setBase(ahora);
    setFechas({ desde: diaIso(ahora - 6 * DIA), hasta: diaIso(ahora) });
    try {
      const g = JSON.parse(window.localStorage.getItem(CLAVE + api) ?? "{}") as { origen?: string; periodo?: IdPeriodo };
      // Un enlace puede traer la instalación elegida.
      const q = new URLSearchParams(window.location.search);
      const pedida = q.get("id");
      if (fija ?? pedida ?? g.origen) setOrigenId(fija ?? pedida ?? g.origen ?? null);
      // Y la variable que se quiere ver, como la temperatura de un servicio desde Servicios.
      if (pedida && q.get("variable")) setElegida(q.get("variable"));
      if (g.periodo && PERIODOS.some((p) => p.id === g.periodo && p.id !== "fechas")) setPeriodo(g.periodo);
    } catch {
      // Sin almacenamiento se empieza con lo de siempre.
    }
    fetch(api, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ instalaciones: Instalacion[] }>) : Promise.reject()))
      .then((d) => setReales(d.instalaciones))
      .catch(() => setReales([]));
  }, []);
  const recordar = (origen: string | null, p: IdPeriodo) => {
    try {
      window.localStorage.setItem(CLAVE + api, JSON.stringify({ origen, periodo: p }));
    } catch {
      // Vale solo para esta visita.
    }
  };

  const origenes = useMemo<Instalacion[]>(
    () => [...(reales ?? []), ...(conDemo ? [{ id: ID_SIMULADA, nombre: NAVES[0].nombre, simulada: true, primera: null, ultima: null, variables: VARIABLES_SIMULADAS }] : [])],
    [reales, conDemo],
  );
  const origen = reales === null ? null : fija ? (origenes.find((o) => o.id === fija) ?? null) : (origenes.find((o) => o.id === origenId) ?? origenes.find((o) => o.ultima !== null) ?? origenes[origenes.length - 1] ?? null);
  const esDemo = origen?.id === ID_SIMULADA;

  const rango = useMemo(() => {
    if (base === null) return null;
    if (periodo === "fechas") {
      const d = new Date(`${fechas.desde}T00:00`).getTime();
      const h = new Date(`${fechas.hasta}T00:00`).getTime() + DIA;
      return Number.isFinite(d) && Number.isFinite(h) && h > d && h - d <= 366 * DIA ? { desde: d, hasta: h } : null;
    }
    const hasta = Math.ceil(base / HORA) * HORA;
    return { desde: hasta - (PERIODOS.find((p) => p.id === periodo)?.ms ?? DIA), hasta };
  }, [base, periodo, fechas]);
  const clave = origen && rango ? `${origen.id}|${rango.desde}|${rango.hasta}` : "";

  useEffect(() => {
    if (!origen || !rango || base === null) return;
    setFallo("");
    if (origen.id === ID_SIMULADA) {
      setRes({ clave, datos: resumenSimulado(rango.desde, rango.hasta, ajustes, ordenes, base) });
      return;
    }
    let vivo = true;
    fetch(`${api}?id=${origen.id}&desde=${rango.desde}&hasta=${rango.hasta}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as RespuestaResumen) : Promise.reject(new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error))))
      .then((datos) => vivo && setRes({ clave, datos }))
      .catch((e: Error) => vivo && setFallo(e.message || "No se han podido consultar los históricos. Vuelve a intentarlo en un momento."));
    return () => {
      vivo = false;
    };
    // `clave` resume origen y rango.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ajustes, ordenes]);

  const resumen = res?.clave === clave ? res.datos : null;
  const dias = rango ? (rango.hasta - rango.desde) / DIA : 1;
  const lista = useMemo(() => (resumen ? cambios(resumen.actual, resumen.anterior, dias) : []), [resumen, dias]);
  const metas = useMemo(() => new Map((origen?.variables ?? []).map((m) => [m.v, m])), [origen]);
  const conDatos = useMemo(() => new Set(resumen?.actual.map((r) => r.v)), [resumen]);
  const variable = (elegida && metas.has(elegida) ? elegida : null) ?? lista.find((c) => metas.has(c.v))?.v ?? origen?.variables.find((m) => m.clase === "numero" && (!resumen || conDatos.has(m.v)))?.v ?? origen?.variables[0]?.v ?? null;
  const meta = variable ? (metas.get(variable) ?? null) : null;
  const claveSerie = variable ? `${clave}|${variable}` : "";

  useEffect(() => {
    if (!origen || !rango || !variable || base === null) return;
    if (origen.id === ID_SIMULADA) {
      setSer({ clave: claveSerie, datos: serieSimulada(variable, rango.desde, rango.hasta, ajustes, base) });
      return;
    }
    let vivo = true;
    fetch(`${api}?id=${origen.id}&variable=${encodeURIComponent(variable)}&desde=${rango.desde}&hasta=${rango.hasta}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<RespuestaSerie>) : Promise.reject()))
      .then((datos) => vivo && setSer({ clave: claveSerie, datos }))
      .catch(() => vivo && setFallo("No se ha podido traer la gráfica. Vuelve a intentarlo en un momento."));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSerie, ajustes]);
  const serie = ser?.clave === claveSerie ? ser.datos : null;

  if (reales === null || base === null) return <p className="gx-sub">Preparando los históricos…</p>;
  if (!origen && fija) return <section className="gx-tarjeta"><p className="gx-vacio">Todavía no hay lecturas guardadas de esta instalación. En cuanto su programa entregue, aquí queda todo lo que lea y todo lo que se le mande hacer.</p></section>;
  if (!origen)
    return (
      <>
        <header className="gx-cabecera"><div><h1>Históricos</h1><p className="gx-sub">Todo lo leído y lo ejecutado en cada instalación</p></div></header>
        <section className="gx-tarjeta">
          <h2>Todavía no hay ninguna instalación</h2>
          <p className="gx-vacio">El primer paso es crear una instalación en Instalaciones y encender su programa: en cuanto entregue lecturas, aquí queda guardado todo lo que lea y todo lo que se le mande hacer.</p>
        </section>
      </>
    );

  const elegirPeriodo = (p: IdPeriodo) => {
    setPeriodo(p);
    setBase(Date.now());
    setTodos(false);
    if (p !== "fechas") recordar(origen.id, p);
  };
  const elegirOrigen = (id: string) => {
    setOrigenId(id);
    setElegida(null);
    setTodos(false);
    recordar(id, periodo);
  };
  const ver = (v: string) => {
    setElegida(v);
    grafica.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const textoPeriodo = PERIODOS.find((p) => p.id === periodo) ?? PERIODOS[0];
  const suya = resumen?.actual.find((r) => r.v === variable) ?? null;
  const antesDe = new Map(resumen?.anterior.map((r) => [r.v, r]));
  const suyaAntes = suya && comparable(suya, antesDe.get(suya.v)) ? (antesDe.get(suya.v) ?? null) : null;
  const sinAnterior = resumen !== null && resumen.actual.length > 0 && !resumen.actual.some((r) => comparable(r, antesDe.get(r.v)));
  const faltaAnterior = `Todavía no hay bastantes lecturas de ${textoPeriodo.anterior} con las que comparar${origen.primera ? `: las primeras son del ${cuando(origen.primera)}` : ""}.`;
  // Cuánto del periodo anterior está cubierto, frente a este.
  const cubierto = resumen && resumen.actual.length ? resumen.anterior.reduce((s, r) => s + r.ms, 0) / resumen.actual.reduce((s, r) => s + r.ms, 0) : 1;
  const ejecutado = resumen?.ejecutado ?? [];
  const hechas = ejecutado.filter((e) => e.estado === "hecha").length;
  const visibles = ejecutado.filter((e) => filtro === "todas" || (filtro === "hechas" ? e.estado === "hecha" : e.estado !== "hecha"));
  // En la gráfica se marcan las órdenes dadas a la propia variable y a las de su mismo grupo: una consigna cambiada se nota en la temperatura.
  const prefijo = (v: string) => v.slice(0, Math.max(0, v.lastIndexOf(".")));
  function enSuGrupo(e: Ejecutado) {
    if (!e.v || !variable) return false;
    return e.v === variable || prefijo(e.v) === prefijo(variable) || (meta !== null && metas.get(e.v)?.grupo === meta.grupo);
  }
  const marcas = ejecutado.filter((e) => e.estado === "hecha" && enSuGrupo(e)).map((e) => e.t);
  const valor = (n: number) => numero(n, meta?.unidad);
  const quieta = suya?.pendiente == null || suya.max === null || suya.min === null || Math.abs(suya.pendiente * dias) < Math.max((suya.max - suya.min) * 0.1, 0.05);

  return (
    <>
      {!fija && (
        <header className="gx-cabecera">
          <div>
            <h1>Históricos</h1>
            <p className="gx-sub">Todo lo leído y lo ejecutado en {origen.nombre}, comparado con {textoPeriodo.anterior}</p>
          </div>
          {(esDemo || origen.simulada) && <span className="gx-chip neutro">Datos simulados</span>}
        </header>
      )}

      <div className="gx-pila">
        <div className="gx-his-filtros">
          {origenes.length > 1 && !fija && (
            <label className="gx-campo">
              Instalación
              <select value={origen.id} onChange={(e) => elegirOrigen(e.target.value)}>
                {origenes.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}{o.id === ID_SIMULADA ? " (simulada)" : ""}</option>
                ))}
              </select>
            </label>
          )}
          <div className="gx-pestanas" role="group" aria-label="Periodo">
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" aria-pressed={p.id === periodo} onClick={() => elegirPeriodo(p.id)}>{p.texto}</button>
            ))}
          </div>
          {periodo === "fechas" && (
            <div className="gx-his-fechas">
              <label className="gx-campo">Desde<input type="date" value={fechas.desde} max={fechas.hasta} onChange={(e) => setFechas({ ...fechas, desde: e.target.value })} /></label>
              <label className="gx-campo">Hasta<input type="date" value={fechas.hasta} min={fechas.desde} max={diaIso(base)} onChange={(e) => setFechas({ ...fechas, hasta: e.target.value })} /></label>
            </div>
          )}
        </div>

        {fallo && <p className="gx-chip error" role="alert">{fallo}</p>}
        {!rango && <p className="gx-vacio">Elige las dos fechas: la primera no puede ser posterior a la segunda y entre las dos no puede haber más de un año.</p>}

        {rango && !esDemo && origen.ultima === null ? (
          <section className="gx-tarjeta">
            <h2>Todavía no hay nada que enseñar</h2>
            <p className="gx-vacio">Esta instalación no ha entregado lecturas. El primer paso es encender su pasarela: en cuanto entregue, aquí queda guardado todo lo que lea y todo lo que se le mande hacer.</p>
          </section>
        ) : rango && (
          <>
            <section className="gx-tarjeta gx-pila" style={{ gap: 10 }} aria-busy={!resumen}>
              <div className="gx-fila">
                <div>
                  <h2>Qué ha cambiado</h2>
                  <p className="gx-sub">Lo que se sale de lo que venía siendo, para verlo antes de que sea un problema o un gasto</p>
                </div>
                {resumen && lista.length > 0 && <span className="gx-chip azul">{lista.length} de {resumen.actual.length} datos</span>}
              </div>
              {!resumen ? (
                <p className="gx-vacio">Comparando con {textoPeriodo.anterior}…</p>
              ) : resumen.actual.length === 0 ? (
                <p className="gx-vacio">No hay lecturas en este periodo. Prueba con uno más largo o con otras fechas.</p>
              ) : lista.length === 0 && sinAnterior ? (
                <p className="gx-vacio">{faltaAnterior} Prueba con un periodo más corto; con el tiempo, la comparación sale sola.</p>
              ) : lista.length === 0 ? (
                <p className="gx-vacio">Nada se sale de lo habitual: los {resumen.actual.length} datos se comportan como en {textoPeriodo.anterior}.</p>
              ) : (
                <>
                  <ul className="gx-his-cambios">
                    {lista.slice(0, todos ? 40 : CUANTOS).map((c) => {
                      const m = metas.get(c.v);
                      if (!m) return null;
                      const f = frase(c, m);
                      const Flecha = f.sube ? ArrowUpRight : ArrowDownRight;
                      return (
                        <li key={c.v}>
                          <button type="button" aria-current={c.v === variable ? "true" : undefined} onClick={() => ver(c.v)}>
                            <span className="nombre">
                              <small>{m.grupo}</small>
                              {m.nombre}
                            </span>
                            <span className="texto">{f.texto}</span>
                            <span className="gx-chip neutro"><Flecha size={15} strokeWidth={1.8} aria-hidden="true" />{f.chip}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {lista.length > CUANTOS && (
                    <button type="button" className="gx-enlace" onClick={() => setTodos(!todos)}>{todos ? "Ver solo los más grandes" : `Ver los ${Math.min(lista.length, 40)} cambios`}</button>
                  )}
                </>
              )}
              {sinAnterior && lista.length > 0 && <p className="gx-nota">{faltaAnterior} De momento solo sale lo que lleva el periodo subiendo o bajando.</p>}
              {resumen && !sinAnterior && cubierto < 0.9 && <p className="gx-nota">Del periodo anterior hay datos de menos tiempo (un {porciento(cubierto)} del de este), así que las veces se comparan al mismo ritmo.</p>}
              <p className="gx-nota">Gradiox señala lo que cambia, no si es bueno o malo: eso depende de qué mida cada dato. Sirve para mirar a tiempo un equipo que arranca más veces, una temperatura que se va yendo o una máquina que trabaja más horas que antes.</p>
            </section>

            <section className="gx-tarjeta gx-pila" style={{ gap: 12 }} ref={grafica} aria-busy={!serie}>
              <div className="gx-fila gx-his-cabeza">
                <ElegirVariable variables={origen.variables} elegida={meta} alElegir={setElegida} />
                <button type="button" className="gx-boton secundario" disabled={!serie || !meta || !serie.actual.length} onClick={() => serie && meta && descargar(`gradiox ${origen.nombre} ${meta.grupo} ${meta.nombre} ${diaIso(rango.desde)}`, csvLecturas(meta, serie.actual))}>
                  <Download size={17} aria-hidden="true" /> Descargar
                </button>
              </div>
              {!meta ? (
                <p className="gx-vacio">Esta instalación todavía no tiene datos leídos.</p>
              ) : !serie ? (
                <p className="gx-vacio">Trayendo las lecturas…</p>
              ) : serie.actual.length === 0 ? (
                <p className="gx-vacio">Esta variable no tiene lecturas en este periodo.</p>
              ) : (
                <>
                  <GraficaHistorico clase={meta.clase} actual={serie.actual} anterior={serie.anterior} desde={serie.desde} hasta={serie.hasta} tramoMs={serie.tramoMs} marcas={marcas} valor={valor} eje={(n) => numero(n)} titulo={`${meta.grupo}, ${meta.nombre}, comparada con ${textoPeriodo.anterior}`} />
                  {serie.porHoras && <p className="gx-nota">Este periodo alcanza fechas de hace más de 30 días, de las que se guarda el resumen por horas: cada punto resume al menos una hora.</p>}
                  {suya && suya.clase === "numero" && suya.media !== null ? (
                    <div className="gx-cifras gx-his-cifras">
                      <div><span>Media</span><strong>{valor(suya.media)}</strong><small>{suyaAntes?.media != null ? `Antes, ${valor(suyaAntes.media)}` : "Sin periodo anterior"}</small></div>
                      <div><span>Mínima</span><strong>{valor(suya.min as number)}</strong><small>{suyaAntes?.min != null ? `Antes, ${valor(suyaAntes.min)}` : " "}</small></div>
                      <div><span>Máxima</span><strong>{valor(suya.max as number)}</strong><small>{suyaAntes?.max != null ? `Antes, ${valor(suyaAntes.max)}` : " "}</small></div>
                      <div><span>Hacia dónde va</span><strong>{quieta ? "Estable" : (suya.pendiente as number) > 0 ? "Sube" : "Baja"}</strong><small>{quieta ? "Sin subir ni bajar de forma sostenida" : `${valor(Math.abs(suya.pendiente as number))} cada día`}</small></div>
                    </div>
                  ) : suya && suya.activa !== null ? (
                    <div className="gx-cifras gx-his-cifras dos">
                      <div><span>Tiempo en «sí»</span><strong>{porciento(suya.activa)}</strong><small>{suyaAntes?.activa != null ? `Antes, el ${porciento(suyaAntes.activa)}` : "Sin periodo anterior"}</small></div>
                      <div><span>Veces que pasó a «sí»</span><strong>{suya.arranques}</strong><small>{suyaAntes?.activa != null ? `Antes, ${arranquesAntes(suya, suyaAntes)}` : " "}</small></div>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
              <div className="gx-fila">
                <div>
                  <h2>Lo ejecutado</h2>
                  <p className="gx-sub">Cada orden que se ha dado a la instalación: qué, cuándo, quién y cómo quedó</p>
                </div>
                {ejecutado.length > 0 && (
                  <button type="button" className="gx-boton secundario" onClick={() => descargar(`gradiox ${origen.nombre} ordenes ${diaIso(rango.desde)}`, csvEjecutado(ejecutado))}>
                    <Download size={17} aria-hidden="true" /> Descargar
                  </button>
                )}
              </div>
              {!resumen ? (
                <p className="gx-vacio">Consultando…</p>
              ) : ejecutado.length === 0 ? (
                <p className="gx-vacio">{esDemo ? "No se ha dado ninguna orden en este periodo. En la demostración se dan desde la ficha de un servicio o desde Fallos típicos, y aquí quedan apuntadas." : "No se ha dado ninguna orden en este periodo. Cuando se mande cambiar algo en la instalación, aquí queda apuntado con su valor de antes y de después."}</p>
              ) : (
                <>
                  {hechas > 0 && hechas < ejecutado.length && (
                    <div className="gx-pestanas" role="group" aria-label="Qué órdenes se ven">
                      <button type="button" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas · {ejecutado.length}</button>
                      <button type="button" aria-pressed={filtro === "hechas"} onClick={() => setFiltro("hechas")}>Hechas · {hechas}</button>
                      <button type="button" aria-pressed={filtro === "no"} onClick={() => setFiltro("no")}>Sin hacer · {ejecutado.length - hechas}</button>
                    </div>
                  )}
                  <ul className="gx-his-ejecutado">
                    {visibles.slice(0, 200).map((e: Ejecutado) => {
                      const u = e.v ? metas.get(e.v)?.unidad : undefined;
                      return (
                        <li key={e.id}>
                          <span className="que">
                            {e.que}
                            {e.valor !== undefined && <small>{e.antes !== undefined ? `De ${valorTexto(e.antes, u)} a ${valorTexto(e.valor, u)}` : `Pedido: ${valorTexto(e.valor, u)}`}{e.leido !== undefined && e.leido !== e.valor ? `; después se leyó ${valorTexto(e.leido, u)}` : ""}</small>}
                            {e.motivo && <small>{e.motivo}</small>}
                          </span>
                          <span className={`gx-chip ${CHIP[e.estado]}`}>{TEXTO_ESTADO[e.estado]}</span>
                          <span className="pie">{cuando(e.t)}{e.quien ? ` · ${e.quien}` : ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {visibles.length > 200 && <p className="gx-nota">Se enseñan las 200 más recientes. La descarga las trae todas.</p>}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
