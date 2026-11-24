"use client";

// Lo que se apunta de una nave en la visita: sus datos, sus cámaras con las fotos de
// cada controlador, la sala y el sitio del aparato. Es la primera pestaña de la nave.

import { ChevronDown, Plus, Snowflake } from "lucide-react";
import { CONEXION_APARATO, FASES, INTERNET, esDocumento, haceCuanto, puntoVacio, type Aparato, type ConexionAparato, type Fase, type Instalacion, type Internet, type PuntoFrio } from "@/clientes/modelo";
import type { usarFicha } from "@/clientes/usar-ficha";
import { Borrar, Campo, FORMULARIO, FotosDe, Lista, Seccion, type usarFotos } from "./ficha-piezas";
import { Punto } from "./punto";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function NaveVisita({ ficha, inst, fotosNave: f }: { ficha: ReturnType<typeof usarFicha>; inst: Instalacion; fotosNave: ReturnType<typeof usarFotos> }) {
  const { c, cambiar, lecturas, ahora } = ficha;
  if (!c) return null;
  const fotos = ficha.fotos.filter((x) => !esDocumento(x));
  const instalacion = (i: Instalacion, parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === i.id ? { ...x, ...parte } : x)) });
  const aparato = (i: Instalacion, parte: Partial<Aparato>) => instalacion(i, { aparato: { ...i.aparato, ...parte } });
  const punto = (i: Instalacion, p: PuntoFrio, parte: Partial<PuntoFrio>) => instalacion(i, { puntos: i.puntos.map((x) => (x.id === p.id ? { ...x, ...parte } : x)) });
  const lee = (i: Instalacion) => {
    const l = i.aparato.pasarela ? lecturas[i.aparato.pasarela] : undefined;
    if (!i.aparato.pasarela) return null;
    if (!l) return <span className="flex items-center gap-1.5"><Punto tono="aviso" /> El aparato {i.aparato.pasarela} no ha entregado lecturas todavía.</span>;
    const callado = ahora - l.ultima > 15 * 60_000;
    return <span className="flex items-center gap-1.5"><Punto tono={callado ? "mal" : "bien"} /> {callado ? "Sin lecturas desde hace" : "Leyendo. Última lectura hace"} {haceCuanto(ahora - l.ultima)} · {l.equipos === 1 ? "1 equipo" : `${l.equipos} equipos`}</span>;
  };

  const abiertoAparato = Boolean(inst.aparato.pasarela || inst.aparato.modelo || inst.aparato.serie) || ["pedido", "instalando", "leyendo", "incidencia"].includes(inst.fase);
  return (
    <div className="flex flex-col gap-4">
      <Seccion titulo="La instalación" descripcion={lee(inst) ?? "Cómo se llama, en qué fase está y dónde queda."}>
        <div className={FORMULARIO}>
          <Campo rotulo="Nombre de la instalación" valor={inst.nombre} alCambiar={(v) => instalacion(inst, { nombre: v })} placeholder="Por ejemplo: nave de Getafe" maxLength={120} />
          <Lista<Fase> rotulo="En qué fase está" valor={inst.fase} opciones={FASES} alCambiar={(v) => instalacion(inst, { fase: v })} />
          <Campo ancho rotulo="Dirección, si no es la de la empresa" valor={inst.direccion} alCambiar={(v) => instalacion(inst, { direccion: v })} maxLength={240} />
        </div>
      </Seccion>

      <Seccion
        titulo={`Cámaras y puntos de frío · ${inst.puntos.length}`}
        descripcion="Una ficha por cada cámara, túnel o mueble, con las fotos de su controlador ahí mismo."
        accion={inst.puntos.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => instalacion(inst, { puntos: [...inst.puntos, puntoVacio()] })}><Plus aria-hidden="true" /> Añadir cámara</Button>}
      >
        {inst.puntos.length === 0 ? (
          <Empty className="border border-dashed py-6 md:py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Snowflake /></EmptyMedia>
              <EmptyTitle className="text-sm">Sin cámaras apuntadas</EmptyTitle>
              <EmptyDescription className="text-[13px]">Apunta cada cámara que se vea en la visita, con la foto de su controlador y de su etiqueta.</EmptyDescription>
            </EmptyHeader>
            <Button type="button" size="sm" onClick={() => instalacion(inst, { puntos: [...inst.puntos, puntoVacio()] })}><Plus aria-hidden="true" /> Añadir la primera cámara</Button>
          </Empty>
        ) : (
          <ol data-slot="lista" className="m-0 flex list-none flex-col gap-3 p-0">
            {inst.puntos.map((p, m) => (
              <li key={p.id} id={`punto-${p.id}`} className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">{m + 1}</span>
                  <strong className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre || `Punto ${m + 1}`}</strong>
                  <Borrar enlace texto="Quitar" seguro="¿Quitar este punto de frío?" alBorrar={() => instalacion(inst, { puntos: inst.puntos.filter((x) => x.id !== p.id) })} />
                </div>
                <div className={FORMULARIO}>
                  <Campo rotulo="Cómo lo llaman" valor={p.nombre} alCambiar={(v) => punto(inst, p, { nombre: v })} placeholder="Cámara 1" maxLength={120} />
                  <Campo rotulo="Qué guarda" valor={p.guarda} alCambiar={(v) => punto(inst, p, { guarda: v })} placeholder="Pescado congelado" maxLength={240} />
                  <Campo rotulo="Temperatura que debe tener" valor={p.temperatura} alCambiar={(v) => punto(inst, p, { temperatura: v })} placeholder="-20 °C" maxLength={60} />
                  <Campo rotulo="Controlador: marca y modelo" valor={p.controlador} alCambiar={(v) => punto(inst, p, { controlador: v })} placeholder="Lo que ponga en la etiqueta" maxLength={240} />
                  <Campo ancho rotulo="Notas" valor={p.notas} alCambiar={(v) => punto(inst, p, { notas: v })} maxLength={2000} />
                </div>
                <FotosDe fotos={fotos.filter((x) => x.punto === p.id)} tipos={["controlador", "etiqueta"]} subiendo={f.subiendo > 0} alSubir={(a, t) => void f.subir(a, t, inst.id, p.id)} alVer={f.ver} alBorrar={(x) => void f.borrarFoto(x)} />
              </li>
            ))}
          </ol>
        )}
      </Seccion>

      <Seccion titulo="La sala y el sitio del aparato" descripcion="Internet, quién lleva la informática y el autómata, y dónde iría el aparato de Gradiox.">
        <div className={FORMULARIO}>
          <Lista<Internet> rotulo="Internet en la sala de los controladores" valor={inst.internet} opciones={INTERNET} alCambiar={(v) => instalacion(inst, { internet: v })} />
          <Campo rotulo="Cobertura del móvil en ese sitio" valor={inst.cobertura} alCambiar={(v) => instalacion(inst, { cobertura: v })} placeholder="Rayas y compañía" maxLength={240} />
          <Campo rotulo="Quién lleva la informática" valor={inst.informatica} alCambiar={(v) => instalacion(inst, { informatica: v })} maxLength={240} />
          <Campo rotulo="Sistema que ya tienen" valor={inst.sistemaActual} alCambiar={(v) => instalacion(inst, { sistemaActual: v })} placeholder="Nombre del programa o pantalla, o «No tienen»" maxLength={2000} />
          <Campo rotulo="Autómata, si lo hay: marca y modelo" valor={inst.automata} alCambiar={(v) => instalacion(inst, { automata: v })} placeholder="Lo que ponga en su frontal, o «No hay»" maxLength={240} />
          <Campo rotulo="Quién programa el autómata" valor={inst.programador} alCambiar={(v) => instalacion(inst, { programador: v })} placeholder="Persona o empresa, y su teléfono" maxLength={240} />
          <Campo ancho lineas={2} rotulo="Dónde iría el aparato" valor={inst.sitioAparato} alCambiar={(v) => instalacion(inst, { sitioAparato: v })} placeholder="Cerca de los controladores, bajo techo y con enchufe" maxLength={2000} />
          <Campo ancho lineas={2} rotulo="Notas de esta instalación" valor={inst.notas} alCambiar={(v) => instalacion(inst, { notas: v })} maxLength={4000} />
        </div>
        <FotosDe fotos={fotos.filter((x) => x.instalacion === inst.id && !inst.puntos.some((p) => p.id === x.punto))} tipos={["sitio", "cuadro", "automata", "sistema", "otra"]} subiendo={f.subiendo > 0} alSubir={(a, t) => void f.subir(a, t, inst.id)} alVer={f.ver} alBorrar={(x) => void f.borrarFoto(x)} />
      </Seccion>

      <Collapsible defaultOpen={abiertoAparato} className="group/aparato rounded-lg border bg-card shadow-xs">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-start gap-3 rounded-lg border-0 bg-transparent px-4 py-4 text-left text-foreground">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold">El aparato de Gradiox</span>
            <span className="text-[13px] text-muted-foreground">{inst.tecnica.soporte === "ordenador" ? "Va como programa en un ordenador del cliente: aquí solo hace falta su identificador" : "Se rellena cuando se pide y se instala"}</span>
          </span>
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/aparato:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <div className={FORMULARIO}>
            <Campo rotulo="Modelo" valor={inst.aparato.modelo} alCambiar={(v) => aparato(inst, { modelo: v })} maxLength={120} />
            <Campo rotulo="Número de serie" valor={inst.aparato.serie} alCambiar={(v) => aparato(inst, { serie: v })} maxLength={120} />
            <Campo rotulo="Identificador con el que entrega lecturas" valor={inst.aparato.pasarela} alCambiar={(v) => aparato(inst, { pasarela: v })} placeholder="El mismo que lleva puesto el aparato" maxLength={64} />
            <Campo rotulo="Día en que se instaló" type="date" valor={inst.aparato.instalado} alCambiar={(v) => aparato(inst, { instalado: v })} />
            <Lista<ConexionAparato> rotulo="Cómo sale a internet" valor={inst.aparato.conexion} opciones={CONEXION_APARATO} alCambiar={(v) => aparato(inst, { conexion: v })} />
            <Campo rotulo="Tarjeta de móvil" valor={inst.aparato.tarjeta} alCambiar={(v) => aparato(inst, { tarjeta: v })} placeholder="Compañía y número, si lleva" maxLength={120} />
            <Campo ancho lineas={2} rotulo="Notas del aparato" valor={inst.aparato.notas} alCambiar={(v) => aparato(inst, { notas: v })} maxLength={2000} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
