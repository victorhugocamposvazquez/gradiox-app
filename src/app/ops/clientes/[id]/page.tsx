"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Check, CloudOff, History, ListChecks, LoaderCircle, MapPin, Plus, Send, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { SinBase } from "@/components/sin-base";
import { PasoAlta } from "@/components/ops/paso-alta";
import { HojaDeRuta } from "@/components/hoja-de-ruta";
import { Campo, DialogoBorrar, Conectadas, FORMULARIO, FotosDe, Lista, Seccion, usarFotos } from "@/components/ops/ficha-piezas";
import { AppCliente } from "@/components/app-cliente";
import { ESTADOS, FASES, SOLO_LECTURA, TONO, avisos, esDocumento, faltan, haceCuanto, instalacionVacia, nombreNave, type Apunte, type EstadoCliente, type Instalacion, type SoloLectura } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { faltaTecnica } from "@/clientes/tecnica";
import { usarFicha } from "@/clientes/usar-ficha";
import { PESTANAS as PASOS, PESTANA_DE_FALTA, pestanaPedida, type Pestana as Paso } from "@/clientes/pestanas";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { DE_CHIP, Estado, Punto, MarcadorNave } from "@/components/ops/punto";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarraMovil, IndiceMovil, anotarPaso, verApartado, type FilaIndice } from "@/components/ops/movil";

const PESTANA = "h-10 flex-none gap-1.5 rounded-none px-2.5 text-[13px] after:!bottom-0 after:bg-primary focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none";
const CUENTA = "rounded bg-aviso-fondo px-1 text-xs font-medium text-aviso";

// Los iconos de cada parte de la ficha en la lista del móvil.
const ICONO_PASO: Record<Paso, ReactNode> = { resumen: <ListChecks />, datos: <Building2 />, instalaciones: <MapPin />, app: <Smartphone />, historial: <History /> };

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const ir = useRouter();
  const { c, setC, fotos: todas, setFotos, base, fallo, setFallo, estado, lecturas, ahora, cambiar, enviar, cancelar } = usarFicha(id);
  // Los documentos de la ficha técnica se guardan con las fotos, pero aquí no se enseñan.
  const fotos = todas.filter((f) => !esDocumento(f));
  const [nota, setNota] = useState("");
  const [borrarAbierto, setBorrarAbierto] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [enAlta, setEnAlta] = useState<{ n: number; total: number } | null>(null);
  const [paso, setPaso] = useState<Paso>("resumen");
  const { instalaciones: conectadas, ahora: ahoraNav } = useNavegacion();
  const { subiendo, falloFoto, subir, borrarFoto, ver: setGrande, visorFotos } = usarFotos(id, c, setFotos);
  // La pestaña va en la dirección: un enlace (también los de la hoja de ruta) abre directamente su parte.
  // Recién dado de alta se queda en el resumen: la hoja de ruta lleva de la mano desde el primer paso.
  const busqueda = useSearchParams();
  const pedida = pestanaPedida(busqueda.get("paso"));
  const pedidaInst = busqueda.get("i");
  // Los enlaces antiguos a una instalación de la ficha (?i=) llevan ahora a la página de su nave.
  useEffect(() => {
    if (pedidaInst) ir.replace(`/ops/clientes/${id}/instalaciones/${pedidaInst}`);
    else if (pedida) setPaso(pedida);
  }, [pedida, pedidaInst, id, ir]);


  if (!c)
    return (
      <>
        <p className="py-2 text-sm text-muted-foreground" role={fallo ? "alert" : undefined}>{fallo || "Abriendo la ficha…"}</p>
        {fallo && <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/ops">Ver todos los clientes</Link></Button>}
      </>
    );

  const irA = (p: Paso) => {
    setPaso(p);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", p);
    url.searchParams.delete("i");
    url.searchParams.delete("nuevo");
    // Cada parte es una pantalla: atrás (también el del móvil) vuelve a la anterior.
    window.history.pushState(null, "", url);
    anotarPaso();
    window.setTimeout(() => verApartado("gx-pasos"), 60);
  };
  // La nave nueva se guarda en el momento (sin esperar al guardado automático): su página lee la ficha del servidor.
  const anadirInstalacion = () => {
    const nueva = instalacionVacia();
    cambiar({ instalaciones: [...c.instalaciones, nueva] });
    return nueva.id;
  };
  const borrarCliente = async () => {
    try {
      cancelar();
      await pedir(`/api/ops/clientes/${id}`, { method: "DELETE" });
      ir.push("/ops");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido borrar");
    }
  };
  const anotar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nota.trim()) return;
    setAnotando(true);
    try {
      const d = await pedir<{ historial: Apunte[] }>(`/api/ops/clientes/${id}/historial`, conJson("POST", { texto: nota }));
      setC((x) => (x ? { ...x, historial: d.historial } : x));
      setNota("");
      setFallo("");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido apuntar");
    }
    setAnotando(false);
  };

  const pendientes = avisos(c, fotos.length, lecturas, ahora);
  const porRecoger = faltan(c, fotos);
  const cuantas = (p: Paso) => porRecoger.filter((f) => PESTANA_DE_FALTA[f.paso] === p).length;
  // Las instalaciones que ya entregan datos (con su pasarela) y en qué sitio de la ficha están.
  const suyas = (conectadas ?? []).filter((x) => x.cliente === id);
  const conectadaDe = (i: Instalacion) => suyas.filter((x) => x.ubicacion === i.id);
  const total = c.instalaciones.reduce((n, i) => n + i.puntos.length, 0);
  const sueltas = fotos.filter((f) => !c.instalaciones.some((i) => i.id === f.instalacion));
  const siguiente = (p: Paso, texto: string) => (
    <div className="flex justify-end">
      <Button size="sm" onClick={() => irA(p)}>
        {texto} <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
  const lee = (i: Instalacion) => {
    const l = i.aparato.pasarela ? lecturas[i.aparato.pasarela] : undefined;
    if (!i.aparato.pasarela) return <><span className="gx-punto sindatos" /> Sin aparato enlazado: no se sabe si lee.</>;
    if (!l) return <><span className="gx-punto mirar" /> El aparato {i.aparato.pasarela} no ha entregado lecturas todavía.</>;
    const callado = ahora - l.ultima > 15 * 60_000;
    return <><span className={`gx-punto ${callado ? "mal" : "bien"}`} /> {callado ? "Sin lecturas desde hace" : "Leyendo. Última lectura hace"} {haceCuanto(ahora - l.ultima)} · {l.equipos === 1 ? "1 equipo" : `${l.equipos} equipos`}</>;
  };

  return (
    <div className="flex flex-col gap-4 data-[state=inactive]:hidden">
      <BarraMovil
        arriba={pedida ? `/ops/clientes/${id}` : "/ops/clientes"}
        titulo={c.nombre || "Cliente sin nombre"}
        sub={pedida ? PASOS.find((t) => t.id === paso)?.texto : enAlta ? `Ficha del cliente · alta, paso ${enAlta.n} de ${enAlta.total}` : "Ficha del cliente"}
      />
      <Breadcrumb className="max-md:hidden">
        <BreadcrumbList className="text-[13px]">
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/ops/clientes">Clientes</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{c.nombre || "Cliente sin nombre"}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className={`flex flex-wrap items-start gap-x-6 gap-y-3 ${pedida ? "max-md:hidden" : ""}`}>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
        {enAlta && <p className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase max-md:hidden">Alta de cliente en curso</p>}
        <h1 className="text-xl font-semibold tracking-tight break-words max-md:sr-only">{c.nombre || "Cliente sin nombre"}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <Estado tono={DE_CHIP[TONO[c.estado]] ?? "neutro"} texto={ESTADOS[c.estado]} />
          <span>{c.instalaciones.length === 1 ? "1 instalación" : `${c.instalaciones.length} instalaciones`} · {total === 1 ? "1 cámara" : `${total} cámaras`}{suyas.length ? ` · ${suyas.length === 1 ? "1 conectada" : `${suyas.length} conectadas`}` : ""}</span>
          <span className={`gx-guardado ${estado}`} role="status">
            {estado === "guardado" && <><Check size={15} aria-hidden="true" /> Guardado</>}
            {estado === "pendiente" && "Cambios sin guardar…"}
            {estado === "guardando" && <><LoaderCircle size={15} aria-hidden="true" className="gx-gira" /> Guardando…</>}
            {estado === "fallo" && (
              <>
                <CloudOff size={15} aria-hidden="true" /> {c.nombre.trim() ? "No se ha guardado." : "Falta el nombre: no se guarda."}
                {c.nombre.trim() && <button type="button" className="gx-boton-enlace" onClick={() => void enviar()}>Reintentar</button>}
              </>
            )}
          </span>
          {subiendo > 0 && <span className="gx-guardado" role="status"><LoaderCircle size={15} aria-hidden="true" className="gx-gira" /> Subiendo {subiendo === 1 ? "1 foto" : `${subiendo} fotos`}…</span>}
        </div>
        </div>
        <PasoAlta cliente={id} guardado={estado} cambio={String(suyas.length)} alSaber={setEnAlta} alIr={(donde) => {
          const u = new URL(donde, window.location.origin);
          if (u.pathname !== `/ops/clientes/${id}`) return false;
          irA(pestanaPedida(u.searchParams.get("paso")) ?? "resumen");
          return true;
        }} />
      </header>

      {!pedida && (
        <IndiceMovil
          grupos={[
            {
              nombre: "Instalaciones",
              filas: [
                ...c.instalaciones.map((i, n) => {
                  const e = conectadaDe(i)[0] ? estadoInstalacion(conectadaDe(i)[0], ahoraNav) : null;
                  return { clave: i.id, texto: nombreNave(i, n), detalle: `${i.puntos.length === 1 ? "1 cámara" : `${i.puntos.length} cámaras`} · ${e ? e.texto : "sin conectar"}`, icono: <MarcadorNave tono={e?.tono ?? "neutro"} />, href: `/ops/clientes/${id}/instalaciones/${i.id}` };
                }),
                { clave: "nueva", texto: "Añadir instalación", icono: <Plus />, alTocar: () => void (async () => { const n = anadirInstalacion(); await enviar(); ir.push(`/ops/clientes/${id}/instalaciones/${n}`); })() },
              ],
            },
            {
              nombre: "El cliente",
              filas: PASOS.filter((t) => t.id !== "instalaciones").map((t): FilaIndice => ({
                clave: t.id,
                texto: t.id === "resumen" ? "Alta y seguimiento" : t.texto,
                detalle: cuantas(t.id) > 0 ? `Faltan ${cuantas(t.id)}` : undefined,
                aviso: cuantas(t.id) > 0,
                icono: ICONO_PASO[t.id],
                alTocar: () => irA(t.id),
              })).concat([{ clave: "borrar", texto: "Borrar el cliente", detalle: "Pide confirmación", aviso: false, icono: <Trash2 />, alTocar: () => setBorrarAbierto(true) }]),
            },
          ]}
        />
      )}

      <Tabs value={paso} onValueChange={(v) => irA(v as Paso)} className={`gap-4 ${pedida ? "" : "max-md:hidden"}`}>
        <div id="gx-pasos" className="sticky top-0 z-[5] -mx-1 overflow-x-auto border-b bg-background px-1 max-md:hidden">
          <TabsList variant="line" aria-label="Partes de la ficha" className="h-10 w-max justify-start gap-0 p-0">
            {PASOS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className={PESTANA}>
                {t.texto}
                {cuantas(t.id) > 0 && <span className={CUENTA} aria-label={`Faltan ${cuantas(t.id)} cosas`}>{cuantas(t.id)}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {!base && <SinBase />}
        {fallo && <p className="text-[13px] text-mal" role="alert">{fallo}</p>}
        {falloFoto && <p className="text-[13px] text-mal" role="alert">{falloFoto}</p>}

        <TabsContent value="resumen" className="flex flex-col gap-4 data-[state=inactive]:hidden">
            {pendientes.length > 0 && (
              <section aria-labelledby="f-atencion" className="overflow-hidden rounded-lg border bg-card shadow-xs">
                <h2 id="f-atencion" className="m-0 border-b px-4 py-3 text-sm font-semibold">Pide atención · {pendientes.length}</h2>
                <ul data-slot="lista" className="divide-y">
                  {pendientes.map((a) => (
                    <li key={a.texto} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <Punto tono={a.nivel === "mal" ? "mal" : "aviso"} />
                      <span className="sr-only">{a.nivel === "mal" ? "Falla:" : "Por mirar:"}</span>
                      <span>{a.texto}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <HojaDeRuta c={c} cambiar={cambiar} guardado={estado} fotos={fotos} subir={subir} />
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <section aria-labelledby="f-sitios" className="self-start overflow-hidden rounded-lg border bg-card shadow-xs">
                <h2 id="f-sitios" className="m-0 border-b px-4 py-3 text-sm font-semibold">Instalaciones · {c.instalaciones.length}</h2>
                {c.instalaciones.length === 0 ? (
                  <div className="flex flex-col items-start gap-2 px-4 py-3 text-[13px] text-muted-foreground">
                    Sin instalaciones todavía. Cada instalación es un sitio del cliente con sus cámaras.
                    <Button size="sm" variant="outline" onClick={() => irA("instalaciones")}><Plus aria-hidden="true" />Añadir la primera instalación</Button>
                  </div>
                ) : (
                  <ul data-slot="lista" className="divide-y">
                    {c.instalaciones.map((i, n) => (
                      <li key={i.id} className="flex flex-col gap-1.5 px-4 py-2.5">
                        <Link href={`/ops/clientes/${id}/instalaciones/${i.id}`} className="flex items-center gap-3 rounded-md text-left hover:text-acento-texto">
                          <MarcadorNave tono={conectadaDe(i)[0] ? estadoInstalacion(conectadaDe(i)[0], ahoraNav).tono : "neutro"} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[13px] font-medium">{nombreNave(i, n)}</span>
                            <span className="text-xs text-muted-foreground">{i.puntos.length === 1 ? "1 cámara" : `${i.puntos.length} cámaras`} · {FASES[i.fase]}</span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                        </Link>
                        <Conectadas lista={conectadaDe(i)} ahora={ahoraNav} />
                        {!conectadaDe(i).length && i.aparato.pasarela && <small className="gx-lee text-xs">{lee(i)}</small>}
                      </li>
                    ))}
                  </ul>
                )}
                {suyas.some((x) => !c.instalaciones.some((i) => i.id === x.ubicacion)) && (
                  <div className="flex flex-col gap-1.5 border-t px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Conectadas sin instalación elegida (se elige en «Acceso a la app»)</span>
                    <Conectadas lista={suyas.filter((x) => !c.instalaciones.some((i) => i.id === x.ubicacion))} ahora={ahoraNav} />
                  </div>
                )}
              </section>
            <Seccion titulo="Recordatorio" descripcion="Algo que hacer con este cliente aparte del alta, con su fecha. Si se pasa la fecha, sale en Pendiente.">
              <div className={FORMULARIO}>
                <Campo ancho rotulo="Qué hay que hacer" valor={c.proximo.texto} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, texto: v } })} placeholder="Por ejemplo: llamar para enviar la propuesta" maxLength={240} />
                <Campo rotulo="Para cuándo" type="date" valor={c.proximo.fecha} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, fecha: v } })} />
                <Lista<EstadoCliente> rotulo="En qué punto está el cliente" valor={c.estado} opciones={ESTADOS} alCambiar={(v) => cambiar({ estado: v })} />
                <Campo ancho lineas={3} rotulo="Notas internas" valor={c.notas} alCambiar={(v) => cambiar({ notas: v })} maxLength={8000} />
              </div>
            </Seccion>
            </div>
        </TabsContent>

        <TabsContent value="datos" className="flex flex-col gap-4 data-[state=inactive]:hidden">
            <Seccion titulo="La empresa">
              <div className={FORMULARIO}>
                <Campo rotulo="Nombre" valor={c.nombre} alCambiar={(v) => cambiar({ nombre: v })} maxLength={120} />
                <Campo rotulo="A qué se dedican" valor={c.actividad} alCambiar={(v) => cambiar({ actividad: v })} placeholder="Por ejemplo: almacén de congelados" maxLength={240} />
                <Campo ancho rotulo="Dirección" valor={c.direccion} alCambiar={(v) => cambiar({ direccion: v })} maxLength={240} />
                <Campo rotulo="Razón social" valor={c.razon} alCambiar={(v) => cambiar({ razon: v })} maxLength={160} />
                <Campo rotulo="NIF" valor={c.nif} alCambiar={(v) => cambiar({ nif: v })} maxLength={20} />
              </div>
            </Seccion>
            <Seccion titulo="Con quién se habla">
              <div className={FORMULARIO}>
                <Campo rotulo="Persona de contacto" valor={c.contacto.nombre} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, nombre: v } })} maxLength={120} />
                <Campo rotulo="Cargo" valor={c.contacto.cargo} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, cargo: v } })} maxLength={120} />
                <Campo rotulo="Teléfono" type="tel" inputMode="tel" valor={c.contacto.telefono} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, telefono: v } })} maxLength={40} />
                <Campo rotulo="Correo" type="email" inputMode="email" valor={c.contacto.correo} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, correo: v } })} maxLength={160} />
                <Campo rotulo="Quién mantiene el frío" valor={c.mantenedor.nombre} alCambiar={(v) => cambiar({ mantenedor: { ...c.mantenedor, nombre: v } })} placeholder="Persona o empresa instaladora" maxLength={160} />
                <Campo rotulo="Su teléfono" type="tel" inputMode="tel" valor={c.mantenedor.telefono} alCambiar={(v) => cambiar({ mantenedor: { ...c.mantenedor, telefono: v } })} maxLength={40} />
              </div>
            </Seccion>
            <Seccion titulo="Lo que dijo el cliente">
              <div className={FORMULARIO}>
                <Campo rotulo="Día de la visita" type="date" valor={c.visita.fecha} alCambiar={(v) => cambiar({ visita: { ...c.visita, fecha: v } })} />
                <Lista<SoloLectura> rotulo="¿Acepta empezar solo mirando?" valor={c.visita.soloLectura} opciones={SOLO_LECTURA} alCambiar={(v) => cambiar({ visita: { ...c.visita, soloLectura: v } })} />
                <Campo ancho lineas={2} rotulo="Qué le quita el sueño" valor={c.visita.preocupa} alCambiar={(v) => cambiar({ visita: { ...c.visita, preocupa: v } })} maxLength={4000} />
                <Campo ancho lineas={2} rotulo="Cómo se entera hoy de un fallo" valor={c.visita.comoSeEntera} alCambiar={(v) => cambiar({ visita: { ...c.visita, comoSeEntera: v } })} maxLength={4000} />
                <Campo ancho lineas={2} rotulo="Otras cosas que dijo" valor={c.visita.otras} alCambiar={(v) => cambiar({ visita: { ...c.visita, otras: v } })} maxLength={4000} />
              </div>
            </Seccion>

            <Seccion titulo={`Otras fotos · ${sueltas.length}`} descripcion="Las que no son de una cámara ni de una instalación concreta: la fachada, una tarjeta, un documento.">
              <FotosDe fotos={sueltas} tipos={["otra"]} subiendo={subiendo > 0} alSubir={(a, t) => void subir(a, t)} alVer={setGrande} alBorrar={(f) => void borrarFoto(f)} />
            </Seccion>

            <Seccion titulo="Borrar el cliente" descripcion="Se borran su ficha, sus instalaciones, sus fotos y sus usuarios de la app. Sus conexiones se quedan, sin cliente." accion={<Button type="button" variant="outline" size="sm" className="text-mal" onClick={() => setBorrarAbierto(true)}><Trash2 aria-hidden="true" />Borrar cliente</Button>} />
            {siguiente("instalaciones", "Seguir con las instalaciones")}
        </TabsContent>

        <TabsContent value="instalaciones" className="flex flex-col gap-4 data-[state=inactive]:hidden">
          <section aria-labelledby="f-instalaciones" className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <h2 id="f-instalaciones" className="m-0 mr-auto text-sm font-semibold">{c.instalaciones.length === 1 ? "1 instalación" : `${c.instalaciones.length} instalaciones`}</h2>
              <Button size="sm" variant={c.instalaciones.length ? "outline" : "default"} onClick={() => void (async () => { const n = anadirInstalacion(); await enviar(); ir.push(`/ops/clientes/${id}/instalaciones/${n}`); })()}><Plus aria-hidden="true" />Añadir instalación</Button>
            </div>
            {c.instalaciones.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">Una instalación es un sitio con frío: una nave, una tienda, un supermercado, un almacén. Añade la primera y dentro apuntarás sus cámaras, su ficha técnica y su conexión.</p>
            ) : (
              <ul data-slot="lista" className="divide-y">
                {c.instalaciones.map((i, n) => {
                  const suya = conectadaDe(i)[0];
                  const e = suya ? estadoInstalacion(suya, ahoraNav) : null;
                  const faltanT = faltaTecnica(i).length;
                  return (
                    <li key={i.id}>
                      <Link href={`/ops/clientes/${id}/instalaciones/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                        <MarcadorNave tono={e?.tono ?? "neutro"} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium">{nombreNave(i, n)}</span>
                          <span className="text-xs text-muted-foreground">
                            {[i.puntos.length === 1 ? "1 cámara" : `${i.puntos.length} cámaras`, FASES[i.fase], faltanT ? `ficha técnica: faltan ${faltanT}` : "ficha técnica completa"].join(" · ")}
                          </span>
                        </span>
                        {e ? <Estado tono={e.tono} texto={e.texto} /> : <span className="text-xs text-muted-foreground">Sin conectar</span>}
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {suyas.some((x) => !c.instalaciones.some((i) => i.id === x.ubicacion)) && (
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-[13px] shadow-xs">
              <h2 className="font-medium">Conexiones de este cliente sin instalación</h2>
              <p className="text-muted-foreground">Se crearon antes de que cada conexión fuera de una instalación. Elige su instalación en «Acceso a la app» y pasarán a verse dentro de ella.</p>
              <Conectadas lista={suyas.filter((x) => !c.instalaciones.some((i) => i.id === x.ubicacion))} ahora={ahoraNav} />
            </section>
          )}
        </TabsContent>

        <TabsContent value="app"><AppCliente cliente={id} nombreCliente={c.nombre} instalaciones={c.instalaciones.map((i) => ({ id: i.id, nombre: i.nombre }))} /></TabsContent>

        <TabsContent value="historial" className="flex flex-col gap-4 data-[state=inactive]:hidden">
            <Seccion titulo={`Registro · ${c.historial.length}`} descripcion="Llamadas, acuerdos y lo que se ha hecho. Los cambios de estado se apuntan solos.">
              <form className="flex flex-wrap items-end gap-2" onSubmit={anotar}>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                  <Label htmlFor="f-apunte" className="text-[13px] font-medium">Apuntar algo</Label>
                  <Input id="f-apunte" value={nota} maxLength={2000} onChange={(ev) => setNota(ev.target.value)} placeholder="Una llamada, un acuerdo, lo que se ha hecho" autoComplete="off" className="h-8 text-sm" />
                </div>
                <Button type="submit" variant="outline" size="sm" disabled={anotando || !nota.trim()}>
                  <Send aria-hidden="true" /> Apuntar
                </Button>
              </form>
              {c.historial.length === 0 ? (
                <p className="m-0 text-[13px] text-muted-foreground">Sin apuntes todavía.</p>
              ) : (
                <ol data-slot="lista" className="m-0 flex list-none flex-col divide-y rounded-md border p-0">
                  {[...c.historial].reverse().map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                      <time className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-32" dateTime={new Date(a.t).toISOString()}>{new Date(a.t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                      <span className={a.auto ? "text-[13px] text-muted-foreground" : "text-[13px]"}>{a.texto}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Seccion>

        </TabsContent>
      </Tabs>

      <DialogoBorrar
        abierto={borrarAbierto}
        alCambiar={setBorrarAbierto}
        titulo={`¿Borrar ${c.nombre || "este cliente"}?`}
        boton="Borrar el cliente"
        alBorrar={borrarCliente}
        texto={
          <>
            <p className="m-0">Se borran su ficha, {c.instalaciones.length === 1 ? "su instalación" : `sus ${c.instalaciones.length} instalaciones`} con sus cámaras, todas sus fotos y sus usuarios de la app (dejarán de poder entrar). No se puede deshacer.</p>
            {suyas.length > 0 && <p className="m-0">{suyas.length === 1 ? "Su conexión no se borra" : `Sus ${suyas.length} conexiones no se borran`}: quedan en «Sin cliente asignado», con todo lo leído, para darlas a otro cliente o borrarlas aparte.</p>}
          </>
        }
      />
      {visorFotos}
    </div>
  );
}
