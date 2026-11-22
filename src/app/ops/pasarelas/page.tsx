"use client";

import { Ban, Check, ChevronDown, Clock, Copy, KeyRound, ListChecks, Plus, Power, PowerOff, Save, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AreaTexto } from "@/components/area-texto";
import { SinBase } from "@/components/sin-base";
import { conJson, pedir } from "@/clientes/navegador";
import type { UltimaLectura } from "@/pasarelas/almacen";
import type { Pasarela, ResumenPasarela, SituacionToken } from "@/pasarelas/modelo";
import type { Escribible, EstadoOrden, Orden } from "@/pasarelas/ordenes";
import type { EstadoPrueba, Prueba } from "@/pasarelas/pruebas";

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
function PruebaProgramada({ p, variables, info, lecturas, ahora, orden, ocupado }: { p: Pasarela; variables: Escribible[]; info: Map<string, Pasarela["variables"][number]>; lecturas: Map<string, UltimaLectura>; ahora: number; orden: (cuerpo: Record<string, unknown>, hecho: string) => Promise<void>; ocupado: boolean }) {
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

/** Órdenes al PLC: qué se puede cambiar, dar una orden con confirmación y ver cómo han ido. */
function Ordenes({ p, lecturas, historial, ahora, orden, ocupado }: { p: Pasarela; lecturas: Map<string, UltimaLectura>; historial: Orden[]; ahora: number; orden: (cuerpo: Record<string, unknown>, hecho: string) => Promise<void>; ocupado: boolean }) {
  const e = p.escritura;
  const [lista, setLista] = useState(() => textoEscribibles(e?.variables ?? []));
  const [editar, setEditar] = useState(!e?.variables.length);
  const [elegida, setElegida] = useState("");
  const [nuevo, setNuevo] = useState("");
  const variables = e?.variables ?? [];
  const actual = variables.find((v) => v.n === elegida) ?? variables[0];
  const info = new Map(p.variables.map((v) => [v.n, v]));
  const programa = p.contacto?.estado.ordenes;

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
    <section className="gx-ordenes" aria-labelledby={`ordenes-${p.id}`}>
      <div className="gx-lista-cabeza">
        <h3 className="gx-subtitulo" id={`ordenes-${p.id}`}>Órdenes al PLC</h3>
        <span className={`gx-chip ${e?.activa ? (programa ? "correcto" : "aviso") : "neutro"}`}>{e?.activa ? (programa ? "Activadas" : "Activadas aquí, falta en el programa") : "Apagadas"}</span>
      </div>
      <p className="gx-nota">
        Solo se pueden cambiar las variables de esta lista y dentro de sus límites. Hacen falta dos llaves: activarlas aquí y marcar «Permitir órdenes» en el programa, en la planta. Cada orden se confirma y queda apuntada.
      </p>
      {editar ? (
        <div className="gx-formulario">
          <label className="gx-campo ancho">
            Variables que se pueden cambiar
            <AreaTexto value={lista} onChange={(ev) => setLista(ev.target.value)} rows={4} spellCheck={false} placeholder={"Una por línea: variable; mínimo; máximo, o variable; sí/no\nDatos_C6_1_REAL.P_consigna_ac; -25; 5"} />
          </label>
          <div className="gx-fila ancho">
            <button type="button" className="gx-boton" disabled={ocupado} onClick={() => void orden({ accion: "escritura", texto: lista }, "Lista guardada.").then(() => setEditar(false))}>
              <Save size={18} strokeWidth={1.7} aria-hidden="true" /> Guardar la lista
            </button>
            {variables.length > 0 && <button type="button" className="gx-boton-enlace" onClick={() => setEditar(false)}>Cancelar</button>}
          </div>
        </div>
      ) : (
        <div className="gx-fila">
          <span className="gx-nota">{variables.length} {variables.length === 1 ? "variable" : "variables"} que se pueden cambiar.</span>
          <button type="button" className="gx-boton-enlace" onClick={() => { setLista(textoEscribibles(variables)); setEditar(true); }}>Cambiar la lista</button>
          <span className="gx-pasarela-ordenes">
            {e?.activa ? (
              <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => window.confirm("Se dejan de dar órdenes y se anula lo pendiente. ¿Apagar?") && void orden({ accion: "escritura", activa: false }, "Órdenes apagadas.")}>
                <PowerOff size={17} strokeWidth={1.6} aria-hidden="true" /> Apagar las órdenes
              </button>
            ) : (
              <button type="button" className="gx-boton secundario" disabled={ocupado || !variables.length} onClick={() => window.confirm("Gradiox podrá cambiar estas variables en el PLC cuando alguien dé una orden aquí. ¿Activar?") && void orden({ accion: "escritura", activa: true }, "Órdenes activadas.")}>
                <Power size={17} strokeWidth={1.6} aria-hidden="true" /> Activar las órdenes
              </button>
            )}
          </span>
        </div>
      )}

      {e?.activa && actual && (
        <form className="gx-formulario" onSubmit={dar}>
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
            {!programa && <span className="gx-nota">El programa todavía no acepta órdenes: caducará a los 2 minutos si nadie las permite allí.</span>}
          </div>
        </form>
      )}

      {e?.activa && variables.length > 0 && <PruebaProgramada p={p} variables={variables} info={info} lecturas={lecturas} ahora={ahora} orden={orden} ocupado={ocupado} />}

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
                return (
                  <tr key={o.id}>
                    <td><code>{o.n}</code>{info.get(o.n)?.d && <small>{info.get(o.n)?.d}</small>}</td>
                    <td>{verValor(o.antes, u)}</td>
                    <td>{verValor(o.valor, u)}</td>
                    <td>{verValor(o.leido, u)}</td>
                    <td>
                      <span className={`gx-chip ${s.tono}`}>{s.texto}{o.simulada ? " (simulado)" : ""}</span>
                      {o.motivo && o.estado !== "hecha" && <small>{o.motivo}</small>}
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

function Detalle({ id, alCambiar, alToken }: { id: string; alCambiar: () => void; alToken: (t: string) => void }) {
  const [d, setD] = useState<{ ahora: number; pasarela: Pasarela; lecturas: UltimaLectura[]; ordenes: Orden[] } | null>(null);
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
      const r = await pedir<{ ahora: number; pasarela: Pasarela; lecturas: UltimaLectura[]; ordenes: Orden[] }>(`/api/ops/pasarelas/${id}`);
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
    const reloj = window.setInterval(() => void cargar(false), 10_000);
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

  return (
    <div className="gx-pasarela-cuerpo">
      <div className="gx-cifras sueltas tres">
        <div><span>Programa</span><strong>{c ? `${c.programa}` : "—"} <small>{c ? PLATAFORMAS[c.plataforma] ?? c.plataforma : "sin estrenar"}</small></strong></div>
        <div><span>Último contacto</span><strong>{c ? hace(c.t, d.ahora) : "—"}</strong></div>
        <div><span>Variables con valor</span><strong>{c ? c.estado.leidas : conValor} <small>de {c ? c.estado.total : lista.length}</small></strong></div>
      </div>
      {c && c.estado.plc !== "conectado" && <p className="gx-nota" role="status">El programa no llega al PLC: {c.estado.detalle || "sin detalle"}</p>}
      {c?.estado.simulado && <p className="gx-nota">Está leyendo el PLC simulado: los valores son inventados.</p>}

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
            <button type="button" className="gx-boton-enlace" disabled={ocupado} onClick={() => window.confirm(p.variables.length ? "El programa volverá a leer la lista de la instalación. ¿Descartar la que propone?" : "¿Descartar la lista que propone el programa?") && void orden({ accion: "descartar-propuesta" }, "Descartada.")}>
              Descartarla
            </button>
          </div>
        </div>
      )}

      <form className="gx-formulario" onSubmit={guardar}>
        <label className="gx-campo">
          Dirección del PLC
          <input value={plc} onChange={(ev) => setPlc(ev.target.value)} placeholder="50.50.0.1" autoComplete="off" spellCheck={false} />
        </label>
        <label className="gx-campo">
          Leer cada (segundos)
          <input value={cada} onChange={(ev) => setCada(ev.target.value)} placeholder="10" inputMode="numeric" autoComplete="off" />
        </label>
        <label className="gx-campo ancho">
          Nombre del perfil de variables
          <input value={perfil} onChange={(ev) => setPerfil(ev.target.value)} placeholder="Primeras variables" maxLength={80} autoComplete="off" />
        </label>
        <label className="gx-campo ancho">
          {p.variables.length ? `Cambiar la lista de variables (ahora hay ${p.variables.length})` : "Lista de variables"}
          <AreaTexto value={pegado} onChange={(ev) => setPegado(ev.target.value)} rows={3} placeholder="Pega aquí las filas de la hoja de cálculo, con su fila de títulos: grupo, variable, tipo, qué es, unidad" spellCheck={false} />
        </label>
        <div className="gx-fila ancho">
          <button type="submit" className="gx-boton" disabled={ocupado}>
            <Save size={18} strokeWidth={1.7} aria-hidden="true" /> Guardar
          </button>
          <span className="gx-pasarela-ordenes">
            <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => window.confirm("El token actual dejará de valer y habrá que pegar el nuevo en el programa. ¿Seguir?") && void orden({ accion: "renovar" }, "Token nuevo creado.")}>
              <KeyRound size={17} strokeWidth={1.6} aria-hidden="true" /> Token nuevo
            </button>
            {!p.anulada && (
              <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => window.confirm("El programa dejará de poder entregar lecturas. ¿Anular el token?") && void orden({ accion: "anular" }, "Token anulado.")}>
                <Ban size={17} strokeWidth={1.6} aria-hidden="true" /> Anular el token
              </button>
            )}
            <button type="button" className="gx-boton peligro" disabled={ocupado} onClick={() => window.confirm("Se borran la instalación y todas sus lecturas. No se puede deshacer. ¿Borrar?") && void orden({ accion: "borrar" }, "")}>
              <Trash2 size={17} strokeWidth={1.6} aria-hidden="true" /> Borrar
            </button>
          </span>
        </div>
        {(fallo || aviso) && <p className="gx-nota ancho" role={fallo ? "alert" : "status"} style={fallo ? { color: "var(--gx-error)" } : undefined}>{fallo || aviso}</p>}
      </form>

      <Ordenes p={p} lecturas={porNombre} historial={d.ordenes} ahora={d.ahora} orden={orden} ocupado={ocupado} />

      {lista.length > 0 && (
        <>
          <div className="gx-lista-cabeza">
            <h3 className="gx-subtitulo">{p.propuesta ? "Última lectura de cada variable de la lista propuesta" : "Última lectura de cada variable"}</h3>
            <label className="gx-campo gx-filtro">
              <span className="gx-solo-lector">Buscar variable</span>
              <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" />
            </label>
          </div>
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
        </>
      )}
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
