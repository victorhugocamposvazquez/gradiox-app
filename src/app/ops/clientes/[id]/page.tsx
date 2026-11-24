"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, CloudOff, LoaderCircle, Plus, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import { HojaDeRuta } from "@/components/hoja-de-ruta";
import { Borrar, Campo, Conectadas, FotosDe, Lista, usarFotos } from "@/components/ops/ficha-piezas";
import { AppCliente } from "@/components/app-cliente";
import { ESTADOS, FASES, SOLO_LECTURA, TONO, avisos, esDocumento, faltan, haceCuanto, instalacionVacia, type Apunte, type EstadoCliente, type Instalacion, type SoloLectura } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { faltaTecnica } from "@/clientes/tecnica";
import { usarFicha } from "@/clientes/usar-ficha";
import { PESTANAS as PASOS, PESTANA_DE_FALTA, pestanaPedida, type Pestana as Paso } from "@/clientes/pestanas";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { DE_CHIP, Estado, Punto } from "@/components/ops/punto";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PESTANA = "h-10 flex-none gap-1.5 rounded-none px-2.5 text-[13px] after:!bottom-0 after:bg-primary focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none";
const CUENTA = "rounded bg-aviso-fondo px-1 text-xs font-medium text-aviso";

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const ir = useRouter();
  const { c, setC, fotos: todas, setFotos, base, fallo, setFallo, estado, lecturas, ahora, cambiar, enviar, cancelar } = usarFicha(id);
  // Los documentos de la ficha técnica se guardan con las fotos, pero aquí no se enseñan.
  const fotos = todas.filter((f) => !esDocumento(f));
  const [nota, setNota] = useState("");
  const [anotando, setAnotando] = useState(false);
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
    if (pedidaInst) ir.replace(`/ops/clientes/${id}/naves/${pedidaInst}`);
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
    window.history.replaceState(null, "", url);
    window.setTimeout(() => document.getElementById("gx-pasos")?.scrollIntoView({ block: "start" }), 60);
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
    <div className="gx-siguiente">
      <button type="button" className="gx-boton" onClick={() => irA(p)}>
        {texto} <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" />
      </button>
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
      <Breadcrumb>
        <BreadcrumbList className="text-[13px]">
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/ops">Clientes</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{c.nombre || "Cliente sin nombre"}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight break-words">{c.nombre || "Cliente sin nombre"}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <Estado tono={DE_CHIP[TONO[c.estado]] ?? "neutro"} texto={ESTADOS[c.estado]} />
          <span>{c.instalaciones.length === 1 ? "1 nave" : `${c.instalaciones.length} naves`} · {total === 1 ? "1 cámara" : `${total} cámaras`}{suyas.length ? ` · ${suyas.length === 1 ? "1 conectada" : `${suyas.length} conectadas`}` : ""}</span>
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
      </header>

      <Tabs value={paso} onValueChange={(v) => irA(v as Paso)} className="gap-4">
        <div id="gx-pasos" className="sticky top-0 z-[5] -mx-1 overflow-x-auto border-b bg-background px-1 max-md:top-12">
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
              <section aria-labelledby="f-atencion" className="overflow-hidden rounded-lg border bg-card">
                <h2 id="f-atencion" className="border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">Pide atención · {pendientes.length}</h2>
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
            <div className="gx-dos igual">
              <section aria-labelledby="f-sitios" className="self-start overflow-hidden rounded-lg border bg-card">
                <h2 id="f-sitios" className="border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">Naves · {c.instalaciones.length}</h2>
                {c.instalaciones.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-muted-foreground">Sin naves todavía. Añade la primera en «Naves».</p>
                ) : (
                  <ul data-slot="lista" className="divide-y">
                    {c.instalaciones.map((i, n) => (
                      <li key={i.id} className="flex flex-col gap-1.5 px-4 py-2.5">
                        <Link href={`/ops/clientes/${id}/naves/${i.id}`} className="flex items-center gap-3 rounded-md text-left hover:text-acento-texto">
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[13px] font-medium">{i.nombre || `Instalación ${n + 1}`}</span>
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
                    <span className="text-xs text-muted-foreground">Conectadas sin nave elegida (se elige en «Acceso a la app»)</span>
                    <Conectadas lista={suyas.filter((x) => !c.instalaciones.some((i) => i.id === x.ubicacion))} ahora={ahoraNav} />
                  </div>
                )}
              </section>
            <section className="gx-tarjeta" aria-labelledby="f-paso">
              <h2 id="f-paso">Próximo paso</h2>
              <div className="gx-formulario gx-ficha">
                <Campo ancho rotulo="Qué hay que hacer ahora" valor={c.proximo.texto} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, texto: v } })} placeholder="Por ejemplo: enviar la propuesta" maxLength={240} />
                <Campo rotulo="Para cuándo" type="date" valor={c.proximo.fecha} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, fecha: v } })} />
                <Lista<EstadoCliente> rotulo="En qué punto está el cliente" valor={c.estado} opciones={ESTADOS} alCambiar={(v) => cambiar({ estado: v })} />
                <Campo ancho lineas={3} rotulo="Notas internas" valor={c.notas} alCambiar={(v) => cambiar({ notas: v })} maxLength={8000} />
              </div>
            </section>
            </div>
        </TabsContent>

        <TabsContent value="datos" className="flex flex-col gap-4 data-[state=inactive]:hidden">
            <section className="gx-tarjeta" aria-labelledby="f-datos">
              <h2 id="f-datos">La empresa</h2>
              <div className="gx-formulario gx-ficha">
                <Campo rotulo="Nombre" valor={c.nombre} alCambiar={(v) => cambiar({ nombre: v })} maxLength={120} />
                <Campo rotulo="A qué se dedican" valor={c.actividad} alCambiar={(v) => cambiar({ actividad: v })} placeholder="Por ejemplo: almacén de congelados" maxLength={240} />
                <Campo ancho rotulo="Dirección" valor={c.direccion} alCambiar={(v) => cambiar({ direccion: v })} maxLength={240} />
                <Campo rotulo="Razón social" valor={c.razon} alCambiar={(v) => cambiar({ razon: v })} maxLength={160} />
                <Campo rotulo="NIF" valor={c.nif} alCambiar={(v) => cambiar({ nif: v })} maxLength={20} />
              </div>
            </section>
            <section className="gx-tarjeta" aria-labelledby="f-personas">
              <h2 id="f-personas">Con quién se habla</h2>
              <div className="gx-formulario gx-ficha">
                <Campo rotulo="Persona de contacto" valor={c.contacto.nombre} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, nombre: v } })} maxLength={120} />
                <Campo rotulo="Cargo" valor={c.contacto.cargo} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, cargo: v } })} maxLength={120} />
                <Campo rotulo="Teléfono" type="tel" inputMode="tel" valor={c.contacto.telefono} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, telefono: v } })} maxLength={40} />
                <Campo rotulo="Correo" type="email" inputMode="email" valor={c.contacto.correo} alCambiar={(v) => cambiar({ contacto: { ...c.contacto, correo: v } })} maxLength={160} />
                <Campo rotulo="Quién mantiene el frío" valor={c.mantenedor.nombre} alCambiar={(v) => cambiar({ mantenedor: { ...c.mantenedor, nombre: v } })} placeholder="Persona o empresa instaladora" maxLength={160} />
                <Campo rotulo="Su teléfono" type="tel" inputMode="tel" valor={c.mantenedor.telefono} alCambiar={(v) => cambiar({ mantenedor: { ...c.mantenedor, telefono: v } })} maxLength={40} />
              </div>
            </section>
            <section className="gx-tarjeta" aria-labelledby="f-visita">
              <h2 id="f-visita">Lo que dijo el cliente</h2>
              <div className="gx-formulario gx-ficha">
                <Campo rotulo="Día de la visita" type="date" valor={c.visita.fecha} alCambiar={(v) => cambiar({ visita: { ...c.visita, fecha: v } })} />
                <Lista<SoloLectura> rotulo="¿Acepta empezar solo mirando?" valor={c.visita.soloLectura} opciones={SOLO_LECTURA} alCambiar={(v) => cambiar({ visita: { ...c.visita, soloLectura: v } })} />
                <Campo ancho lineas={2} rotulo="Qué le quita el sueño" valor={c.visita.preocupa} alCambiar={(v) => cambiar({ visita: { ...c.visita, preocupa: v } })} maxLength={4000} />
                <Campo ancho lineas={2} rotulo="Cómo se entera hoy de un fallo" valor={c.visita.comoSeEntera} alCambiar={(v) => cambiar({ visita: { ...c.visita, comoSeEntera: v } })} maxLength={4000} />
                <Campo ancho lineas={2} rotulo="Otras cosas que dijo" valor={c.visita.otras} alCambiar={(v) => cambiar({ visita: { ...c.visita, otras: v } })} maxLength={4000} />
              </div>
            </section>

            <section className="gx-tarjeta" aria-labelledby="f-otras">
              <h2 id="f-otras">Otras fotos · {sueltas.length}</h2>
              <p className="gx-nota">Las que no son de una cámara ni de una instalación concreta: la fachada, una tarjeta, un documento.</p>
              <FotosDe fotos={sueltas} tipos={["otra"]} subiendo={subiendo > 0} alSubir={(a, t) => void subir(a, t)} alVer={setGrande} alBorrar={(f) => void borrarFoto(f)} />
            </section>

            <section className="gx-tarjeta gx-anadir">
              <div>
                <h2>Borrar el cliente</h2>
                <p className="gx-nota">Se borran su ficha y todas sus fotos. No se puede deshacer.</p>
              </div>
              <Borrar texto="Borrar cliente" seguro="¿Borrar la ficha y sus fotos?" alBorrar={() => void borrarCliente()} />
            </section>
            {siguiente("instalaciones", "Seguir con las instalaciones y las cámaras")}
        </TabsContent>

        <TabsContent value="instalaciones" className="flex flex-col gap-4 data-[state=inactive]:hidden">
          <section aria-labelledby="f-naves" className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <h2 id="f-naves" className="mr-auto text-[13px] font-medium text-muted-foreground">{c.instalaciones.length === 1 ? "1 nave" : `${c.instalaciones.length} naves`}</h2>
              <Button size="sm" variant={c.instalaciones.length ? "outline" : "default"} onClick={() => void (async () => { const n = anadirInstalacion(); await enviar(); ir.push(`/ops/clientes/${id}/naves/${n}`); })()}><Plus aria-hidden="true" />Añadir nave</Button>
            </div>
            {c.instalaciones.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">Una nave es un sitio con frío: una nave, una tienda, un almacén. Añade la primera y dentro apuntarás sus cámaras, su ficha técnica y su conexión.</p>
            ) : (
              <ul data-slot="lista" className="divide-y">
                {c.instalaciones.map((i, n) => {
                  const suya = conectadaDe(i)[0];
                  const e = suya ? estadoInstalacion(suya, ahoraNav) : null;
                  const faltanT = faltaTecnica(i).length;
                  return (
                    <li key={i.id}>
                      <Link href={`/ops/clientes/${id}/naves/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium">{i.nombre || `Nave ${n + 1}`}</span>
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
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-[13px]">
              <h2 className="font-medium">Conexiones de este cliente sin nave</h2>
              <p className="text-muted-foreground">Se crearon antes de que cada conexión fuera de una nave. Elige su nave en «Acceso a la app» y pasarán a verse dentro de ella.</p>
              <Conectadas lista={suyas.filter((x) => !c.instalaciones.some((i) => i.id === x.ubicacion))} ahora={ahoraNav} />
            </section>
          )}
        </TabsContent>

        <TabsContent value="app"><AppCliente cliente={id} nombreCliente={c.nombre} instalaciones={c.instalaciones.map((i) => ({ id: i.id, nombre: i.nombre }))} /></TabsContent>

        <TabsContent value="historial" className="flex flex-col gap-4 data-[state=inactive]:hidden">
            <section className="gx-tarjeta" aria-labelledby="f-registro">
              <h2 id="f-registro">Registro · {c.historial.length}</h2>
              <form className="gx-alta" onSubmit={anotar} style={{ marginTop: 10 }}>
                <label className="gx-campo">
                  Apuntar algo
                  <input value={nota} maxLength={2000} onChange={(ev) => setNota(ev.target.value)} placeholder="Una llamada, un acuerdo, lo que se ha hecho" autoComplete="off" />
                </label>
                <button type="submit" className="gx-boton secundario" disabled={anotando || !nota.trim()}>
                  <Send size={16} strokeWidth={1.7} aria-hidden="true" /> Apuntar
                </button>
              </form>
              {c.historial.length === 0 ? (
                <p className="gx-vacio">Sin apuntes todavía. Los cambios de estado se apuntan solos.</p>
              ) : (
                <ol className="gx-registro">
                  {[...c.historial].reverse().map((a) => (
                    <li key={a.id} className={a.auto ? "auto" : undefined}>
                      <time dateTime={new Date(a.t).toISOString()}>{new Date(a.t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                      <span>{a.texto}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

        </TabsContent>
      </Tabs>

      {visorFotos}
    </div>
  );
}
