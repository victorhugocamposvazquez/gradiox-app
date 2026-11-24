"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { pedir } from "@/clientes/navegador";
import type { Pasarela } from "@/pasarelas/modelo";
import type { Paso } from "@/pasarelas/puesta";
import { Ahorro } from "@/components/ops/ahorro";
import { DatosGuardados } from "@/components/ops/datos";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { Detalle, Token, hace, type ParteInstalacion } from "@/components/ops/pasarela";
import { Estado } from "@/components/ops/punto";
import { PantallaHistoricos } from "@/components/pantalla-historicos";
import { BarraMovil } from "@/components/ops/movil";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Pestana = ParteInstalacion | "historicos" | "datos" | "ahorro" | "ficha";
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "puesta", texto: "Puesta en marcha" },
  { id: "lecturas", texto: "Lecturas" },
  { id: "ordenes", texto: "Órdenes" },
  { id: "historicos", texto: "Históricos" },
  { id: "datos", texto: "Datos guardados" },
  { id: "ahorro", texto: "Ahorro" },
  { id: "ficha", texto: "Ficha técnica" },
  { id: "ajustes", texto: "Ajustes" },
];
const esPestana = (x: string | null): x is Pestana => PESTANAS.some((p) => p.id === x);

type Cabeza = { ahora: number; pasarela: Pasarela; pasos: Paso[] };

/**
 * Una instalación conectada, con todo lo suyo en pestañas: lo que antes estaba
 * repartido entre Pasarelas, Datos guardados, Actuación e Históricos.
 */
export default function PaginaInstalacion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { clientes, instalaciones, ahora: ahoraNav, recargar } = useNavegacion();
  const [cabeza, setCabeza] = useState<Cabeza | null>(null);
  const [fallo, setFallo] = useState("");
  const [token, setToken] = useState("");
  const [pestana, setPestana] = useState<Pestana>("puesta");

  // La pestaña va en la dirección, para poder mandar un enlace directo a «Órdenes» o volver con el botón de atrás.
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("pestana");
    if (esPestana(pedida)) setPestana(pedida);
  }, []);
  const ir = useCallback((p: Pestana) => {
    setPestana(p);
    const url = new URL(window.location.href);
    url.searchParams.set("pestana", p);
    window.history.replaceState(null, "", url);
  }, []);

  const cargar = useCallback(() => {
    pedir<Cabeza>(`/api/ops/pasarelas/${id}`)
      .then((d) => {
        setCabeza(d);
        setFallo("");
      })
      .catch((e: Error) => setFallo(e.message));
  }, [id]);
  useEffect(() => {
    cargar();
    const reloj = window.setInterval(cargar, 15_000);
    return () => window.clearInterval(reloj);
  }, [cargar]);

  // Una instalación de un cliente, ya en su nave, se ve dentro de la nave: ahí está todo lo suyo junto.
  const enNave = cabeza?.pasarela.cliente && cabeza.pasarela.ubicacion && clientes?.find((x) => x.id === cabeza.pasarela.cliente)?.tecnicas.some((t) => t.id === cabeza.pasarela.ubicacion)
    ? `/ops/clientes/${cabeza.pasarela.cliente}/naves/${cabeza.pasarela.ubicacion}`
    : null;
  useEffect(() => {
    if (!enNave) return;
    const pedida = new URLSearchParams(window.location.search).get("pestana");
    router.replace(pedida ? `${enNave}?pestana=${pedida}` : `${enNave}?pestana=conexion`);
  }, [enNave, router]);

  const alCambiar = (accion?: string) => {
    recargar();
    if (accion === "borrar") router.push("/ops/instalaciones");
    else cargar();
  };

  if (!cabeza) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-muted-foreground">{fallo || "Leyendo la instalación…"}</p>
        {fallo && <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/ops/instalaciones">Ver todas las instalaciones</Link></Button>}
      </div>
    );
  }

  const p = cabeza.pasarela;
  const resumen = instalaciones?.find((x) => x.id === id);
  const estado = resumen ? estadoInstalacion(resumen, ahoraNav || cabeza.ahora) : null;
  const cliente = p.cliente ? clientes?.find((c) => c.id === p.cliente) : undefined;
  const c = p.contacto;
  const siguiente = cabeza.pasos.find((x) => !x.hecho && !x.opcional) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <BarraMovil arriba={cliente ? `/ops/clientes/${cliente.id}` : "/ops/instalaciones"} titulo={p.nombre} sub={cliente ? `${cliente.nombre} · Conexión` : "Conexión sin cliente"} />
      <Breadcrumb className="max-md:hidden">
        <BreadcrumbList className="text-[13px]">
          {cliente ? (
            <>
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/ops/clientes">Clientes</Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/ops/clientes/${cliente.id}`}>{cliente.nombre}</Link></BreadcrumbLink></BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/ops/instalaciones">Conexiones</Link></BreadcrumbLink></BreadcrumbItem>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{p.nombre}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight break-words max-md:sr-only">{p.nombre}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            {estado && <Estado tono={estado.tono} texto={estado.texto} />}
            <span>{c ? `Último contacto ${hace(c.t, cabeza.ahora)}` : "Su programa todavía no ha hablado con Gradiox"}</span>
            {c && <span>Programa {c.programa}</span>}
            <span>{p.variables.length} {p.variables.length === 1 ? "variable" : "variables"}</span>
            {!cliente && <span>Sin cliente asignado</span>}
          </div>
        </div>
        {siguiente && pestana !== "puesta" && (
          <Button size="sm" onClick={() => ir("puesta")} className="max-w-full">
            <span className="truncate">Siguiente paso: {siguiente.titulo.charAt(0).toLowerCase() + siguiente.titulo.slice(1)}</span>
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </header>

      {token && <Token token={token} alCerrar={() => setToken("")} />}

      <Tabs value={pestana} onValueChange={(v) => esPestana(v) && ir(v)} className="gap-4">
        <div className="-mx-1 overflow-x-auto border-b px-1">
          <TabsList variant="line" aria-label="Partes de la instalación" className="h-10 w-max justify-start gap-0 p-0">
            {PESTANAS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-10 flex-none rounded-none px-2.5 text-[13px] after:!bottom-0 after:bg-primary focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none">
                {t.texto}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="puesta"><Detalle id={id} parte="puesta" alCambiar={alCambiar} alToken={setToken} irA={ir} /></TabsContent>
        <TabsContent value="lecturas"><Detalle id={id} parte="lecturas" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
        <TabsContent value="ordenes"><Detalle id={id} parte="ordenes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
        <TabsContent value="historicos"><PantallaHistoricos api="/api/ops/historicos" conDemo={false} fija={id} /></TabsContent>
        <TabsContent value="datos"><DatosGuardados id={id} irAHistoricos={() => ir("historicos")} /></TabsContent>
        <TabsContent value="ahorro"><Ahorro id={id} irAOrdenes={() => ir("ordenes")} /></TabsContent>
        <TabsContent value="ficha">
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-[13px]">
            {cliente ? (
              <>
                <p>La ficha técnica (cámaras, equipos, red, señales y documentos) se rellena con el cliente, en su ficha. Esta instalación es de <strong className="font-medium">{cliente.nombre}</strong>.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link href={p.ubicacion ? `/ops/clientes/${cliente.id}/naves/${p.ubicacion}?pestana=tecnica` : `/ops/clientes/${cliente.id}`}><FileText aria-hidden="true" />Abrir la ficha técnica</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/ops/clientes/${cliente.id}`}>Ficha de {cliente.nombre}</Link></Button>
                </div>
                {!p.ubicacion && <p className="text-muted-foreground">Todavía no se ha dicho en qué nave o almacén del cliente está. Se elige en su ficha, en «Acceso a la app».</p>}
              </>
            ) : (
              <>
                <p>Esta instalación todavía no es de ningún cliente, así que no tiene ficha técnica.</p>
                <p className="text-muted-foreground">Para dársela: abre el cliente y, en «Acceso a la app», marca esta instalación como suya.</p>
                <Button asChild size="sm" variant="outline" className="w-fit"><Link href="/ops">Ir a Clientes</Link></Button>
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="ajustes"><Detalle id={id} parte="ajustes" alCambiar={alCambiar} alToken={setToken} /></TabsContent>
      </Tabs>
    </div>
  );
}
