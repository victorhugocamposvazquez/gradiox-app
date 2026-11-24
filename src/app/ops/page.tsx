"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, CircleCheck, KeyRound, ListTodo, Plus, RadioTower, Search, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SinBase } from "@/components/sin-base";
import { ESTADOS, TONO, clienteVacio, instalacionVacia, type Cliente, type EstadoCliente, type ResumenCliente } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { estadoInstalacion, useNavegacion, type Tono } from "@/components/ops/navegacion";
import { DE_CHIP, Estado, Punto } from "@/components/ops/punto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

type RutaCorta = { id: string; hechos: number; total: number; siguiente: string | null; paso: number; mal: string[]; mirar: number };
type PideClave = { id: string; usuario: string; nombre: string; cliente: string; nombreCliente: string; cuando: number };
type TareaCorta = { numero: number; titulo: string; abierta: boolean };

/** Una cosa que pide atención, venga de donde venga: lo que pasa, de quién y qué hacer. */
type Pendiente = { clave: string; tono: Tono; icono: ReactNode; titulo: string; detalle: string; href: string; accion: string; orden: number };

/**
 * La portada del panel: arriba «Pendiente», una sola bandeja con todo lo que
 * pide hacer algo (avisos de clientes, conexiones calladas, contraseñas pedidas
 * y tareas abiertas), cada cosa con su acción. Debajo, los clientes.
 */
export default function Portada() {
  const ir = useRouter();
  const { instalaciones, clientes: deLaBarra, ahora } = useNavegacion();
  const [lista, setLista] = useState<ResumenCliente[] | null>(null);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<EstadoCliente | "todos">("todos");
  const [ocupado, setOcupado] = useState(false);
  const [todoPendiente, setTodoPendiente] = useState(false);
  const [rutas, setRutas] = useState<Record<string, RutaCorta>>({});
  const [claves, setClaves] = useState<PideClave[]>([]);
  const [tareas, setTareas] = useState<TareaCorta[]>([]);
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
    // Lo demás de la bandeja es opcional: si algo no llega, la portada sigue valiendo sin ello.
    pedir<{ rutas: RutaCorta[] }>("/api/ops/rutas")
      .then((d) => vivo && setRutas(Object.fromEntries(d.rutas.map((r) => [r.id, r]))))
      .catch(() => null);
    pedir<{ pendientes: PideClave[] }>("/api/ops/accesos")
      .then((d) => vivo && setClaves(d.pendientes))
      .catch(() => null);
    pedir<{ tareas?: TareaCorta[] }>("/api/ops/tareas")
      .then((d) => vivo && setTareas((d.tareas ?? []).filter((t) => t.abierta)))
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
  const vistos = todos.filter((c) => (filtro === "todos" || c.estado === filtro) && (!q || `${c.nombre} ${c.direccion} ${ESTADOS[c.estado]} ${c.proximo.texto}`.toLowerCase().includes(q)));
  const porEstado = (Object.keys(ESTADOS) as EstadoCliente[]).map((e) => ({ e, n: todos.filter((c) => c.estado === e).length })).filter((x) => x.n > 0);
  const nombreDe = new Map([...(deLaBarra ?? []), ...todos].map((c) => [c.id, c.nombre]));

  // La bandeja: lo que falla primero, luego lo que hay que mirar y al final las tareas.
  const pendiente: Pendiente[] = [
    ...todos.flatMap((c) =>
      c.avisos.map((a) => ({ clave: `aviso-${c.id}-${a.texto}`, tono: (a.nivel === "mal" ? "mal" : "aviso") as Tono, icono: <TriangleAlert />, titulo: c.nombre, detalle: a.texto, href: `/ops/clientes/${c.id}`, accion: "Abrir", orden: a.nivel === "mal" ? 0 : 2 })),
    ),
    ...(instalaciones ?? []).flatMap((p) => {
      const e = estadoInstalacion(p, ahora);
      if (e.tono !== "aviso" && e.tono !== "mal") return [];
      const de = p.cliente ? nombreDe.get(p.cliente) : undefined;
      const que = e.texto === "Callada" ? "No entrega desde hace más de cinco minutos: mirar si el equipo tiene corriente y red." : e.texto === "Sin PLC" ? "Entrega, pero no llega al autómata: mirar el cable o la dirección del PLC." : "Hay que darle un token nuevo en sus ajustes.";
      return [{ clave: `conexion-${p.id}`, tono: e.tono, icono: <RadioTower />, titulo: `${p.nombre} · ${e.texto}`, detalle: `${de ?? "Sin cliente"}. ${que}`, href: `/ops/instalaciones/${p.id}`, accion: "Ver", orden: 1 }];
    }),
    ...claves.map((p) => ({ clave: `clave-${p.id}`, tono: "azul" as Tono, icono: <KeyRound />, titulo: `${p.nombre || p.usuario} pide contraseña nueva`, detalle: `${p.nombreCliente || "Cliente"} · usuario ${p.usuario} · lo pidió el ${fecha(p.cuando)}`, href: `/ops/clientes/${p.cliente}?paso=app`, accion: "Darle una", orden: 3 })),
    ...tareas.map((t) => ({ clave: `tarea-${t.numero}`, tono: "neutro" as Tono, icono: <ListTodo />, titulo: t.titulo, detalle: `Tarea abierta nº ${t.numero}`, href: "/ops/tareas", accion: "Ver", orden: 4 })),
  ].sort((a, b) => a.orden - b.orden);
  const pendienteVisto = todoPendiente ? pendiente : pendiente.slice(0, 6);
  const cargando = lista === null && !fallo;

  // Una sola línea dice por dónde va: lo que falla, el paso del alta que toca o su recordatorio.
  const porDonde = (c: ResumenCliente) => {
    const r = rutas[c.id];
    if (r?.mal[0]) return { texto: r.mal[0], mal: true };
    // Lo mismo que dice el botón grande del cliente: una sola guía.
    if (r?.siguiente) return { texto: `Paso ${r.paso} de ${r.total}: ${minuscula(r.siguiente)}`, mal: false };
    if (c.proximo.texto) return { texto: `Recordatorio: ${c.proximo.texto}${c.proximo.fecha ? ` (${dia(c.proximo.fecha)})` : ""}`, mal: false };
    return { texto: r ? "Alta completa" : "", mal: false };
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="m-0 text-xl font-semibold tracking-tight">Inicio</h1>
          <p className="m-0 max-w-[68ch] text-[13px] text-muted-foreground">Lo que pide hacer algo hoy y, debajo, cada cliente con por dónde va.</p>
        </div>
        {!abierto && (
          <Button size="sm" onClick={() => setCreando(true)}>
            <Plus aria-hidden="true" /> Cliente nuevo
          </Button>
        )}
      </header>

      {guardado === "memoria" && <SinBase />}

      {abierto && (
        <Card className="gap-3 py-3">
          <CardContent className="px-3">
            <form onSubmit={alta} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 text-[13px] font-medium" htmlFor="gx-cliente-nuevo">
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
              <p className="m-0 basis-full text-xs text-muted-foreground">Después, en su ficha, el alta lleva paso a paso: datos, visita, ficha técnica, conectar la nave y acceso a la app.</p>
              {fallo && <p role="alert" className="m-0 basis-full text-[13px] text-mal">{fallo}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden py-0" aria-labelledby="titulo-pendiente">
        <CardHeader className="border-b py-3">
          <CardTitle id="titulo-pendiente" className="text-sm">Pendiente{pendiente.length ? ` · ${pendiente.length}` : ""}</CardTitle>
          <CardDescription className="text-xs">Avisos de clientes, conexiones que no entregan, contraseñas pedidas y tareas.</CardDescription>
        </CardHeader>
        {cargando ? (
          <p className="m-0 px-4 py-3 text-[13px] text-muted-foreground">Mirando qué hay pendiente…</p>
        ) : pendiente.length === 0 ? (
          <Empty className="py-6 md:py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-bien-fondo text-bien"><CircleCheck /></EmptyMedia>
              <EmptyTitle className="text-sm">Nada pendiente</EmptyTitle>
              <EmptyDescription className="text-[13px]">Todo lo conectado entrega y ningún cliente espera nada. Si toca dar de alta a alguien, pulsa «Cliente nuevo».</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ItemGroup className="divide-y">
              {pendienteVisto.map((p) => (
                <Item key={p.clave} asChild size="sm" className="flex-nowrap rounded-none">
                  <Link href={p.href} role="listitem">
                    <ItemMedia variant="icon" className={MEDIA[p.tono]}>{p.icono}</ItemMedia>
                    <ItemContent className="min-w-0 gap-0.5">
                      <ItemTitle className="w-full min-w-0 text-[13px]"><span className="truncate">{p.titulo}</span></ItemTitle>
                      <ItemDescription className="text-xs">{p.detalle}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="hidden shrink-0 gap-1 text-xs text-muted-foreground sm:flex">{p.accion}</ItemActions>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                </Item>
              ))}
            </ItemGroup>
            {pendiente.length > 6 && (
              <Button variant="ghost" size="sm" className="h-9 w-full justify-start rounded-none border-t px-4 text-acento-texto" onClick={() => setTodoPendiente(!todoPendiente)}>
                {todoPendiente ? "Ver menos" : `Ver las ${pendiente.length}`}
              </Button>
            )}
          </>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden py-0" aria-labelledby="titulo-clientes">
        <CardHeader className="flex flex-wrap items-center gap-2 border-b py-3">
          <CardTitle id="titulo-clientes" className="text-sm">{lista === null ? "Clientes" : cuenta(todos.length, "cliente", "clientes")}</CardTitle>
          {todos.length > 5 && (
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <Select value={filtro} onValueChange={(v) => setFiltro(v as EstadoCliente | "todos")}>
                <SelectTrigger size="sm" aria-label="Ver solo un estado" className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {porEstado.map(({ e, n }) => <SelectItem key={e} value={e}>{ESTADOS[e]} · {n}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="relative flex min-w-0 flex-[1_1_160px] items-center sm:w-48 sm:flex-none">
                <Search className="pointer-events-none absolute left-2 size-4 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                <Input type="search" aria-label="Buscar cliente" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" className="h-8 pl-7" />
              </span>
            </div>
          )}
        </CardHeader>
        {lista === null ? (
          <p className="m-0 px-4 py-3 text-[13px] text-muted-foreground">{fallo || "Leyendo los clientes…"}</p>
        ) : sinClientes ? (
          <Empty className="py-6 md:py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
              <EmptyTitle className="text-sm">Todavía no hay clientes</EmptyTitle>
              <EmptyDescription className="text-[13px]">Escribe arriba el nombre de la empresa y pulsa «Dar de alta». Su ficha te irá diciendo qué toca en cada momento.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : vistos.length === 0 ? (
          <p className="m-0 px-4 py-3 text-[13px] text-muted-foreground">Ningún cliente coincide con lo que buscas.</p>
        ) : (
          <ItemGroup data-slot="lista-clientes" className="divide-y">
            {vistos.map((c) => {
              const d = porDonde(c);
              const conectadas = (instalaciones ?? []).filter((p) => p.cliente === c.id);
              const peor = conectadas.map((p) => estadoInstalacion(p, ahora)).sort((a, b) => peso(a.tono) - peso(b.tono))[0];
              return (
                <Item key={c.id} asChild size="sm" className="flex-nowrap rounded-none">
                  <Link href={`/ops/clientes/${c.id}`} role="listitem">
                    <ItemMedia className="size-8 rounded-md bg-acento-fondo text-[13px] font-semibold text-acento-texto" aria-hidden="true">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</ItemMedia>
                    <ItemContent className="min-w-0 gap-0.5">
                      <ItemTitle className="w-full min-w-0 text-[13px]"><span className="truncate">{c.nombre}</span></ItemTitle>
                      <span className={d.mal ? "text-xs text-mal" : "text-xs text-muted-foreground"}>{d.texto}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="sm:hidden">{ESTADOS[c.estado]} · </span>
                        {[c.direccion, cuenta(c.instalaciones, "nave", "naves"), cuenta(c.puntos, "cámara", "cámaras"), conectadas.length ? cuenta(conectadas.length, "conectada", "conectadas") : ""].filter(Boolean).join(" · ")}
                      </span>
                    </ItemContent>
                    <ItemActions className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <Estado tono={DE_CHIP[TONO[c.estado]] ?? "neutro"} texto={ESTADOS[c.estado]} />
                      {peor && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Punto tono={peor.tono} />{peor.texto}</span>}
                    </ItemActions>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </Card>
    </div>
  );
}

/** El color del icono de cada cosa pendiente, según lo urgente que es. */
const MEDIA: Record<Tono, string> = {
  mal: "border-transparent bg-mal-fondo text-mal",
  aviso: "border-transparent bg-aviso-fondo text-aviso",
  azul: "border-transparent bg-acento-fondo text-acento-texto",
  bien: "border-transparent bg-bien-fondo text-bien",
  neutro: "",
};

/** Para enseñar la conexión que peor está de cada cliente. */
const peso = (t: string) => ({ mal: 0, aviso: 1, azul: 2, neutro: 3, bien: 4 })[t] ?? 5;
