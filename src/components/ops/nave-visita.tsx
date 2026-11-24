"use client";

// Lo que se apunta de una nave en la visita: sus datos, sus cámaras con las fotos de
// cada controlador, la sala y el sitio del aparato. Es la primera pestaña de la nave.

import { Plus } from "lucide-react";
import { CONEXION_APARATO, FASES, INTERNET, TONO_FASE, esDocumento, haceCuanto, puntoVacio, type Aparato, type ConexionAparato, type Fase, type Instalacion, type Internet, type PuntoFrio } from "@/clientes/modelo";
import type { usarFicha } from "@/clientes/usar-ficha";
import { Borrar, Campo, FotosDe, Lista, type usarFotos } from "./ficha-piezas";

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
    if (!l) return <><span className="gx-punto mirar" /> El aparato {i.aparato.pasarela} no ha entregado lecturas todavía.</>;
    const callado = ahora - l.ultima > 15 * 60_000;
    return <><span className={`gx-punto ${callado ? "mal" : "bien"}`} /> {callado ? "Sin lecturas desde hace" : "Leyendo. Última lectura hace"} {haceCuanto(ahora - l.ultima)} · {l.equipos === 1 ? "1 equipo" : `${l.equipos} equipos`}</>;
  };

  return (
    <div className="flex flex-col gap-4">
    <section className="gx-tarjeta" aria-label="Datos de la nave">
      <div className="gx-lista-cabeza">
        <h2>La nave</h2>
        <small className="gx-lee">{lee(inst)}</small>
      </div>
      <div className="gx-formulario gx-ficha">
        <Campo rotulo="Nombre de la nave" valor={inst.nombre} alCambiar={(v) => instalacion(inst, { nombre: v })} placeholder="Por ejemplo: nave de Getafe" maxLength={120} />
        <Lista<Fase> rotulo="En qué fase está" valor={inst.fase} opciones={FASES} alCambiar={(v) => instalacion(inst, { fase: v })} />
        <Campo ancho rotulo="Dirección, si no es la de la empresa" valor={inst.direccion} alCambiar={(v) => instalacion(inst, { direccion: v })} maxLength={240} />
      </div>
    </section>

    <section className="gx-tarjeta" aria-labelledby="f-puntos">
      <h2 id="f-puntos">Cámaras y puntos de frío · {inst.puntos.length}</h2>
      <p className="gx-nota">Una ficha por cada cámara, túnel o mueble, con las fotos de su controlador ahí mismo.</p>
      {inst.puntos.length > 0 && (
        <ol className="gx-camaras">
          {inst.puntos.map((p, m) => (
            <li key={p.id} id={`punto-${p.id}`}>
              <div className="cabeza">
                <span className="numero" aria-hidden="true">{m + 1}</span>
                <strong>{p.nombre || `Punto ${m + 1}`}</strong>
                <Borrar enlace texto="Quitar" seguro="¿Quitar este punto de frío?" alBorrar={() => instalacion(inst, { puntos: inst.puntos.filter((x) => x.id !== p.id) })} />
              </div>
              <div className="gx-formulario">
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
      <button type="button" className={inst.puntos.length ? "gx-boton secundario" : "gx-boton"} style={{ marginTop: 12 }} onClick={() => instalacion(inst, { puntos: [...inst.puntos, puntoVacio()] })}>
        <Plus size={16} strokeWidth={1.7} aria-hidden="true" /> {inst.puntos.length ? "Añadir otra cámara" : "Añadir la primera cámara"}
      </button>
    </section>

    <section className="gx-tarjeta" aria-labelledby="f-sala">
      <h2 id="f-sala">La sala y el sitio del aparato</h2>
      <div className="gx-formulario gx-ficha">
        <Lista<Internet> rotulo="Internet en la sala de los controladores" valor={inst.internet} opciones={INTERNET} alCambiar={(v) => instalacion(inst, { internet: v })} />
        <Campo rotulo="Cobertura del móvil en ese sitio" valor={inst.cobertura} alCambiar={(v) => instalacion(inst, { cobertura: v })} placeholder="Rayas y compañía" maxLength={240} />
        <Campo rotulo="Quién lleva la informática" valor={inst.informatica} alCambiar={(v) => instalacion(inst, { informatica: v })} maxLength={240} />
        <Campo rotulo="Sistema que ya tienen" valor={inst.sistemaActual} alCambiar={(v) => instalacion(inst, { sistemaActual: v })} placeholder="Nombre del programa o pantalla, o «No tienen»" maxLength={2000} />
        <Campo rotulo="Autómata, si lo hay: marca y modelo" valor={inst.automata} alCambiar={(v) => instalacion(inst, { automata: v })} placeholder="Lo que ponga en su frontal, o «No hay»" maxLength={240} />
        <Campo rotulo="Quién programa el autómata" valor={inst.programador} alCambiar={(v) => instalacion(inst, { programador: v })} placeholder="Persona o empresa, y su teléfono" maxLength={240} />
        <Campo ancho lineas={2} rotulo="Dónde iría el aparato" valor={inst.sitioAparato} alCambiar={(v) => instalacion(inst, { sitioAparato: v })} placeholder="Cerca de los controladores, bajo techo y con enchufe" maxLength={2000} />
        <Campo ancho lineas={2} rotulo="Notas de esta nave" valor={inst.notas} alCambiar={(v) => instalacion(inst, { notas: v })} maxLength={4000} />
      </div>
      <FotosDe fotos={fotos.filter((x) => x.instalacion === inst.id && !inst.puntos.some((p) => p.id === x.punto))} tipos={["sitio", "cuadro", "automata", "sistema", "otra"]} subiendo={f.subiendo > 0} alSubir={(a, t) => void f.subir(a, t, inst.id)} alVer={f.ver} alBorrar={(x) => void f.borrarFoto(x)} />
    </section>


    <details className="gx-tarjeta gx-plegable" open={Boolean(inst.aparato.pasarela || inst.aparato.modelo || inst.aparato.serie) || ["pedido", "instalando", "leyendo", "incidencia"].includes(inst.fase)}>
      <summary><h2>El aparato de Gradiox</h2><small>{inst.tecnica.soporte === "ordenador" ? "Va como programa en un ordenador del cliente: aquí solo hace falta su identificador" : "Se rellena cuando se pide y se instala"}</small></summary>
      <div className="gx-formulario gx-ficha">
        <Campo rotulo="Modelo" valor={inst.aparato.modelo} alCambiar={(v) => aparato(inst, { modelo: v })} maxLength={120} />
        <Campo rotulo="Número de serie" valor={inst.aparato.serie} alCambiar={(v) => aparato(inst, { serie: v })} maxLength={120} />
        <Campo rotulo="Identificador con el que entrega lecturas" valor={inst.aparato.pasarela} alCambiar={(v) => aparato(inst, { pasarela: v })} placeholder="El mismo que lleva puesto el aparato" maxLength={64} />
        <Campo rotulo="Día en que se instaló" type="date" valor={inst.aparato.instalado} alCambiar={(v) => aparato(inst, { instalado: v })} />
        <Lista<ConexionAparato> rotulo="Cómo sale a internet" valor={inst.aparato.conexion} opciones={CONEXION_APARATO} alCambiar={(v) => aparato(inst, { conexion: v })} />
        <Campo rotulo="Tarjeta de móvil" valor={inst.aparato.tarjeta} alCambiar={(v) => aparato(inst, { tarjeta: v })} placeholder="Compañía y número, si lleva" maxLength={120} />
        <Campo ancho lineas={2} rotulo="Notas del aparato" valor={inst.aparato.notas} alCambiar={(v) => aparato(inst, { notas: v })} maxLength={2000} />
      </div>
    </details>
    </div>
  );
}
