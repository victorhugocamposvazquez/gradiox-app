"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import { ESTADOS, FASES, TONO, TONO_FASE, clienteVacio, instalacionVacia, type Cliente, type EstadoCliente, type Fase, type ResumenCliente } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";

const cuando = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function Clientes() {
  const ir = useRouter();
  const [lista, setLista] = useState<ResumenCliente[] | null>(null);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<EstadoCliente | "">("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    pedir<{ guardado: "memoria" | "base"; clientes: ResumenCliente[] }>("/api/ops/clientes")
      .then((d) => {
        if (!vivo) return;
        setLista(d.clientes);
        setGuardado(d.guardado);
      })
      .catch((e: Error) => vivo && setFallo(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const alta = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ cliente: Cliente }>("/api/ops/clientes", conJson("POST", { ...clienteVacio(), nombre, instalaciones: [instalacionVacia()] }));
      ir.push(`/ops/clientes/${d.cliente.id}?nuevo=1`);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido dar de alta");
      setOcupado(false);
    }
  };

  const q = busca.trim().toLowerCase();
  const vistos = (lista ?? []).filter((c) => (!filtro || c.estado === filtro) && (!q || `${c.nombre} ${c.direccion} ${ESTADOS[c.estado]} ${c.proximo.texto}`.toLowerCase().includes(q)));
  const todos = lista ?? [];
  const pendientes = todos.flatMap((c) => c.avisos.map((a) => ({ ...a, cliente: c }))).sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "mal" ? -1 : 1));
  const fallan = pendientes.filter((a) => a.nivel === "mal").length;
  const fases = todos.flatMap((c) => c.fases);
  const leyendo = fases.filter((f) => f === "leyendo").length;
  const porEstado = (Object.keys(ESTADOS) as EstadoCliente[]).map((e) => ({ e, n: todos.filter((c) => c.estado === e).length })).filter((x) => x.n > 0);
  const porFase = (Object.keys(FASES) as Fase[]).map((f) => ({ f, n: fases.filter((x) => x === f).length })).filter((x) => x.n > 0);
  const primero = pendientes[0];
  const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Clientes</h1>
          <p className="gx-sub">Cada empresa con sus instalaciones, en qué fase está cada una, si su aparato lee y qué toca hacer ahora.</p>
        </div>
        <div className="gx-acciones-cabecera">
          <Link href="/ops/visita" className="gx-boton secundario">
            <ClipboardList size={18} strokeWidth={1.6} aria-hidden="true" /> Guía de visita
          </Link>
        </div>
      </header>

      <div className="gx-pila">
        {guardado === "memoria" && <SinBase />}

        {todos.length > 0 && (
          <>
            <div className="gx-patron">
              <section className="gx-tarjeta realce gx-foco" aria-label="Lo primero">
                <span className="gx-chip">{fallan ? `${fallan} ${fallan === 1 ? "cosa falla" : "cosas fallan"}` : pendientes.length ? `Nada falla · ${pendientes.length} por mirar` : "Todo en orden"}</span>
                <p className="titular">{primero ? primero.cliente.nombre : "Ningún cliente pide atención"}</p>
                <p className="detalle">{primero ? primero.texto : "No hay pasos atrasados, incidencias ni aparatos callados."}</p>
                {primero && <Link href={`/ops/clientes/${primero.cliente.id}`} className="gx-boton">Abrir la ficha</Link>}
              </section>
              <div className="gx-cifras sueltas tres">
                <div><span>Clientes</span><strong>{todos.length}</strong></div>
                <div><span>Instalaciones en marcha</span><strong>{leyendo} <small>de {fases.length}</small></strong></div>
                <div className={fallan ? "mal" : pendientes.length ? "mirar" : undefined}><span>Piden atención</span><strong>{pendientes.length}</strong></div>
              </div>
            </div>

            <div className="gx-dos igual">
              <section className="gx-tarjeta">
                <h2>Pide atención · {pendientes.length}</h2>
                {pendientes.length === 0 ? (
                  <p className="gx-vacio">Nada que mirar.</p>
                ) : (
                  <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
                    {pendientes.slice(0, 12).map((a) => (
                      <li key={`${a.cliente.id}-${a.texto}`}>
                        <span className={`gx-punto ${a.nivel}`} role="img" aria-label={a.nivel === "mal" ? "Falla" : "Por mirar"} />
                        <span>
                          <strong style={{ fontWeight: 500 }}>{a.cliente.nombre}</strong>
                          <small>{a.texto}</small>
                        </span>
                        <Link href={`/ops/clientes/${a.cliente.id}`} className="gx-volver" aria-label={`Abrir la ficha de ${a.cliente.nombre}`}>Ver</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {pendientes.length > 12 && <p className="gx-nota">Y {pendientes.length - 12} más.</p>}
              </section>
              <section className="gx-tarjeta">
                <h2>Cómo está todo</h2>
                <h3 className="gx-subtitulo">Clientes</h3>
                <p className="gx-recuento">{porEstado.map(({ e, n }) => <span key={e} className={`gx-chip ${TONO[e]}`}>{ESTADOS[e]} · {n}</span>)}</p>
                <h3 className="gx-subtitulo">Instalaciones</h3>
                {porFase.length ? <p className="gx-recuento">{porFase.map(({ f, n }) => <span key={f} className={`gx-chip ${TONO_FASE[f]}`}>{FASES[f]} · {n}</span>)}</p> : <p className="gx-vacio">Ningún cliente tiene instalaciones apuntadas todavía.</p>}
              </section>
            </div>
          </>
        )}

        <form className="gx-tarjeta gx-alta" onSubmit={alta}>
          <label className="gx-campo">
            Cliente nuevo
            <input value={nombre} maxLength={120} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nombre de la empresa" autoComplete="off" />
          </label>
          <button type="submit" className="gx-boton" disabled={ocupado || !nombre.trim()}>
            <Plus size={18} strokeWidth={1.7} aria-hidden="true" /> Dar de alta
          </button>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
        </form>

        <section className="gx-tarjeta">
          <div className="gx-lista-cabeza">
            <h2>{lista === null ? "Clientes" : `Clientes · ${lista.length}`}</h2>
            {lista && lista.length > 5 && (
              <div className="gx-filtros">
                <label className="gx-campo">
                  <span className="gx-solo-lector">Ver solo un estado</span>
                  <select value={filtro} onChange={(ev) => setFiltro(ev.target.value as EstadoCliente | "")}>
                    <option value="">Todos los estados</option>
                    {porEstado.map(({ e, n }) => <option key={e} value={e}>{ESTADOS[e]} · {n}</option>)}
                  </select>
                </label>
                <label className="gx-campo gx-filtro">
                  <span className="gx-solo-lector">Buscar cliente</span>
                  <Search size={15} aria-hidden="true" />
                  <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" />
                </label>
              </div>
            )}
          </div>
          {lista === null ? (
            <p className="gx-vacio">{fallo || "Leyendo los clientes…"}</p>
          ) : lista.length === 0 ? (
            <p className="gx-vacio">Todavía no hay ningún cliente. Escribe arriba el nombre de la empresa y pulsa «Dar de alta»: después podrás añadir sus datos, sus cámaras y las fotos de la visita.</p>
          ) : vistos.length === 0 ? (
            <p className="gx-vacio">Ningún cliente coincide con lo que buscas.</p>
          ) : (
            <ul className="gx-tareas gx-clientes">
              {vistos.map((c) => (
                <li key={c.id}>
                  <Link href={`/ops/clientes/${c.id}`}>
                    <span>
                      <strong>{c.nombre}</strong>
                      <small>
                        {[c.direccion, cuenta(c.instalaciones, "instalación", "instalaciones"), cuenta(c.puntos, "punto de frío", "puntos de frío"), cuenta(c.fotos, "foto", "fotos"), `cambiado el ${cuando(c.actualizado)}`].filter(Boolean).join(" · ")}
                      </small>
                      <small className="paso">{c.proximo.texto ? `Próximo paso: ${c.proximo.texto}${c.proximo.fecha ? ` (${dia(c.proximo.fecha)})` : ""}` : "Sin próximo paso"}</small>
                    </span>
                    <span className="chips">
                      {c.avisos.some((a) => a.nivel === "mal") && <span className="gx-punto mal" role="img" aria-label="Algo falla" />}
                      <span className={`gx-chip ${TONO[c.estado]}`}>{ESTADOS[c.estado]}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
