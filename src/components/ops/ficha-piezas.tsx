"use client";

// Piezas de la ficha de un cliente que comparten la ficha y la página de cada nave:
// campos que se guardan solos, borrar con segunda pulsación y fotos.

import Link from "next/link";
import { Camera, Images, RadioTower, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { TIPOS_FOTO, type Cliente, type Foto, type TipoFoto } from "@/clientes/modelo";
import { conJson, pedir, reducirFoto } from "@/clientes/navegador";
import { estadoInstalacion } from "@/components/ops/navegacion";
import { Estado } from "@/components/ops/punto";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResumenPasarela } from "@/pasarelas/modelo";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Los nombres cortos de los botones de foto. */
export const BOTON_FOTO: Record<TipoFoto, string> = { controlador: "Controlador", etiqueta: "Etiqueta", cuadro: "Cuadro eléctrico", sitio: "Sitio del aparato", automata: "Autómata", documento: "Documento", sistema: "Sistema que tienen", otra: "Otra foto" };

/** Rejilla de campos de un formulario: dos columnas desde tableta, una en el móvil. */
export const FORMULARIO = "grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2";

/** Una parte de una ficha: tarjeta con su título, una línea que explica y, a la derecha, su acción. */
export function Seccion({ titulo, descripcion, accion, children, className, ancla }: { titulo: ReactNode; descripcion?: ReactNode; accion?: ReactNode; children?: ReactNode; className?: string; ancla?: string }) {
  const id = useId();
  return (
    <Card id={ancla} aria-labelledby={id} className={cn("gap-4 scroll-mt-16", className)}>
      <CardHeader>
        <CardTitle id={id} className="flex items-center gap-2 text-sm">{titulo}</CardTitle>
        {descripcion && <CardDescription className="text-[13px]">{descripcion}</CardDescription>}
        {accion && <CardAction>{accion}</CardAction>}
      </CardHeader>
      {children && <CardContent className="flex flex-col gap-3">{children}</CardContent>}
    </Card>
  );
}

export function Campo({ rotulo, valor, alCambiar, ancho, lineas, ...resto }: { rotulo: string; valor: string; alCambiar: (v: string) => void; ancho?: boolean; lineas?: number; type?: string; placeholder?: string; maxLength?: number; inputMode?: "tel" | "email" | "text" }) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", ancho && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-[13px] font-medium">{rotulo}</Label>
      {lineas ? (
        <Textarea id={id} rows={lineas} value={valor} onChange={(ev) => alCambiar(ev.target.value)} placeholder={resto.placeholder} maxLength={resto.maxLength} className="bg-card text-sm" />
      ) : (
        <Input id={id} value={valor} onChange={(ev) => alCambiar(ev.target.value)} autoComplete="off" className="h-8 bg-card text-sm" {...resto} />
      )}
    </div>
  );
}

const VACIO = "__vacio";

export function Lista<T extends string>({ rotulo, valor, opciones, alCambiar, ancho }: { rotulo: string; valor: T; opciones: Record<T, string>; alCambiar: (v: T) => void; ancho?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", ancho && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-[13px] font-medium">{rotulo}</Label>
      {/* El desplegable no admite una opción vacía: «Sin mirar» y similares viajan con una clave propia. */}
      <Select value={valor || VACIO} onValueChange={(v) => alCambiar((v === VACIO ? "" : v) as T)}>
        <SelectTrigger id={id} size="sm" className="w-full min-w-0 bg-card text-sm [&>span]:truncate"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(opciones) as T[]).map((k) => (
            <SelectItem key={k} value={k || VACIO}>{opciones[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Botón que pide una segunda pulsación antes de borrar, dentro de la propia página. */
export function Borrar({ texto, seguro, alBorrar, enlace }: { texto: string; seguro: string; alBorrar: () => void; enlace?: boolean }) {
  const [pidiendo, setPidiendo] = useState(false);
  if (!pidiendo)
    return (
      <Button type="button" variant={enlace ? "ghost" : "outline"} size="sm" className="text-mal hover:text-mal" onClick={() => setPidiendo(true)}>
        <Trash2 aria-hidden="true" /> {texto}
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 text-[13px]" role="group" aria-label={seguro}>
      <span>{seguro}</span>
      <Button type="button" variant="destructive" size="sm" onClick={() => { setPidiendo(false); alBorrar(); }}>Sí, borrar</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setPidiendo(false)}>No</Button>
    </span>
  );
}

/** Una foto en pequeño: se abre al tocarla y se borra con la papelera de su esquina, preguntando antes. */
export function Mini({ foto, alVer, alBorrar }: { foto: Foto; alVer: () => void; alBorrar: () => void }) {
  const [pidiendo, setPidiendo] = useState(false);
  return (
    <div className="mini">
      <button type="button" className="ver" onClick={alVer} aria-label={`Ver la foto: ${TIPOS_FOTO[foto.tipo]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/ops/fotos/${foto.id}`} alt={foto.pie || TIPOS_FOTO[foto.tipo]} loading="lazy" />
        <span>{BOTON_FOTO[foto.tipo]}</span>
      </button>
      {pidiendo ? (
        <span className="seguro" role="group" aria-label="¿Borrar la foto?">
          <button type="button" className="si" onClick={() => { setPidiendo(false); alBorrar(); }}>Borrar</button>
          <button type="button" onClick={() => setPidiendo(false)}>No</button>
        </span>
      ) : (
        <button type="button" className="quitar" onClick={() => setPidiendo(true)} aria-label={`Borrar la foto: ${TIPOS_FOTO[foto.tipo]}`}>
          <Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Las fotos de un sitio concreto (una cámara o una instalación), con los botones para hacer más ahí mismo. */
export function FotosDe({ fotos, tipos, subiendo, alSubir, alVer, alBorrar }: { fotos: Foto[]; tipos: TipoFoto[]; subiendo: boolean; alSubir: (archivos: File[], tipo: TipoFoto) => void; alVer: (f: Foto) => void; alBorrar: (f: Foto) => void }) {
  // Las elegidas de la galería entran como la primera foto que falte; se puede cambiar al abrirlas.
  const porDefecto = tipos.find((t) => !fotos.some((f) => f.tipo === t)) ?? tipos[tipos.length - 1];
  const alElegir = (tipo: TipoFoto) => (ev: ChangeEvent<HTMLInputElement>) => {
    const archivos = [...(ev.target.files ?? [])];
    ev.target.value = "";
    if (archivos.length) alSubir(archivos, tipo);
  };
  return (
    <div className="gx-fotos-de">
      {fotos.map((f) => <Mini key={f.id} foto={f} alVer={() => alVer(f)} alBorrar={() => alBorrar(f)} />)}
      {tipos.map((t) => (
        <label key={t} className={`hacer${subiendo ? " ocupado" : ""}${fotos.some((f) => f.tipo === t) ? " hecha" : ""}`}>
          <Camera size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>{BOTON_FOTO[t]}</span>
          {/* Con «capture» el móvil abre la cámara directamente; en el ordenador abre el selector de archivos. */}
          <input type="file" accept="image/*" capture="environment" className="gx-solo-lector" disabled={subiendo} aria-label={`Hacer foto: ${TIPOS_FOTO[t]}`} onChange={alElegir(t)} />
        </label>
      ))}
      <label className={`elegir${subiendo ? " ocupado" : ""}`}>
        <Images size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>Elegir de la galería</span>
        <input type="file" accept="image/*" multiple className="gx-solo-lector" disabled={subiendo} aria-label="Elegir fotos ya hechas" onChange={alElegir(porDefecto)} />
      </label>
    </div>
  );
}

/** Las instalaciones conectadas de un sitio: llevan a su página, donde están lecturas, órdenes y ahorro. */
export function Conectadas({ lista, ahora }: { lista: ResumenPasarela[]; ahora: number }) {
  if (!lista.length) return null;
  return (
    <span className="flex flex-col gap-1">
      {lista.map((x) => {
        const e = estadoInstalacion(x, ahora);
        return (
          <Link key={x.id} href={`/ops/instalaciones/${x.id}`} className="flex w-fit max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-accent/60">
            <RadioTower className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
            <span className="truncate font-medium">{x.nombre}</span>
            <Estado tono={e.tono} texto={e.texto} />
          </Link>
        );
      })}
    </span>
  );
}


/**
 * Las fotos de la ficha: subir, cambiar su tipo o su nota y borrarlas, con el visor
 * que se abre al tocar una. Lo usan la ficha del cliente y la página de cada nave.
 */
export function usarFotos(id: string, c: Cliente | null, setFotos: Dispatch<SetStateAction<Foto[]>>) {
  const [subiendo, setSubiendo] = useState(0);
  const [falloFoto, setFalloFoto] = useState("");
  const [grande, setGrande] = useState<Foto | null>(null);
  const visor = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (grande) visor.current?.showModal();
  }, [grande]);

  const subir = async (archivos: File[], tipo: TipoFoto, inst = "", pto = "") => {
    setFalloFoto("");
    setSubiendo((n) => n + archivos.length);
    for (const archivo of archivos) {
      try {
        const cuerpo = new FormData();
        cuerpo.set("foto", await reducirFoto(archivo), "foto.jpg");
        cuerpo.set("tipo", tipo);
        cuerpo.set("instalacion", inst);
        cuerpo.set("punto", pto);
        const d = await pedir<{ foto: Foto }>(`/api/ops/clientes/${id}/fotos`, { method: "POST", body: cuerpo });
        setFotos((f) => [...f, d.foto]);
      } catch (e) {
        setFalloFoto(`${archivo.name}: ${e instanceof Error ? e.message : "no se ha podido subir"}`);
      }
      setSubiendo((n) => n - 1);
    }
  };
  const cambiarFoto = async (f: Foto, parte: Partial<Foto>) => {
    const nueva = { ...f, ...parte };
    setFotos((l) => l.map((x) => (x.id === f.id ? nueva : x)));
    setGrande((g) => (g?.id === f.id ? nueva : g));
    try {
      await pedir(`/api/ops/fotos/${f.id}`, conJson("PATCH", nueva));
    } catch (e) {
      setFalloFoto(e instanceof Error ? e.message : "No se ha podido guardar el cambio de la foto");
    }
  };
  const borrarFoto = async (f: Foto) => {
    try {
      await pedir(`/api/ops/fotos/${f.id}`, { method: "DELETE" });
      setFotos((l) => l.filter((x) => x.id !== f.id));
      visor.current?.close();
    } catch (e) {
      setFalloFoto(e instanceof Error ? e.message : "No se ha podido borrar la foto");
    }
  };
  const nombreSitio = (f: Foto) => {
    const i = c?.instalaciones.find((x) => x.id === f.instalacion);
    const p = i?.puntos.find((x) => x.id === f.punto);
    return [i && (c?.instalaciones.length ?? 0) > 1 ? i.nombre : "", p?.nombre].filter(Boolean).join(" · ");
  };

  const visorFotos = (
    <dialog ref={visor} className="gx-visor" onClose={() => setGrande(null)} onClick={(ev) => ev.target === visor.current && visor.current?.close()}>
      {grande && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/ops/fotos/${grande.id}`} alt={grande.pie || TIPOS_FOTO[grande.tipo]} />
          <div className="pie">
            <label className="gx-campo">
              Qué se ve
              <select value={grande.tipo} onChange={(ev) => void cambiarFoto(grande, { tipo: ev.target.value as TipoFoto })}>
                {(Object.keys(TIPOS_FOTO) as TipoFoto[]).filter((k) => k !== "documento").map((k) => <option key={k} value={k}>{TIPOS_FOTO[k]}</option>)}
              </select>
            </label>
            <label className="gx-campo nota">
              Nota de la foto{nombreSitio(grande) ? ` · ${nombreSitio(grande)}` : ""}
              <input key={grande.id} defaultValue={grande.pie} maxLength={240} placeholder="Lo que convenga recordar" onBlur={(ev) => ev.target.value !== grande.pie && void cambiarFoto(grande, { pie: ev.target.value })} />
            </label>
            <span className="botones">
              <Borrar enlace texto="Borrar" seguro="¿Borrar la foto?" alBorrar={() => void borrarFoto(grande)} />
              <button type="button" className="gx-boton secundario" onClick={() => visor.current?.close()}><X size={16} aria-hidden="true" /> Cerrar</button>
            </span>
          </div>
        </>
      )}
    </dialog>
  );

  return { subiendo, falloFoto, subir, borrarFoto, ver: setGrande, visorFotos };
}

/** Confirmar un borrado grande dentro de la página: dice qué se pierde y qué se queda. */
export function DialogoBorrar({ abierto, alCambiar, titulo, texto, boton, alBorrar }: { abierto: boolean; alCambiar: (v: boolean) => void; titulo: string; texto: ReactNode; boton: string; alBorrar: () => Promise<void> | void }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={(v) => !ocupado && alCambiar(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription asChild><div className="flex flex-col gap-2 text-[13px] text-muted-foreground">{texto}</div></DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => alCambiar(false)}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={ocupado} onClick={() => void (async () => { setOcupado(true); try { await alBorrar(); } finally { setOcupado(false); alCambiar(false); } })()}>
            <Trash2 aria-hidden="true" />{ocupado ? "Borrando…" : boton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
