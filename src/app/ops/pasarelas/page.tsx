"use client";

import { Ban, Check, ChevronDown, Copy, KeyRound, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AreaTexto } from "@/components/area-texto";
import { SinBase } from "@/components/sin-base";
import { conJson, pedir } from "@/clientes/navegador";
import type { UltimaLectura } from "@/pasarelas/almacen";
import type { Pasarela, ResumenPasarela, SituacionToken } from "@/pasarelas/modelo";

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

function Detalle({ id, alCambiar, alToken }: { id: string; alCambiar: () => void; alToken: (t: string) => void }) {
  const [d, setD] = useState<{ ahora: number; pasarela: Pasarela; lecturas: UltimaLectura[] } | null>(null);
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
      const r = await pedir<{ ahora: number; pasarela: Pasarela; lecturas: UltimaLectura[] }>(`/api/ops/pasarelas/${id}`);
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
  const filas = p.variables.filter((v) => !q || `${v.n} ${v.g ?? ""} ${v.d ?? ""}`.toLowerCase().includes(q));
  const conValor = p.variables.filter((v) => porNombre.get(v.n)?.x !== null && porNombre.get(v.n) !== undefined).length;

  return (
    <div className="gx-pasarela-cuerpo">
      <div className="gx-cifras sueltas tres">
        <div><span>Programa</span><strong>{c ? `${c.programa}` : "—"} <small>{c ? PLATAFORMAS[c.plataforma] ?? c.plataforma : "sin estrenar"}</small></strong></div>
        <div><span>Último contacto</span><strong>{c ? hace(c.t, d.ahora) : "—"}</strong></div>
        <div><span>Variables con valor</span><strong>{c ? c.estado.leidas : conValor} <small>de {p.variables.length}</small></strong></div>
      </div>
      {c && c.estado.plc !== "conectado" && <p className="gx-nota" role="status">El programa no llega al PLC: {c.estado.detalle || "sin detalle"}</p>}
      {c?.estado.simulado && <p className="gx-nota">Está leyendo el PLC simulado: los valores son inventados.</p>}

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

      {p.variables.length > 0 && (
        <>
          <div className="gx-lista-cabeza">
            <h3 className="gx-subtitulo">Última lectura de cada variable</h3>
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
          <p className="gx-sub">El programa que se deja en un ordenador de la planta para leer el PLC. Aquí se da de alta cada instalación, se le pone qué leer y se ve si está entregando.</p>
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
