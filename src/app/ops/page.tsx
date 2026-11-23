"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import { PidenClave } from "@/components/piden-clave";
import { ESTADOS, TONO, clienteVacio, instalacionVacia, type Cliente, type EstadoCliente, type ResumenCliente } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { DE_CHIP, Estado, Punto } from "@/components/ops/punto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

type RutaCorta = { id: string; hechos: number; total: number; siguiente: string | null; mal: string[]; mirar: number };

/**
 * La portada del panel: lo que pide atención arriba y, debajo, los clientes con
 * una sola línea que dice por dónde va cada uno. La única acción es dar de alta.
 */
export default function Clientes() {
  const ir = useRouter();
  const { instalaciones, ahora } = useNavegacion();
  const [lista, setLista] = useState<ResumenCliente[] | null>(null);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<EstadoCliente | "">("");
  const [ocupado, setOcupado] = useState(false);
  const [todosAvisos, setTodosAvisos] = useState(false);
  const [rutas, setRutas] = useState<Record<string, RutaCorta>>({});
  const campo = useRef<HTMLInputElement>(null);

  // Desde el buscador («Dar de alta un cliente») se llega con el alta ya abierta.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nuevo")) setCreando(true);
  }, []);
  useEffect(() => {
    if (creando) campo.current?.focus();
  }, [creando]);

  useEffect(() => {
    let vivo = true;
    pedir<{ guardado: "memoria" | "base"; clientes: ResumenCliente[] }>("/api/ops/clientes")
      .then((d) => {
        if (!vivo) return;
        setLista(d.clientes);
        setGuardado(d.guardado);
      })
      .catch((e: Error) => vivo && setFallo(e.message));
    // Por dónde va el alta de cada uno; si no llega, la lista sigue valiendo sin esa línea.
    pedir<{ rutas: RutaCorta[] }>("/api/ops/rutas")
      .then((d) => vivo && setRutas(Object.fromEntries(d.rutas.map((r) => [r.id, r]))))
      .catch(() => null);
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

  const todos = lista ?? [];
  const sinClientes = lista !== null && todos.length === 0;
  const abierto = creando || sinClientes;
  const q = busca.trim().toLowerCase();
  const vistos = todos.filter((c) => (!filtro || c.estado === filtro) && (!q || `${c.nombre} ${c.direccion} ${ESTADOS[c.estado]} ${c.proximo.texto}`.toLowerCase().includes(q)));
  const pendientes = todos.flatMap((c) => c.avisos.map((a) => ({ ...a, cliente: c }))).sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "mal" ? -1 : 1));
  const avisosVistos = todosAvisos ? pendientes : pendientes.slice(0, 5);
  const porEstado = (Object.keys(ESTADOS) as EstadoCliente[]).map((e) => ({ e, n: todos.filter((c) => c.estado === e).length })).filter((x) => x.n > 0);

  // Una sola línea dice por dónde va: lo que falla, el paso del alta que toca o el próximo paso apuntado.
  const porDonde = (c: ResumenCliente) => {
    const r = rutas[c.id];
    if (r?.mal[0]) return { texto: r.mal[0], mal: true };
    if (r?.siguiente) return { texto: `Alta ${r.hechos} de ${r.total} · ahora toca ${minuscula(r.siguiente)}`, mal: false };
    if (c.proximo.texto) return { texto: `Próximo paso: ${c.proximo.texto}${c.proximo.fecha ? ` (${dia(c.proximo.fecha)})` : ""}`, mal: false };
    return { texto: r ? "Alta completa · sin próximo paso apuntado" : "Sin próximo paso apuntado", mal: false };
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="max-w-[68ch] text-[13px] text-muted-foreground">Cada empresa con sus instalaciones. Arriba, lo que pide atención; en cada cliente, por dónde va.</p>
        </div>
        {!abierto && (
          <Button size="sm" onClick={() => setCreando(true)}>
            <Plus aria-hidden="true" /> Cliente nuevo
          </Button>
        )}
      </header>

      {guardado === "memoria" && <SinBase />}

      {abierto && (
        <form onSubmit={alta} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
          <label className="flex min-w-0 flex-[1_1_260px] flex-col gap-1 text-[13px] font-medium" htmlFor="gx-cliente-nuevo">
            Cliente nuevo
            <Input ref={campo} id="gx-cliente-nuevo" value={nombre} maxLength={120} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nombre de la empresa" autoComplete="off" className="h-8 font-normal" />
          </label>
          <Button type="submit" size="sm" disabled={ocupado || !nombre.trim()}>
            <Plus aria-hidden="true" /> Dar de alta
          </Button>
          {!sinClientes && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreando(false)}>
              <X aria-hidden="true" /> Cancelar
            </Button>
          )}
          <p className="basis-full text-xs text-muted-foreground">Después, en su ficha, la hoja de ruta lleva paso a paso: datos, visita, ficha técnica, pasarela y acceso a la app.</p>
          {fallo && <p role="alert" className="basis-full text-[13px] text-mal">{fallo}</p>}
        </form>
      )}

      <PidenClave />

      {pendientes.length > 0 && (
        <section aria-labelledby="titulo-atencion" className="overflow-hidden rounded-lg border bg-card">
          <h2 id="titulo-atencion" className="border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">Pide atención · {pendientes.length}</h2>
          <ul data-slot="lista" className="divide-y">
            {avisosVistos.map((a) => (
              <li key={`${a.cliente.id}-${a.texto}`}>
                <Link href={`/ops/clientes/${a.cliente.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                  <Punto tono={a.nivel === "mal" ? "mal" : "aviso"} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">{a.cliente.nombre}</span>
                    <span className="text-xs text-muted-foreground">{a.texto}</span>
                  </span>
                  <span className="sr-only">{a.nivel === "mal" ? "Falla" : "Por mirar"}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {pendientes.length > 5 && (
            <button type="button" data-slot="ver-mas" onClick={() => setTodosAvisos(!todosAvisos)} className="w-full border-t px-4 py-2 text-left text-[13px] text-acento-texto hover:bg-accent/60">
              {todosAvisos ? "Ver menos" : `Ver los ${pendientes.length}`}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-clientes" className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <h2 id="titulo-clientes" className="mr-auto text-[13px] font-medium text-muted-foreground">{lista === null ? "Clientes" : cuenta(todos.length, "cliente", "clientes")}</h2>
          {todos.length > 5 && (
            <>
              <label className="sr-only" htmlFor="gx-filtro-estado">Ver solo un estado</label>
              <select id="gx-filtro-estado" data-slot="filtro" value={filtro} onChange={(ev) => setFiltro(ev.target.value as EstadoCliente | "")} className="h-8 rounded-md border border-input bg-card px-2 text-[13px]">
                <option value="">Todos los estados</option>
                {porEstado.map(({ e, n }) => <option key={e} value={e}>{ESTADOS[e]} · {n}</option>)}
              </select>
              <span className="relative flex min-w-0 flex-[0_1_200px] items-center">
                <Search className="pointer-events-none absolute left-2 size-4 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                <Input type="search" aria-label="Buscar cliente" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" className="h-8 pl-7" />
              </span>
            </>
          )}
        </div>
        {lista === null ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">{fallo || "Leyendo los clientes…"}</p>
        ) : sinClientes ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">Todavía no hay ningún cliente. Escribe arriba el nombre de la empresa y pulsa «Dar de alta»: su ficha te irá diciendo qué toca en cada momento.</p>
        ) : vistos.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">Ningún cliente coincide con lo que buscas.</p>
        ) : (
          <ul data-slot="lista-clientes" className="divide-y">
            {vistos.map((c) => {
              const d = porDonde(c);
              const conectadas = (instalaciones ?? []).filter((p) => p.cliente === c.id);
              const peor = conectadas.map((p) => estadoInstalacion(p, ahora)).sort((a, b) => peso(a.tono) - peso(b.tono))[0];
              return (
                <li key={c.id}>
                  <Link href={`/ops/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-acento-fondo text-[13px] font-semibold text-acento-texto" aria-hidden="true">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{c.nombre}</span>
                      <span className={d.mal ? "text-xs text-mal" : "text-xs text-muted-foreground"}>{d.texto}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="sm:hidden">{ESTADOS[c.estado]} · </span>
                        {[c.direccion, cuenta(c.instalaciones, "instalación", "instalaciones"), cuenta(c.puntos, "cámara", "cámaras"), conectadas.length ? cuenta(conectadas.length, "conectada", "conectadas") : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <Estado tono={DE_CHIP[TONO[c.estado]] ?? "neutro"} texto={ESTADOS[c.estado]} />
                      {peor && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Punto tono={peor.tono} />{peor.texto}</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Para enseñar la instalación que peor está de cada cliente. */
const peso = (t: string) => ({ mal: 0, aviso: 1, azul: 2, neutro: 3, bien: 4 })[t] ?? 5;
