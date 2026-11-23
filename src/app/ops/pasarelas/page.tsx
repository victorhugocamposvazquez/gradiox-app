"use client";

import { Ban, Check, ChevronDown, Clock, Copy, KeyRound, ListChecks, Plus, Power, PowerOff, Save, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AreaTexto } from "@/components/area-texto";
import { SinBase } from "@/components/sin-base";
import { conJson, pedir } from "@/clientes/navegador";
import type { UltimaLectura } from "@/pasarelas/almacen";
import type { Pasarela, ResumenPasarela, SituacionToken } from "@/pasarelas/modelo";
import type { Escribible, EstadoOrden, Orden } from "@/pasarelas/ordenes";
import type { EstadoPrueba, Prueba } from "@/pasarelas/pruebas";
import type { Paso } from "@/pasarelas/puesta";
import { explicarOrden } from "@/pasarelas/explicar";

const fecha = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const hace = (t: number, ahora: number) => {
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  return s < 90 ? "ahora" : s < 5400 ? `hace ${Math.round(s / 60)} min` : s < 172_800 ? `hace ${Math.round(s / 3600)} h` : `el ${fecha(t)}`;
};
const PLATAFORMAS: Record<string, string> = { "darwin-arm64": "Mac", "darwin-amd64": "Mac (Intel)", "windows-amd64": "Windows", "linux-amd64": "Linux" };

/** Cómo está la instalación, en una palabra y un tono. */
function situacion(p: ResumenPasarela, ahora: number): { tono: string; texto: string } {
  if (p.token === "anulado") return { tono: "neutro", texto: "Token anulado" };
  if (p.token === "caducado") return { tono: "aviso", texto: "Token caducado" };
  if (!p.contacto) return { tono: "azul", texto: "Sin estrenar" };
  if (ahora - p.contacto.t > 5 * 60_000) return { tono: "aviso", texto: "Callada" };
  if (p.contacto.estado.plc !== "conectado") return { tono: "aviso", texto: "Sin PLC" };
  if (p.propuesta) return { tono: "azul", texto: p.contacto.estado.simulado ? "Propone su lista (simulado)" : "Propone su lista" };
  return { tono: "correcto", texto: p.contacto.estado.simulado ? "Leyendo (simulado)" : "Leyendo" };
}

function valor(l: UltimaLectura, unidad?: string) {
  if (l.x === null) return "—";
  if (typeof l.x === "boolean") return l.x ? "Sí" : "No";
  if (typeof l.x === "number") return `${l.x.toLocaleString("es-ES", { maximumFractionDigits: 2 })}${unidad && unidad !== "sí/no" ? ` ${unidad}` : ""}`;
  return l.x;
}

function Token({ token, alCerrar }: { token: string; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiado(true);
    } catch {
      // Sin permiso para el portapapeles se copia a mano.
    }
  };
  return (
    <section className="gx-tarjeta gx-token" role="status">
      <h2>Token de la instalación</h2>
      <p className="gx-nota">Cópialo ahora y pégalo en el programa, en «Conexión». No se vuelve a enseñar: si se pierde, se cambia por otro con «Token nuevo».</p>
      <code>{token}</code>
      <div className="gx-fila">
        <button type="button" className="gx-boton" onClick={copiar}>
          {copiado ? <Check size={18} strokeWidth={1.7} aria-hidden="true" /> : <Copy size={18} strokeWidth={1.7} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar el token"}
        </button>
        <button type="button" className="gx-boton-enlace" onClick={alCerrar}>Ya lo he guardado</button>
      </div>
    </section>
  );
}

const ESTADO_ORDEN: Record<EstadoOrden, { tono: string; texto: string }> = {
  pendiente: { tono: "azul", texto: "Esperando al programa" },
  enviada: { tono: "azul", texto: "En el programa" },
  hecha: { tono: "correcto", texto: "Hecha" },
  rechazada: { tono: "error", texto: "No hecha" },
  caducada: { tono: "neutro", texto: "Caducada" },
  anulada: { tono: "neutro", texto: "Anulada" },
};
const textoEscribibles = (v: Escribible[]) => v.map((e) => (e.sino ? `${e.n}; sí/no` : `${e.n}; ${e.min}; ${e.max}`)).join("\n");
const verValor = (x: Orden["antes"], u?: string) => (x === undefined ? "—" : valor({ v: "", t: 0, x, simulada: false }, u));

const ESTADO_PRUEBA: Record<EstadoPrueba, { tono: string; texto: string }> = {
  programada: { tono: "neutro", texto: "Programada" },
  aplicando: { tono: "aviso", texto: "Escribiendo el valor nuevo" },
  aplicada: { tono: "aviso", texto: "Con el valor nuevo" },
  volviendo: { tono: "aviso", texto: "Volviendo al de antes" },
  devuelta: { tono: "correcto", texto: "Hecha y devuelta" },
  anulada: { tono: "neutro", texto: "Anulada" },
  fallida: { tono: "error", texto: "No se pudo hacer" },
};
const hora = (t: number) => new Date(t).toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Prueba de punta a punta: pone una variable a un valor a una hora, la deja
 * así unos minutos y la devuelve sola al valor que tenía el PLC.
 */
function PruebaProgramada({ p, variables, info, lecturas, ahora, orden, ocupado, historial }: { p: Pasarela; variables: Escribible[]; info: Map<string, Pasarela["variables"][number]>; lecturas: Map<string, UltimaLectura>; ahora: number; orden: (cuerpo: Record<string, unknown>, hecho: string) => Promise<void>; ocupado: boolean; historial: Orden[] }) {
  const [n, setN] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [cuando, setCuando] = useState("");
  const [minutos, setMinutos] = useState("10");
  const actual = variables.find((v) => v.n === n) ?? variables[0];
  const pruebas = p.pruebas ?? [];
  if (!actual) return null;
  const u = info.get(actual.n)?.u;
  const lectura = lecturas.get(actual.n);

  const programar = (ev: FormEvent) => {
    ev.preventDefault();
    const valorNuevo = actual.sino ? nuevo === "si" : Number(nuevo.replace(",", "."));
    let inicio: number | undefined;
    if (cuando) {
      // «HH:MM» de hoy; si ya ha pasado, de mañana.
      const [h, m] = cuando.split(":").map(Number);
      const d = new Date(ahora);
      d.setHours(h, m, 0, 0);
      if (d.getTime() < ahora - 60_000) d.setDate(d.getDate() + 1);
      inicio = d.getTime();
    }
    const texto = `${info.get(actual.n)?.d ?? actual.n}\n\nAhora: ${lectura ? valor(lectura, u) : "sin lectura"}\nPrueba: ${actual.sino ? (valorNuevo ? "Sí" : "No") : `${nuevo} ${u ?? ""}`} ${inicio ? `a las ${hora(inicio)}` : "ya"}, durante ${minutos} min, y vuelta sola al valor que tenga entonces.\n\nSe escribirá en el PLC${p.contacto?.estado.simulado ? " simulado" : " de la instalación"}. ¿Programar?`;
    if (!window.confirm(texto)) return;
    void orden({ accion: "programar-prueba", n: actual.n, valor: valorNuevo, inicio, minutos: Number(minutos) }, "Prueba programada.").then(() => setNuevo(""));
  };

  return (
    <div className="gx-prueba-orden">
      <h4 className="gx-subtitulo">Prueba programada</h4>
      <p className="gx-nota">Para comprobar de punta a punta que una orden llega y vuelve: pone el valor a la hora que digas, lo deja los minutos que digas y lo devuelve solo al que tenía el PLC. Si no hay internet o el programa está cerrado, no se hace nada hasta que vuelvan; la vuelta se repite hasta que queda hecha.</p>
      <form className="gx-formulario" onSubmit={programar}>
        <label className="gx-campo">
          Variable
          <select value={actual.n} onChange={(ev) => { setN(ev.target.value); setNuevo(""); }}>
            {variables.map((v) => <option key={v.n} value={v.n}>{info.get(v.n)?.d ? `${info.get(v.n)?.d} · ${v.n}` : v.n}</option>)}
          </select>
        </label>
        <label className="gx-campo">
          {actual.sino ? "Estado de prueba" : `Valor de prueba (entre ${actual.min} y ${actual.max}${u ? ` ${u}` : ""})`}
          {actual.sino ? (
            <select value={nuevo} onChange={(ev) => setNuevo(ev.target.value)}>
              <option value="">Elige</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          ) : (
            <input value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} inputMode="decimal" autoComplete="off" placeholder={lectura ? `Ahora: ${valor(lectura, u)}` : ""} />
          )}
        </label>
        <label className="gx-campo">
          A qué hora (vacío: ya)
          <input type="time" value={cuando} onChange={(ev) => setCuando(ev.target.value)} />
        </label>
        <label className="gx-campo">
          Durante (minutos)
          <input value={minutos} onChange={(ev) => setMinutos(ev.target.value)} inputMode="numeric" autoComplete="off" />
        </label>
        <div className="gx-fila ancho">
          <button type="submit" className="gx-boton" disabled={ocupado || !nuevo.trim() || !minutos.trim()}>
            <Clock size={18} strokeWidth={1.7} aria-hidden="true" /> Programar la prueba
          </button>
        </div>
      </form>
      {pruebas.length > 0 && (
        <ul className="gx-pruebas">
          {pruebas.map((pr) => {
            const s = ESTADO_PRUEBA[pr.estado];
            const uu = info.get(pr.n)?.u;
            const fin = pr.aplicada ? pr.aplicada + pr.minutos * 60_000 : null;
            return (
              <li key={pr.id}>
                <span className={`gx-chip ${s.tono}`}>{s.texto}</span>
                <span>
                  <strong>{info.get(pr.n)?.d ?? pr.n}</strong>: {verValor(pr.valor, uu)} {pr.estado === "programada" ? (pr.inicio > ahora + 60_000 ? `el ${hora(pr.inicio)}` : "en cuanto el programa pregunte") : ""} durante {pr.minutos} min, y vuelta a {verValor(pr.original, uu)}.
                  {pr.estado === "aplicada" && fin && <> Vuelve hacia las {new Date(fin).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.</>}
                  {pr.motivo && <small>{pr.motivo}</small>}
                  {pr.estado === "fallida" && (() => {
                    // El paso siguiente sale de la orden de ida que no se hizo.
                    const o = historial.find((x) => x.id === pr.ida);
                    return o ? <small>{explicarOrden(o).hacer}</small> : null;
                  })()}
                </span>
                {pr.estado === "programada" && <button type="button" className="gx-boton-enlace" disabled={ocupado} onClick={() => void orden({ accion: "parar-prueba", prueba: pr.id }, "Prueba anulada.")}>Anular</button>}
                {(pr.estado === "aplicando" || pr.estado === "aplicada") && <button type="button" className="gx-boton-enlace" disabled={ocupado} onClick={() => void orden({ accion: "parar-prueba", prueba: pr.id }, "La vuelta se pide ya.")}>Volver ya</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Un botón que pide confirmación dentro de la página, sin ventana del navegador. */
function BotonConfirmar({ texto, pregunta, si, alConfirmar, className = "gx-boton secundario", disabled, icono }: { texto: string; pregunta: string; si: string; alConfirmar: () => void; className?: string; disabled?: boolean; icono?: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) return <button type="button" className={className} disabled={disabled} onClick={() => setAbierto(true)}>{icono}{icono ? " " : ""}{texto}</button>;
  return (
    <span className="gx-confirmar" role="group" aria-label={pregunta}>
      <span>{pregunta}</span>
      <button type="button" className="gx-boton" disabled={disabled} onClick={() => { setAbierto(false); alConfirmar(); }}>{si}</button>
      <button type="button" className="gx-boton-enlace" onClick={() => setAbierto(false)}>Cancelar</button>
    </span>
  );
}

/**
 * Elegir una variable de las que ya lee esta instalación, en vez de copiar su
 * nombre. Se guarda al pulsar «Añadir»: no hay un segundo botón que olvidar.
 */
function ElegirEscribible({ p, lecturas, ya, alAnadir, ocupado }: { p: Pasarela; lecturas: Map<string, UltimaLectura>; ya: Set<string>; alAnadir: (e: Escribible) => void; ocupado: boolean }) {
  const [n, setN] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  // Solo se ofrecen las que el PLC está dando con un número o un sí/no: una estructura, un texto o una sin leer no se pueden cambiar desde aquí.
  const conValor = (n: string) => { const x = lecturas.get(n)?.x; return typeof x === "number" || typeof x === "boolean"; };
  const libres = p.variables.filter((v) => !ya.has(v.n) && conValor(v.n));
  if (!p.variables.length) return <p className="gx-nota">Esta instalación todavía no lee nada: primero elige qué se lee en el programa, con «Buscar variables».</p>;
  if (!libres.length) {
    if (p.variables.some((v) => !ya.has(v.n))) return <p className="gx-nota">Ninguna otra variable de la lista tiene valor ahora mismo. Para elegirla aquí, el programa tiene que estar leyéndola y dar un número o un sí/no.</p>;
    return null;
  }
  const actual = libres.find((v) => v.n === n);
  const l = actual ? lecturas.get(actual.n) : undefined;
  const sino = actual ? (typeof l?.x === "boolean" || /bool/i.test(actual.tipo ?? "")) : false;
  const num = (t: string) => Number(t.trim().replace(",", "."));
  const limitesBien = sino || (min.trim() !== "" && max.trim() !== "" && Number.isFinite(num(min)) && Number.isFinite(num(max)) && num(min) <= num(max));
  const anadir = () => {
    if (!actual || !limitesBien) return;
    alAnadir(sino ? { n: actual.n, sino: true } : { n: actual.n, sino: false, min: num(min), max: num(max) });
    setN(""); setMin(""); setMax("");
  };
  return (
    <div className="gx-formulario">
      <label className="gx-campo ancho">
        Añadir una variable que se pueda cambiar
        <select value={n} onChange={(ev) => setN(ev.target.value)}>
          <option value="">Elige una de las que lee</option>
          {libres.map((v) => {
            const x = lecturas.get(v.n);
            return <option key={v.n} value={v.n}>{`${v.d ? `${v.d} · ` : ""}${v.n}${x ? ` · ahora ${valor(x, v.u)}` : ""}`}</option>;
          })}
        </select>
      </label>
      {actual && !sino && (
        <>
          <label className="gx-campo">Mínimo<input value={min} onChange={(ev) => setMin(ev.target.value)} inputMode="decimal" autoComplete="off" placeholder={l ? `Ahora: ${valor(l, actual.u)}` : ""} /></label>
          <label className="gx-campo">Máximo<input value={max} onChange={(ev) => setMax(ev.target.value)} inputMode="decimal" autoComplete="off" /></label>
        </>
      )}
      {actual && (
        <div className="gx-fila ancho">
          <button type="button" className="gx-boton secundario" disabled={!limitesBien || ocupado} onClick={anadir}><Plus size={17} strokeWidth={1.7} aria-hidden="true" /> Añadir</button>
          <span className="gx-nota">{sino ? "Es de sí o no: no lleva límites." : min.trim() && max.trim() && !limitesBien ? "El mínimo tiene que ser menor que el máximo." : "Gradiox nunca escribirá fuera de estos límites."}</span>
        </div>
      )}
    </div>
  );
}

/** Órdenes al PLC: las dos llaves, qué se puede cambiar, dar una orden y ver cómo han ido. */
function Ordenes({ p, lecturas, historial, ahora, orden, ocupado }: { p: Pasarela; lecturas: Map<string, UltimaLectura>; historial: Orden[]; ahora: number; orden: (cuerpo: Record<string, unknown>, hecho: string) => Promise<void>; ocupado: boolean }) {
  const e = p.escritura;
  const variables = e?.variables ?? [];
  const [lista, setLista] = useState(() => textoEscribibles(variables));
  const [elegida, setElegida] = useState("");
  const [nuevo, setNuevo] = useState("");
  const actual = variables.find((v) => v.n === elegida) ?? variables[0];
  const info = new Map(p.variables.map((v) => [v.n, v]));
  const callado = !p.contacto || ahora - p.contacto.t > 5 * 60_000;
  const programa = !callado && Boolean(p.contacto?.estado.ordenes);
  const guardar = (vars: Escribible[], hecho: string) => orden({ accion: "escritura", texto: textoEscribibles(vars) }, hecho);

  const dar = (ev: FormEvent) => {
    ev.preventDefault();
    if (!actual) return;
    const valorNuevo = actual.sino ? nuevo === "si" : Number(nuevo.replace(",", "."));
    const ahoraVale = lecturas.get(actual.n);
    const u = info.get(actual.n)?.u;
    const texto = `${info.get(actual.n)?.d ?? actual.n}\n\nAhora: ${ahoraVale ? valor(ahoraVale, u) : "sin lectura"}\nNuevo: ${actual.sino ? (valorNuevo ? "Sí" : "No") : `${nuevo} ${u ?? ""}`}\n\nSe escribirá en el PLC${p.contacto?.estado.simulado ? " simulado" : " de la instalación"}. ¿Seguir?`;
    if (!window.confirm(texto)) return;
    void orden({ accion: "ordenar", n: actual.n, valor: valorNuevo }, "Orden dada. El programa la recoge en unos segundos.").then(() => setNuevo(""));
  };

  return (
    <section className="gx-ordenes" id={`ordenes-${p.id}`} aria-labelledby={`ordenes-t-${p.id}`}>
      <div className="gx-lista-cabeza">
        <h3 className="gx-subtitulo" id={`ordenes-t-${p.id}`}>Órdenes al PLC</h3>
        <span className={`gx-chip ${e?.activa && programa ? "correcto" : e?.activa || programa ? "aviso" : "neutro"}`}>{e?.activa && programa ? "Las dos llaves puestas" : e?.activa || programa ? "Falta una llave" : "Apagadas"}</span>
      </div>
      <p className="gx-nota">Solo se cambian las variables de esta lista y dentro de sus límites. Cada orden se confirma y queda apuntada aquí y en el ordenador de la planta.</p>

      <ul className="gx-llaves">
        <li className={e?.activa ? "puesta" : undefined}>
          <span className="marca" aria-hidden="true">{e?.activa ? <Check size={14} strokeWidth={2.4} /> : 1}</span>
          <span>
            <strong>Llave de aquí</strong>
            <small>{e?.activa ? "Activadas en el panel." : variables.length ? "Apagadas en el panel." : "Primero elige abajo qué se puede cambiar."}</small>
          </span>
          {e?.activa ? (
            <BotonConfirmar texto="Apagar" pregunta="Se dejan de dar órdenes y se anula lo pendiente." si="Apagar las órdenes" disabled={ocupado} icono={<PowerOff size={17} strokeWidth={1.6} aria-hidden="true" />} alConfirmar={() => void orden({ accion: "escritura", activa: false }, "Órdenes apagadas.")} />
          ) : (
            <BotonConfirmar texto="Activar" pregunta="Gradiox podrá cambiar estas variables cuando alguien dé una orden aquí." si="Activar las órdenes" className="gx-boton" disabled={ocupado || !variables.length} icono={<Power size={17} strokeWidth={1.6} aria-hidden="true" />} alConfirmar={() => void orden({ accion: "escritura", activa: true }, "Órdenes activadas aquí.")} />
          )}
        </li>
        <li className={programa ? "puesta" : undefined}>
          <span className="marca" aria-hidden="true">{programa ? <Check size={14} strokeWidth={2.4} /> : 2}</span>
          <span>
            <strong>Llave del programa, en la planta</strong>
            <small>{callado ? "El programa no da noticias: no se sabe." : programa ? "«Permitir órdenes de Gradiox» marcada en el programa." : "En el programa, «Conexión»: marca «Permitir órdenes de Gradiox» y pulsa «Guardar y conectar»."}</small>
          </span>
          <span className="gx-chip neutro">En el programa</span>
        </li>
      </ul>

      <h4 className="gx-subtitulo">Qué se puede cambiar</h4>
      {variables.length > 0 && (
        <ul className="gx-cambiables">
          {variables.map((v) => {
            const l = lecturas.get(v.n);
            const u = info.get(v.n)?.u;
            const fuera = !info.has(v.n);
            return (
              <li key={v.n}>
                <span>
                  <strong>{info.get(v.n)?.d ?? v.n}</strong>
                  <small><code>{v.n}</code> · {v.sino ? "sí o no" : `entre ${v.min} y ${v.max}${u ? ` ${u}` : ""}`}{l ? ` · ahora ${valor(l, u)}` : ""}</small>
                  {fuera && <small className="aviso">Ya no está en la lista de lectura: el programa rechazará sus órdenes. Quítala o vuelve a elegirla en el programa.</small>}
                </span>
                <button type="button" className="gx-boton-enlace" disabled={ocupado} onClick={() => void guardar(variables.filter((x) => x.n !== v.n), "Quitada.")}>Quitar</button>
              </li>
            );
          })}
        </ul>
      )}
      <ElegirEscribible p={p} lecturas={lecturas} ya={new Set(variables.map((v) => v.n))} ocupado={ocupado} alAnadir={(x) => void guardar([...variables, x], "Añadida. El programa lo sabrá en menos de un minuto.")} />
      <details className="gx-pegar">
        <summary>Escribir la lista a mano</summary>
        <div className="gx-formulario">
          <label className="gx-campo ancho">
            Una por línea
            <AreaTexto value={lista} onChange={(ev) => setLista(ev.target.value)} rows={4} spellCheck={false} placeholder={"variable; mínimo; máximo, o variable; sí/no\nDatos_C6_1_REAL.P_consigna_ac; -25; 5"} />
          </label>
          <div className="gx-fila ancho">
            <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void orden({ accion: "escritura", texto: lista }, "Lista guardada.")}>
              <Save size={18} strokeWidth={1.7} aria-hidden="true" /> Guardar lo escrito
            </button>
            <button type="button" className="gx-boton-enlace" onClick={() => setLista(textoEscribibles(variables))}>Traer la lista actual</button>
          </div>
        </div>
      </details>

      {e?.activa && actual && (
        <form className="gx-formulario" onSubmit={dar}>
          <h4 className="gx-subtitulo ancho">Dar una orden</h4>
          <label className="gx-campo">
            Variable
            <select value={actual.n} onChange={(ev) => { setElegida(ev.target.value); setNuevo(""); }}>
              {variables.map((v) => <option key={v.n} value={v.n}>{info.get(v.n)?.d ? `${info.get(v.n)?.d} · ${v.n}` : v.n}</option>)}
            </select>
          </label>
          <label className="gx-campo">
            {actual.sino ? "Nuevo estado" : `Nuevo valor (entre ${actual.min} y ${actual.max}${info.get(actual.n)?.u ? ` ${info.get(actual.n)?.u}` : ""})`}
            {actual.sino ? (
              <select value={nuevo} onChange={(ev) => setNuevo(ev.target.value)}>
                <option value="">Elige</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            ) : (
              <input value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} inputMode="decimal" autoComplete="off" placeholder={lecturas.get(actual.n) ? `Ahora: ${valor(lecturas.get(actual.n)!, info.get(actual.n)?.u)}` : ""} />
            )}
          </label>
          <div className="gx-fila ancho">
            <button type="submit" className="gx-boton" disabled={ocupado || !nuevo.trim()}>
              <Send size={18} strokeWidth={1.7} aria-hidden="true" /> Dar la orden
            </button>
            {!programa && <span className="gx-nota">Falta la llave del programa: la orden caducará a los 2 minutos si nadie la permite allí.</span>}
          </div>
        </form>
      )}

      {e?.activa && variables.length > 0 && <PruebaProgramada p={p} variables={variables} info={info} lecturas={lecturas} ahora={ahora} orden={orden} ocupado={ocupado} historial={historial} />}

      {historial.length > 0 && (
        <div className="gx-pasarela-tabla">
          <table className="gx-tabla">
            <thead>
              <tr><th>Variable</th><th>Antes</th><th>Pedido</th><th>Leído después</th><th>Estado</th><th>Cuándo</th></tr>
            </thead>
            <tbody>
              {historial.map((o) => {
                const s = ESTADO_ORDEN[o.estado];
                const u = info.get(o.n)?.u;
                const x = o.estado === "rechazada" || o.estado === "caducada" ? explicarOrden(o) : null;
                return (
                  <tr key={o.id}>
                    <td><code>{o.n}</code>{info.get(o.n)?.d && <small>{info.get(o.n)?.d}</small>}</td>
                    <td>{verValor(o.antes, u)}</td>
                    <td>{verValor(o.valor, u)}</td>
                    <td>{verValor(o.leido, u)}</td>
                    <td>
                      <span className={`gx-chip ${s.tono}`}>{s.texto}{o.simulada ? " (simulado)" : ""}</span>
                      {x ? <small>{`Porque ${x.que}`} {x.hacer}</small> : o.motivo && o.estado !== "hecha" && <small>{o.motivo}</small>}
                      {o.estado === "pendiente" && <button type="button" className="gx-boton-enlace" disabled={ocupado} onClick={() => void orden({ accion: "anular-orden", orden: o.id }, "Orden anulada.")}>Anular</button>}
                    </td>
                    <td>{hace(o.pedida, ahora)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Los pasos de la puesta en marcha, marcados solos con lo que cuenta el programa. */
function PuestaEnMarcha({ pasos, p, inexistentes, orden, ocupado }: { pasos: Paso[]; p: Pasarela; inexistentes: number; orden: (cuerpo: Record<string, unknown>, hecho: string) => Promise<void>; ocupado: boolean }) {
  const ahora = pasos.find((x) => !x.hecho && !x.opcional) ?? pasos.find((x) => !x.hecho) ?? null;
  const boton = (x: Paso) => {
    switch (x.accion) {
      case "token":
        return p.contacto
          ? <BotonConfirmar texto="Token nuevo" pregunta="El token actual deja de valer y habrá que pegar el nuevo en el programa." si="Sacar token nuevo" disabled={ocupado} alConfirmar={() => void orden({ accion: "renovar" }, "Token nuevo creado.")} />
          : <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void orden({ accion: "renovar" }, "Token nuevo creado.")}>Sacar el token</button>;
      case "quitar-inexistentes":
        return <BotonConfirmar texto={`Quitar las ${inexistentes} que no existen`} pregunta={`Salen de la lista las ${inexistentes} variables que el PLC no tiene. Se puede volver a la lista de antes.`} si="Quitarlas" disabled={ocupado} alConfirmar={() => void orden({ accion: "quitar-inexistentes" }, "Quitadas. El programa lo recoge en menos de un minuto.")} />;
      case "aceptar-propuesta":
        return <button type="button" className="gx-boton" disabled={ocupado} onClick={() => void orden({ accion: "aceptar-propuesta" }, "Hecho: esa es ahora la lista de la instalación.")}>Usar esta lista</button>;
      case "ordenes":
        return <button type="button" className="gx-boton-enlace" onClick={() => document.getElementById(`ordenes-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ir a órdenes</button>;
    }
    return null;
  };
  return (
    <section className="gx-puesta" aria-labelledby={`puesta-${p.id}`}>
      <div className="gx-lista-cabeza">
        <h3 className="gx-subtitulo" id={`puesta-${p.id}`}>Puesta en marcha</h3>
        <span className="gx-nota">{ahora ? (ahora.donde === "programa" ? "Lo siguiente se hace en el programa de la planta" : "Lo siguiente se hace aquí") : "Todo en marcha"}</span>
      </div>
      <ol className="gx-ruta-pasos">
        {pasos.map((x, i) => (
          <li key={x.id} className={[x.hecho ? "hecho" : x === ahora ? "ahora" : "", x.aviso ? "aviso" : ""].join(" ").trim() || undefined}>
            <span className="marca" aria-hidden="true">{x.hecho ? <Check size={14} strokeWidth={2.4} /> : i + 1}</span>
            <span>
              <strong>{x.titulo}{x.opcional && !x.hecho ? <span className="gx-opcional">solo para dar órdenes</span> : null}</strong>
              <small>{x.detalle}</small>
            </span>
            {x.accion && (!x.hecho || x.accion === "quitar-inexistentes") ? boton(x) : !x.hecho && x === ahora ? <span className="gx-chip azul">{x.donde === "programa" ? "En el programa" : "Aquí"}</span> : <span />}
          </li>
        ))}
      </ol>
    </section>
  );
}

type DatosDetalle = { ahora: number; pasarela: Pasarela; lecturas: UltimaLectura[]; ordenes: Orden[]; pasos: Paso[]; inexistentes: number };

function Detalle({ id, alCambiar, alToken }: { id: string; alCambiar: () => void; alToken: (t: string) => void }) {
  const [d, setD] = useState<DatosDetalle | null>(null);
  const [plc, setPlc] = useState("");
  const [cada, setCada] = useState("");
  const [perfil, setPerfil] = useState("");
  const [pegado, setPegado] = useState("");
  const [fallo, setFallo] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");

  const cargar = useCallback(async (rellenar: boolean) => {
    try {
      const r = await pedir<DatosDetalle>(`/api/ops/pasarelas/${id}`);
      setD(r);
      if (rellenar) {
        setPlc(r.pasarela.plc);
        setCada(r.pasarela.cadaSegundos ? String(r.pasarela.cadaSegundos) : "");
        setPerfil(r.pasarela.perfil);
      }
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido leer");
    }
  }, [id]);
  useEffect(() => {
    void cargar(true);
    // Durante la puesta en marcha se mira a menudo: los pasos se marcan solos.
    const reloj = window.setInterval(() => void cargar(false), 5_000);
    return () => window.clearInterval(reloj);
  }, [cargar]);

  const orden = async (cuerpo: Record<string, unknown>, hecho: string) => {
    setOcupado(true);
    setFallo("");
    setAviso("");
    try {
      const r = await pedir<{ token?: string }>(`/api/ops/pasarelas/${id}`, conJson("POST", cuerpo));
      if (r.token) alToken(r.token);
      setAviso(hecho);
      setPegado("");
      alCambiar();
      if (cuerpo.accion !== "borrar") await cargar(true);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido completar");
    }
    setOcupado(false);
  };
  const guardar = (ev: FormEvent) => {
    ev.preventDefault();
    void orden({ accion: "guardar", plc, cadaSegundos: Number(cada) || 0, perfil, ...(pegado.trim() ? { variablesTexto: pegado } : {}) }, "Guardado. El programa lo recoge solo en menos de un minuto.");
  };

  if (!d) return <p className="gx-vacio">{fallo || "Leyendo…"}</p>;
  const p = d.pasarela;
  const c = p.contacto;
  const porNombre = new Map(d.lecturas.map((l) => [l.v, l]));
  const q = busca.trim().toLowerCase();
  // Mientras haya una lista propuesta, el programa lee esa: es la que tiene valores recientes.
  const lista = p.propuesta ? p.propuesta.variables : p.variables;
  const filas = lista.filter((v) => !q || `${v.n} ${v.g ?? ""} ${v.d ?? ""}`.toLowerCase().includes(q));
  const conValor = lista.filter((v) => porNombre.get(v.n)?.x !== null && porNombre.get(v.n) !== undefined).length;
  // La vuelta a la lista anterior se ofrece unos días; después ya no tiene sentido.
  const anterior = p.anterior && d.ahora - p.anterior.t < 14 * 86_400_000 ? p.anterior : null;
  const mensaje = (fallo || aviso) && <p className="gx-nota" role={fallo ? "alert" : "status"} style={fallo ? { color: "var(--gx-error)" } : undefined}>{fallo || aviso}</p>;

  return (
    <div className="gx-pasarela-cuerpo">
      <div className="gx-cifras sueltas tres">
        <div><span>Programa</span><strong>{c ? `${c.programa}` : "—"} <small>{c ? PLATAFORMAS[c.plataforma] ?? c.plataforma : "sin estrenar"}</small></strong></div>
        <div><span>Último contacto</span><strong>{c ? hace(c.t, d.ahora) : "—"}</strong></div>
        <div><span>Variables con valor</span><strong>{c ? c.estado.leidas : conValor} <small>de {c ? c.estado.total : lista.length}</small></strong></div>
      </div>

      <PuestaEnMarcha pasos={d.pasos} p={p} inexistentes={d.inexistentes} orden={orden} ocupado={ocupado} />
      {mensaje}

      {anterior && (
        <p className="gx-anterior">
          <span>{anterior.motivo} {hace(anterior.t, d.ahora)}. Antes había {anterior.variables.length} {anterior.variables.length === 1 ? "variable" : "variables"}{anterior.perfil ? ` («${anterior.perfil}»)` : ""}.</span>
          <BotonConfirmar className="gx-boton-enlace" texto="Volver a la anterior" pregunta={`Vuelve la lista de ${anterior.variables.length}. La de ahora se guarda por si quieres volver.`} si="Volver" disabled={ocupado} alConfirmar={() => void orden({ accion: "lista-anterior" }, "Hecho: vuelve a regir la lista anterior.")} />
        </p>
      )}

      {p.propuesta && (
        <div className="gx-propuesta" role="status">
          <p>
            <strong>{p.propuesta.origen === "elegidas" ? `En la planta se han elegido ${p.propuesta.variables.length} variables.` : `El programa está leyendo las ${p.propuesta.variables.length} variables de su propio archivo.`}</strong>{" "}
            {p.variables.length ? `Esta instalación tiene ahora otra lista, de ${p.variables.length}.` : "Esta instalación todavía no tiene lista."} Sus lecturas ya se están guardando. Si la aceptas, pasa a ser la lista de la instalación.
          </p>
          <div className="gx-fila">
            <button type="button" className="gx-boton" disabled={ocupado} onClick={() => void orden({ accion: "aceptar-propuesta" }, "Hecho: esa es ahora la lista de la instalación.")}>
              <ListChecks size={18} strokeWidth={1.7} aria-hidden="true" /> Usar esta lista
            </button>
            <BotonConfirmar className="gx-boton-enlace" texto="Descartarla" pregunta={p.variables.length ? "El programa volverá a leer la lista de la instalación." : "El programa dejará de leer esa lista."} si="Descartar" disabled={ocupado} alConfirmar={() => void orden({ accion: "descartar-propuesta" }, "Descartada.")} />
          </div>
        </div>
      )}

      <Ordenes p={p} lecturas={porNombre} historial={d.ordenes} ahora={d.ahora} orden={orden} ocupado={ocupado} />

      {lista.length > 0 && (
        <section className="gx-ordenes">
          <div className="gx-lista-cabeza">
            <h3 className="gx-subtitulo">{p.propuesta ? "Última lectura de cada variable de la lista propuesta" : "Última lectura de cada variable"}</h3>
            <label className="gx-campo gx-filtro">
              <span className="gx-solo-lector">Buscar variable</span>
              <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" />
            </label>
          </div>
          {p.perfil && <p className="gx-nota">Lista: {p.perfil} · {lista.length} {lista.length === 1 ? "variable" : "variables"}. Para cambiarla, «Buscar variables» en el programa.</p>}
          <div className="gx-pasarela-tabla">
            <table className="gx-tabla">
              <thead>
                <tr><th>Variable</th><th>Qué es</th><th>Valor</th><th>Cuándo</th></tr>
              </thead>
              <tbody>
                {filas.slice(0, 400).map((v) => {
                  const l = porNombre.get(v.n);
                  return (
                    <tr key={v.n}>
                      <td><code>{v.n}</code>{v.g && <small>{v.g}</small>}</td>
                      <td>{v.d ?? ""}</td>
                      <td>{l ? (l.c ? <small>{l.c}</small> : valor(l, v.u)) : "—"}</td>
                      <td>{l ? hace(l.t, d.ahora) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filas.length > 400 && <p className="gx-nota">Se enseñan 400 de {filas.length}. Usa el buscador para ver las demás.</p>}
        </section>
      )}

      <details className="gx-general">
        <summary>Ajustes de la instalación: dirección del PLC, lista pegada, token</summary>
        <form className="gx-formulario" onSubmit={guardar}>
          <label className="gx-campo">
            Dirección del PLC que se propone al programa
            <input value={plc} onChange={(ev) => setPlc(ev.target.value)} placeholder="50.50.0.1" autoComplete="off" spellCheck={false} />
          </label>
          <label className="gx-campo">
            Leer cada (segundos)
            <input value={cada} onChange={(ev) => setCada(ev.target.value)} placeholder="10" inputMode="numeric" autoComplete="off" />
          </label>
          <label className="gx-campo ancho">
            Nombre de la lista de variables
            <input value={perfil} onChange={(ev) => setPerfil(ev.target.value)} placeholder="Primeras variables" maxLength={80} autoComplete="off" />
          </label>
          <label className="gx-campo ancho">
            {p.variables.length ? `Pegar otra lista de variables (ahora hay ${p.variables.length})` : "Pegar una lista de variables"}
            <AreaTexto value={pegado} onChange={(ev) => setPegado(ev.target.value)} rows={3} placeholder="Solo si viene de una hoja de cálculo, con su fila de títulos: grupo, variable, tipo, qué es, unidad. Lo normal es elegirlas en el programa." spellCheck={false} />
          </label>
          <div className="gx-fila ancho">
            <button type="submit" className="gx-boton secundario" disabled={ocupado}>
              <Save size={18} strokeWidth={1.7} aria-hidden="true" /> Guardar los ajustes
            </button>
            <span className="gx-pasarela-ordenes">
              <BotonConfirmar texto="Token nuevo" pregunta="El token actual dejará de valer y habrá que pegar el nuevo en el programa." si="Sacar token nuevo" disabled={ocupado} icono={<KeyRound size={17} strokeWidth={1.6} aria-hidden="true" />} alConfirmar={() => void orden({ accion: "renovar" }, "Token nuevo creado.")} />
              {!p.anulada && (
                <BotonConfirmar texto="Anular el token" pregunta="El programa dejará de poder entregar lecturas." si="Anular" disabled={ocupado} icono={<Ban size={17} strokeWidth={1.6} aria-hidden="true" />} alConfirmar={() => void orden({ accion: "anular" }, "Token anulado.")} />
              )}
              <BotonConfirmar texto="Borrar" pregunta="Se borran la instalación y todas sus lecturas. No se puede deshacer." si="Borrar para siempre" className="gx-boton peligro" disabled={ocupado} icono={<Trash2 size={17} strokeWidth={1.6} aria-hidden="true" />} alConfirmar={() => void orden({ accion: "borrar" }, "")} />
            </span>
          </div>
        </form>
      </details>
    </div>
  );
}

export default function Pasarelas() {
  const [lista, setLista] = useState<ResumenPasarela[] | null>(null);
  const [ahora, setAhora] = useState(0);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState("");
  const [abierta, setAbierta] = useState("");

  const cargar = useCallback(async () => {
    try {
      const d = await pedir<{ guardado: "memoria" | "base"; ahora: number; pasarelas: ResumenPasarela[] }>("/api/ops/pasarelas");
      setLista(d.pasarelas);
      setAhora(d.ahora);
      setGuardado(d.guardado);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido leer");
    }
  }, []);
  useEffect(() => {
    void cargar();
    const reloj = window.setInterval(() => void cargar(), 15_000);
    return () => window.clearInterval(reloj);
  }, [cargar]);

  const alta = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ pasarela: ResumenPasarela; token: string }>("/api/ops/pasarelas", conJson("POST", { nombre }));
      setToken(d.token);
      setNombre("");
      setAbierta(d.pasarela.id);
      await cargar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido crear");
    }
    setOcupado(false);
  };

  const TOKEN: Record<SituacionToken, string> = { vale: "caduca el", anulado: "anulado; caducaba el", caducado: "caducó el" };

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Pasarelas</h1>
          <p className="gx-sub">El programa que lee el PLC, vaya en un aparato de Gradiox o en un ordenador del cliente (se elige en la ficha técnica de cada instalación). Aquí se da de alta cada instalación, se le pone qué leer y se ve si está entregando.</p>
        </div>
      </header>

      <div className="gx-pila">
        {guardado === "memoria" && <SinBase />}
        {token && <Token token={token} alCerrar={() => setToken("")} />}

        <form className="gx-tarjeta gx-alta" onSubmit={alta}>
          <label className="gx-campo">
            Instalación nueva
            <input value={nombre} maxLength={80} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nombre de la instalación" autoComplete="off" />
          </label>
          <button type="submit" className="gx-boton" disabled={ocupado || !nombre.trim()}>
            <Plus size={18} strokeWidth={1.7} aria-hidden="true" /> Crear y sacar su token
          </button>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
        </form>

        <section className="gx-tarjeta">
          <h2>{lista === null ? "Instalaciones" : `Instalaciones · ${lista.length}`}</h2>
          {lista === null ? (
            <p className="gx-vacio">{fallo || "Leyendo las pasarelas…"}</p>
          ) : lista.length === 0 ? (
            <p className="gx-vacio">Todavía no hay ninguna. Escribe arriba el nombre de la instalación y pulsa «Crear y sacar su token»: ese token se pega en el programa y ya puede entregar lecturas.</p>
          ) : (
            <ul className="gx-pasarelas">
              {lista.map((p) => {
                const s = situacion(p, ahora);
                const esta = abierta === p.id;
                return (
                  <li key={p.id}>
                    <button type="button" className="cabeza" aria-expanded={esta} onClick={() => setAbierta(esta ? "" : p.id)}>
                      <span className="titulo">
                        {p.nombre}
                        <small>
                          Token …{p.pista}, {TOKEN[p.token]} {fecha(p.caduca)} · {p.variables} {p.variables === 1 ? "variable" : "variables"}
                          {p.contacto ? ` · último contacto: ${hace(p.contacto.t, ahora)}` : ""}
                        </small>
                      </span>
                      <span className={`gx-chip ${s.tono}`}>{s.texto}</span>
                      <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" className="giro" />
                    </button>
                    {esta && <Detalle id={p.id} alCambiar={() => void cargar()} alToken={setToken} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
