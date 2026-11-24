"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Activity, Check, CloudOff, Ellipsis, History, LoaderCircle, PlugZap, Settings2, SlidersHorizontal, Zap } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { FASES, TONO_FASE, nombreNave } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { faltaTecnica } from "@/clientes/tecnica";
import { usarFicha } from "@/clientes/usar-ficha";
import { Ahorro } from "@/components/ops/ahorro";
import { DatosGuardados } from "@/components/ops/datos";
import { usarFotos } from "@/components/ops/ficha-piezas";
import { FichaTecnicaNave } from "@/components/ops/ficha-tecnica";
import { NaveVisita } from "@/components/ops/nave-visita";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { Detalle, Token, type ParteInstalacion } from "@/components/ops/pasarela";
import { DE_CHIP, Estado } from "@/components/ops/punto";
import { PantallaHistoricos } from "@/components/pantalla-historicos";
import { SinBase } from "@/components/sin-base";
import { PasoAlta } from "@/components/ops/paso-alta";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SelectorZona, verApartado } from "@/components/ops/selector-zona";
import { PESTANAS_NAVE, pestanaNave, type PestanaNave } from "@/clientes/pestanas";

const PESTANA = "h-10 flex-none gap-1.5 rounded-none px-2.5 text-[13px] after:!bottom-0 after:bg-primary focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none";
const CUENTA = "rounded bg-aviso-fondo px-1 text-xs font-medium text-aviso";
const CONTENIDO = "flex flex-col gap-4 data-[state=inactive]:hidden";

/**
 * Una nave de un cliente con todo lo suyo: lo que se apuntó en la visita, la ficha
 * técnica y, una vez conectada, la puesta en marcha, lecturas, órdenes, históricos y
 * ahorro. Antes esto estaba repartido entre la ficha del cliente y «Instalaciones».
 */
/** Lo que enseña cada pestaña de «En marcha» cuando la nave todavía no lee. */
const AUN_NO = [
  { id: "lecturas", Icono: Activity, titulo: "Aquí verás las lecturas", texto: "Cada variable del autómata con su último valor y cuándo llegó." },
  { id: "ordenes", Icono: SlidersHorizontal, titulo: "Aquí se darán las órdenes", texto: "Cambiar una consigna del autómata, con su mínimo y su máximo y la doble llave de seguridad." },
  { id: "historicos", Icono: History, titulo: "Aquí estará todo lo guardado", texto: "Lo leído y lo ejecutado, por días, para ver qué ha cambiado." },
  { id: "ahorro", Icono: Zap, titulo: "Aquí se verá el ahorro", texto: "Qué consignas mover según el precio de la luz de cada hora." },
] as const;

export default function PaginaNave() {
  const { id, nave } = useParams<{ id: string; nave: string }>();
  const ficha = usarFicha(id);
  const { c, base, fallo, estado, enviar } = ficha;
  const fotosNave = usarFotos(id, c, ficha.setFotos);
  const { instalaciones: conectadas, ahora, recargar } = useNavegacion();
  const [pestana, setPestana] = useState<PestanaNave>("visita");
  const [elegida, setElegida] = useState("");
  const [token, setToken] = useState("");
  const [conectando, setConectando] = useState(false);
  const [falloConexion, setFalloConexion] = useState("");

  // La pestaña va en la dirección: así se puede mandar un enlace directo a «Órdenes» o volver con atrás.
  const pedida = pestanaNave(useSearchParams().get("pestana"));
  useEffect(() => {
    if (pedida) setPestana(pedida);
  }, [pedida]);
  // Una nave que ya lee se abre en sus lecturas, salvo que se pida otra pestaña. Solo la primera vez.
  const yaLee = (conectadas ?? []).some((p) => p.cliente === id && p.ubicacion === nave && !!p.contacto);
  const abierta = useRef(false);
  useEffect(() => {
    if (abierta.current || conectadas === null) return;
    abierta.current = true;
    if (!pedida && yaLee) setPestana("lecturas");
  }, [conectadas, pedida, yaLee]);
  const ir = (p: PestanaNave) => {
    setPestana(p);
    const url = new URL(window.location.href);
    url.searchParams.set("pestana", p);
    window.history.replaceState(null, "", url);
    verApartado("gx-pestanas-nave");
  };

  if (!c) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-muted-foreground" role={fallo ? "alert" : undefined}>{fallo || "Abriendo la nave…"}</p>
        {fallo && <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/ops">Ver los clientes</Link></Button>}
      </div>
    );
  }

  const inst = c.instalaciones.find((i) => i.id === nave);
  if (!inst) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-muted-foreground">Esta nave ya no está en la ficha de {c.nombre || "este cliente"}: se habrá quitado o cambiado.</p>
        <Button asChild variant="outline" size="sm" className="w-fit"><Link href={`/ops/clientes/${id}?paso=instalaciones`}>Ver sus naves</Link></Button>
      </div>
    );
  }

  const suyas = (conectadas ?? []).filter((p) => p.cliente === id && p.ubicacion === nave);
  const pasarela = suyas.find((p) => p.id === elegida) ?? suyas[0];
  const conexion = pasarela ? estadoInstalacion(pasarela, ahora) : null;
  const faltan = faltaTecnica(inst).length;
  const nombre = nombreNave(inst, c.instalaciones.indexOf(inst));
  const visibles = PESTANAS_NAVE.filter((t) => !t.conectada || pasarela);
  const pestanaVista: PestanaNave = visibles.some((t) => t.id === pestana) ? pestana : "visita";
  const tramo = (x: "preparar" | "marcha") => visibles.filter((t) => t.tramo === x);
  // El botón del paso que toca lleva aquí mismo si el paso es de esta nave; si es de otra parte, navega.
  const alPaso = (donde: string) => {
    const u = new URL(donde, window.location.origin);
    if (u.pathname !== `/ops/clientes/${id}/naves/${nave}`) return false;
    ir(pestanaNave(u.searchParams.get("pestana")) ?? "visita");
    return true;
  };

  // Conectar = crear la instalación de la pasarela, dejarla de este cliente y en esta nave, en un solo paso.
  const conectar = async () => {
    setConectando(true);
    setFalloConexion("");
    try {
      const d = await pedir<{ pasarela: { id: string }; token: string }>("/api/ops/pasarelas", conJson("POST", { nombre: nombre.slice(0, 80) }));
      const app = `/api/ops/clientes/${id}/app`;
      await pedir(app, conJson("POST", { accion: "instalacion", pasarela: d.pasarela.id, suya: true }));
      await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: d.pasarela.id, ubicacion: nave }));
      setElegida(d.pasarela.id);
      setToken(d.token);
      recargar();
    } catch (e) {
      setFalloConexion(e instanceof Error ? e.message : "No se ha podido crear la conexión");
    }
    setConectando(false);
  };
  // Conexiones que ya existen y no están en ninguna nave de este cliente: se pueden traer aquí en vez de crear otra.
  const libres = (conectadas ?? []).filter((p) => (p.cliente === id && !c.instalaciones.some((i) => i.id === p.ubicacion)) || !p.cliente);
  const usar = async (pid: string, deEste: boolean) => {
    setConectando(true);
    setFalloConexion("");
    try {
      const app = `/api/ops/clientes/${id}/app`;
      if (!deEste) await pedir(app, conJson("POST", { accion: "instalacion", pasarela: pid, suya: true }));
      await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: pid, ubicacion: nave }));
      setElegida(pid);
      recargar();
    } catch (e) {
      setFalloConexion(e instanceof Error ? e.message : "No se ha podido usar esa conexión");
    }
    setConectando(false);
  };
  const alCambiar = (accion?: string) => {
    recargar();
    if (accion === "borrar") ir("conexion");
  };
  const irDesdePasarela = (p: ParteInstalacion) => ir(p === "puesta" ? "conexion" : p);

  return (
    <div className="flex flex-col gap-4">
      <SelectorZona
        etiqueta="Dónde estás"
        volver={{ href: `/ops/clientes/${id}`, texto: c.nombre || "Cliente" }}
        valor={pestanaVista}
        alElegir={(v) => ir(v as PestanaNave)}
        grupos={[
          { nombre: `${nombre} · Preparar`, opciones: tramo("preparar").map((t) => ({ valor: t.id, texto: t.id === "tecnica" && faltan > 0 ? `${t.texto} (faltan ${faltan})` : t.texto, pestana: true as const })) },
          { nombre: `${nombre} · En marcha`, opciones: tramo("marcha").map((t) => ({ valor: t.id, texto: t.texto, pestana: true as const })) },
          { nombre: `${nombre} · Más`, opciones: visibles.filter((t) => t.tramo === "mas").map((t) => ({ valor: t.id, texto: t.texto, pestana: true as const })) },
          {
            nombre: c.nombre || "Cliente",
            opciones: [
              { valor: "ir-cliente", texto: "Ficha del cliente", href: `/ops/clientes/${id}` },
              ...c.instalaciones.filter((i) => i.id !== nave).map((i) => ({ valor: `ir-${i.id}`, texto: nombreNave(i, c.instalaciones.indexOf(i)), href: `/ops/clientes/${id}/naves/${i.id}` })),
            ],
          },
        ]}
      />

      <Breadcrumb className="max-md:hidden">
        <BreadcrumbList className="text-[13px]">
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/ops">Clientes</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0"><BreadcrumbLink asChild><Link href={`/ops/clientes/${id}`} className="truncate">{c.nombre || "Cliente"}</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{nombre}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight break-words">{nombre}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <Estado tono={DE_CHIP[TONO_FASE[inst.fase]] ?? "neutro"} texto={FASES[inst.fase]} />
            <span>{inst.puntos.length === 1 ? "1 cámara" : `${inst.puntos.length} cámaras`}</span>
            <span>{conexion ? <>Conexión: {conexion.texto.toLowerCase()}</> : "Sin conectar"}</span>
            <span className={`gx-guardado ${estado}`} role="status">
              {estado === "guardado" && <><Check size={15} aria-hidden="true" /> Guardado</>}
              {estado === "pendiente" && "Cambios sin guardar…"}
              {estado === "guardando" && <><LoaderCircle size={15} aria-hidden="true" className="gx-gira" /> Guardando…</>}
              {estado === "fallo" && <><CloudOff size={15} aria-hidden="true" /> No se ha guardado. <Button type="button" variant="link" size="sm" className="h-auto px-0 text-acento-texto" onClick={() => void enviar()}>Reintentar</Button></>}
            </span>
          </div>
        </div>
        <PasoAlta cliente={id} guardado={estado} cambio={`${suyas.length}-${conexion?.texto ?? ""}`} alIr={alPaso} />
      </header>

      {!base && <SinBase />}
      {token && <Token token={token} alCerrar={() => setToken("")} />}
      {fotosNave.falloFoto && <p className="text-[13px] text-mal" role="alert">{fotosNave.falloFoto}</p>}

      <Tabs value={pestanaVista} onValueChange={(v) => ir(v as PestanaNave)} className="gap-4">
        <div id="gx-pestanas-nave" className="sticky top-0 z-[5] -mx-1 overflow-x-auto border-b bg-background px-1 max-md:hidden">
          <div className="flex w-max items-center">
            <TabsList variant="line" aria-label="Partes de la nave" className="h-10 w-max justify-start gap-0 p-0">
              {(["preparar", "marcha"] as const).map((x) =>
                tramo(x).length > 0 && (
                  <Fragment key={x}>
                    {/* Los dos tramos de la nave: lo de antes de leer y lo de cuando ya lee. */}
                    <span className={`flex h-10 items-center pr-1 text-xs font-medium text-muted-foreground ${x === "marcha" ? "ml-2 border-l pl-3" : "pl-1"}`} aria-hidden="true">{x === "preparar" ? "Preparar" : "En marcha"}</span>
                    {tramo(x).map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className={PESTANA}>
                        {t.texto}
                        {t.id === "tecnica" && faltan > 0 && <span className={CUENTA} aria-label={`Faltan ${faltan} datos`}>{faltan}</span>}
                      </TabsTrigger>
                    ))}
                  </Fragment>
                ),
              )}
            </TabsList>
            {pasarela && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="ml-1" aria-label="Más de esta nave"><Ellipsis aria-hidden="true" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => ir("ajustes")}><Settings2 aria-hidden="true" />Ajustes de la conexión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {suyas.length > 1 && pestanaVista !== "visita" && pestanaVista !== "tecnica" && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]" role="group" aria-label="Conexiones de esta nave">
            <span className="text-muted-foreground">Esta nave tiene {suyas.length} conexiones:</span>
            {suyas.map((p) => (
              <Button key={p.id} size="sm" variant={p.id === pasarela?.id ? "secondary" : "ghost"} aria-pressed={p.id === pasarela?.id} onClick={() => setElegida(p.id)}>{p.nombre}</Button>
            ))}
          </div>
        )}

        <TabsContent value="visita" className={CONTENIDO}><NaveVisita ficha={ficha} inst={inst} fotosNave={fotosNave} /></TabsContent>
        <TabsContent value="tecnica" className={CONTENIDO}><FichaTecnicaNave id={id} ficha={ficha} inst={inst} /></TabsContent>
        <TabsContent value="conexion" className={CONTENIDO}>
          {pasarela ? (
            <Detalle key={pasarela.id} id={pasarela.id} parte="puesta" alCambiar={alCambiar} alToken={setToken} irA={irDesdePasarela} />
          ) : (
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-[13px]">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><PlugZap className="size-4" strokeWidth={1.6} aria-hidden="true" />Conectar {nombre}</h2>
              <p className="max-w-[68ch]">Se crea la conexión de esta nave y sale un token. Ese token se pega en el programa de Gradiox de la planta (en su ordenador o en el aparato) y desde ese momento entrega lecturas aquí. Queda ya como de {c.nombre || "este cliente"} y en esta nave: no hay que asignarla después.</p>
              {faltan > 0 && <p className="max-w-[68ch] text-muted-foreground">A la ficha técnica le faltan {faltan === 1 ? "1 dato" : `${faltan} datos`}. Se puede conectar igual, pero conviene tenerla completa para saber por dónde y con qué permiso entra Gradiox.</p>}
              <Button size="sm" className="w-fit" onClick={() => void conectar()} disabled={conectando}>
                {conectando ? <LoaderCircle className="gx-gira" aria-hidden="true" /> : <PlugZap aria-hidden="true" />} Conectar y sacar el token
              </Button>
              {libres.length > 0 && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <p className="m-0 text-muted-foreground">¿Ya está conectada con otro nombre? Usa esa conexión y quedará en esta nave, con todo lo que ya ha leído:</p>
                  <div className="flex flex-wrap gap-2">
                    {libres.map((p) => (
                      <Button key={p.id} size="sm" variant="outline" disabled={conectando} onClick={() => void usar(p.id, p.cliente === id)}>
                        Usar «{p.nombre}»{p.cliente ? "" : " (sin cliente)"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {falloConexion && <p role="alert" className="text-mal">{falloConexion}</p>}
            </section>
          )}
        </TabsContent>
        {pasarela && (
          <>
            <TabsContent value="lecturas" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="lecturas" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
            <TabsContent value="ordenes" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="ordenes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
            <TabsContent value="historicos" className={CONTENIDO}>
              <PantallaHistoricos key={pasarela.id} api="/api/ops/historicos" conDemo={false} fija={pasarela.id} />
              {/* Lo que se guarda y cuánto tiempo, debajo de lo guardado: antes era una pestaña aparte. */}
              <DatosGuardados key={`datos-${pasarela.id}`} id={pasarela.id} irAHistoricos={() => verApartado("gx-pestanas-nave")} />
            </TabsContent>
            <TabsContent value="ahorro" className={CONTENIDO}><Ahorro key={pasarela.id} id={pasarela.id} irAOrdenes={() => ir("ordenes")} /></TabsContent>
            <TabsContent value="ajustes" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="ajustes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
          </>
        )}
        {!pasarela &&
          AUN_NO.map((x) => (
            <TabsContent key={x.id} value={x.id} className={CONTENIDO}>
              {/* Sin conexión, la pestaña está igual: dice qué se verá aquí y el paso que falta. */}
              <Empty className="rounded-lg border border-dashed bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><x.Icono aria-hidden="true" /></EmptyMedia>
                  <EmptyTitle>{x.titulo}</EmptyTitle>
                  <EmptyDescription>{x.texto} Para eso, {nombre} tiene que estar conectada con el programa de Gradiox de la planta.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" onClick={() => ir("conexion")}><PlugZap aria-hidden="true" />Conectar la nave</Button>
                </EmptyContent>
              </Empty>
            </TabsContent>
          ))}
      </Tabs>
      {fotosNave.visorFotos}
    </div>
  );
}
