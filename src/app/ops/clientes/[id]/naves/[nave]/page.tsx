"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowRight, Check, CloudOff, LoaderCircle, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { FASES, TONO_FASE } from "@/clientes/modelo";
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
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PESTANAS_NAVE, pestanaNave, type PestanaNave } from "@/clientes/pestanas";

const PESTANA = "h-10 flex-none gap-1.5 rounded-none px-2.5 text-[13px] after:!bottom-0 after:bg-primary focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none";
const CUENTA = "rounded bg-aviso-fondo px-1 text-xs font-medium text-aviso";
const CONTENIDO = "flex flex-col gap-4 data-[state=inactive]:hidden";

/**
 * Una nave de un cliente con todo lo suyo: lo que se apuntó en la visita, la ficha
 * técnica y, una vez conectada, la puesta en marcha, lecturas, órdenes, históricos y
 * ahorro. Antes esto estaba repartido entre la ficha del cliente y «Instalaciones».
 */
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
  const ir = (p: PestanaNave) => {
    setPestana(p);
    const url = new URL(window.location.href);
    url.searchParams.set("pestana", p);
    window.history.replaceState(null, "", url);
    document.getElementById("gx-pestanas-nave")?.scrollIntoView({ block: "start" });
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
  const nombre = inst.nombre || "Nave sin nombre";
  const visibles = PESTANAS_NAVE.filter((t) => !t.conectada || pasarela);
  const pestanaVista: PestanaNave = visibles.some((t) => t.id === pestana) ? pestana : "visita";

  // El siguiente paso de la nave, de la visita a tener la conexión en marcha. Lo de después lo dice la puesta en marcha.
  const siguiente: { texto: string; a: PestanaNave } | null =
    inst.puntos.length === 0 ? { texto: "Apuntar las cámaras", a: "visita" }
    : faltan > 0 ? { texto: "Completar la ficha técnica", a: "tecnica" }
    : !pasarela ? { texto: "Conectar la nave", a: "conexion" }
    : null;

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
  const alCambiar = (accion?: string) => {
    recargar();
    if (accion === "borrar") ir("conexion");
  };
  const irDesdePasarela = (p: ParteInstalacion) => ir(p === "puesta" ? "conexion" : p);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
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
        {siguiente && pestanaVista !== siguiente.a && (
          <Button size="sm" onClick={() => ir(siguiente.a)} className="max-w-full">
            <span className="truncate">Siguiente paso: {siguiente.texto.charAt(0).toLowerCase() + siguiente.texto.slice(1)}</span>
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </header>

      {!base && <SinBase />}
      {token && <Token token={token} alCerrar={() => setToken("")} />}
      {fotosNave.falloFoto && <p className="text-[13px] text-mal" role="alert">{fotosNave.falloFoto}</p>}

      <Tabs value={pestanaVista} onValueChange={(v) => ir(v as PestanaNave)} className="gap-4">
        <div id="gx-pestanas-nave" className="sticky top-0 z-[5] -mx-1 overflow-x-auto border-b bg-background px-1 max-md:top-12">
          <TabsList variant="line" aria-label="Partes de la nave" className="h-10 w-max justify-start gap-0 p-0">
            {visibles.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className={PESTANA}>
                {t.texto}
                {t.id === "tecnica" && faltan > 0 && <span className={CUENTA} aria-label={`Faltan ${faltan} datos`}>{faltan}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
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
              {falloConexion && <p role="alert" className="text-mal">{falloConexion}</p>}
            </section>
          )}
        </TabsContent>
        {pasarela && (
          <>
            <TabsContent value="lecturas" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="lecturas" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
            <TabsContent value="ordenes" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="ordenes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
            <TabsContent value="historicos" className={CONTENIDO}><PantallaHistoricos key={pasarela.id} api="/api/ops/historicos" conDemo={false} fija={pasarela.id} /></TabsContent>
            <TabsContent value="datos" className={CONTENIDO}><DatosGuardados key={pasarela.id} id={pasarela.id} irAHistoricos={() => ir("historicos")} /></TabsContent>
            <TabsContent value="ahorro" className={CONTENIDO}><Ahorro key={pasarela.id} id={pasarela.id} irAOrdenes={() => ir("ordenes")} /></TabsContent>
            <TabsContent value="ajustes" className={CONTENIDO}><Detalle key={pasarela.id} id={pasarela.id} parte="ajustes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
          </>
        )}
      </Tabs>
      {fotosNave.visorFotos}
    </div>
  );
}
