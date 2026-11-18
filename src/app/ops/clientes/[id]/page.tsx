"use client";

import { AreaTexto } from "@/components/area-texto";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Check, CloudOff, Images, LoaderCircle, Plus, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import {
  CONEXION_APARATO,
  ESTADOS,
  FASES,
  INTERNET,
  SOLO_LECTURA,
  TIPOS_FOTO,
  TONO,
  TONO_FASE,
  avisos,
  esDocumento,
  faltan,
  haceCuanto,
  instalacionVacia,
  puntoVacio,
  type Aparato,
  type Apunte,
  type Cliente,
  type ConexionAparato,
  type DatosCliente,
  type EstadoCliente,
  type Falta,
  type Fase,
  type Foto,
  type Instalacion,
  type Internet,
  type Lecturas,
  type PuntoFrio,
  type SoloLectura,
  type TipoFoto,
} from "@/clientes/modelo";
import { conJson, pedir, reducirFoto } from "@/clientes/navegador";
import { faltaTecnica, fraseConexion } from "@/clientes/tecnica";
import { usarFicha } from "@/clientes/usar-ficha";

type Paso = "resumen" | "empresa" | "instalacion" | "visita" | "seguimiento";
const PASOS: { id: Paso; texto: string; numero?: number }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "empresa", texto: "Empresa", numero: 1 },
  { id: "instalacion", texto: "Instalación y cámaras", numero: 2 },
  { id: "visita", texto: "Lo que dijo", numero: 3 },
  { id: "seguimiento", texto: "Seguimiento", numero: 4 },
];
/** Los nombres cortos de los botones de foto. */
const BOTON_FOTO: Record<TipoFoto, string> = { controlador: "Controlador", etiqueta: "Etiqueta", cuadro: "Cuadro eléctrico", sitio: "Sitio del aparato", automata: "Autómata", documento: "Documento", sistema: "Sistema que tienen", otra: "Otra foto" };

function Campo({ rotulo, valor, alCambiar, ancho, lineas, ...resto }: { rotulo: string; valor: string; alCambiar: (v: string) => void; ancho?: boolean; lineas?: number; type?: string; placeholder?: string; maxLength?: number; inputMode?: "tel" | "email" | "text" }) {
  return (
    <label className={`gx-campo${ancho ? " ancho" : ""}`}>
      {rotulo}
      {lineas ? <AreaTexto rows={lineas} value={valor} onChange={(ev) => alCambiar(ev.target.value)} placeholder={resto.placeholder} maxLength={resto.maxLength} /> : <input value={valor} onChange={(ev) => alCambiar(ev.target.value)} autoComplete="off" {...resto} />}
    </label>
  );
}

function Lista<T extends string>({ rotulo, valor, opciones, alCambiar }: { rotulo: string; valor: T; opciones: Record<T, string>; alCambiar: (v: T) => void }) {
  return (
    <label className="gx-campo">
      {rotulo}
      <select value={valor} onChange={(ev) => alCambiar(ev.target.value as T)}>
        {(Object.keys(opciones) as T[]).map((k) => (
          <option key={k} value={k}>{opciones[k]}</option>
        ))}
      </select>
    </label>
  );
}

/** Botón que pide una segunda pulsación antes de borrar. */
function Borrar({ texto, seguro, alBorrar, enlace }: { texto: string; seguro: string; alBorrar: () => void; enlace?: boolean }) {
  const [pidiendo, setPidiendo] = useState(false);
  if (!pidiendo)
    return (
      <button type="button" className={enlace ? "gx-boton-enlace" : "gx-boton peligro"} onClick={() => setPidiendo(true)}>
        <Trash2 size={15} strokeWidth={1.7} aria-hidden="true" /> {texto}
      </button>
    );
  return (
    <span className="gx-seguro" role="group" aria-label={seguro}>
      <span>{seguro}</span>
      <button type="button" className="gx-boton peligro" onClick={() => { setPidiendo(false); alBorrar(); }}>Sí, borrar</button>
      <button type="button" className="gx-boton secundario" onClick={() => setPidiendo(false)}>No</button>
    </span>
  );
}

/** Una foto en pequeño: se abre al tocarla y se borra con la papelera de su esquina, preguntando antes. */
function Mini({ foto, alVer, alBorrar }: { foto: Foto; alVer: () => void; alBorrar: () => void }) {
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
function FotosDe({ fotos, tipos, subiendo, alSubir, alVer, alBorrar }: { fotos: Foto[]; tipos: TipoFoto[]; subiendo: boolean; alSubir: (archivos: File[], tipo: TipoFoto) => void; alVer: (f: Foto) => void; alBorrar: (f: Foto) => void }) {
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

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const ir = useRouter();
  const { c, setC, fotos: todas, setFotos, base, fallo, setFallo, estado, lecturas, ahora, cambiar, enviar, cancelar } = usarFicha(id);
  // Los documentos de la ficha técnica se guardan con las fotos, pero aquí no se enseñan.
  const fotos = todas.filter((f) => !esDocumento(f));
  const [subiendo, setSubiendo] = useState(0);
  const [falloFoto, setFalloFoto] = useState("");
  const [grande, setGrande] = useState<Foto | null>(null);
  const [nota, setNota] = useState("");
  const [anotando, setAnotando] = useState(false);
  const [paso, setPaso] = useState<Paso>("resumen");
  const [actual, setActual] = useState("");
  const visor = useRef<HTMLDialogElement>(null);

  // Recién dado de alta se empieza por el primer paso; después, por el resumen.
  useEffect(() => {
    const busca = new URLSearchParams(window.location.search);
    if (busca.get("nuevo")) setPaso("empresa");
    const inst = busca.get("i");
    if (inst) {
      setPaso("instalacion");
      setActual(inst);
    }
  }, []);

  useEffect(() => {
    if (grande) visor.current?.showModal();
  }, [grande]);

  if (!c)
    return (
      <>
        <Link href="/ops" className="gx-volver"><ArrowLeft size={18} aria-hidden="true" /> Clientes</Link>
        <p className="gx-sub" role={fallo ? "alert" : undefined}>{fallo || "Abriendo la ficha…"}</p>
      </>
    );

  const irA = (p: Paso, instalacionId?: string, puntoId?: string) => {
    setPaso(p);
    if (instalacionId) setActual(instalacionId);
    // Tras pintar el paso, se lleva la vista a la cámara que toca o al principio.
    window.setTimeout(() => {
      const destino = puntoId ? document.getElementById(`punto-${puntoId}`) : null;
      if (destino) destino.scrollIntoView({ behavior: "smooth", block: "center" });
      else document.getElementById("gx-pasos")?.scrollIntoView({ block: "start" });
    }, 60);
  };
  const instalacion = (i: Instalacion, parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === i.id ? { ...x, ...parte } : x)) });
  const aparato = (i: Instalacion, parte: Partial<Aparato>) => instalacion(i, { aparato: { ...i.aparato, ...parte } });
  const punto = (i: Instalacion, p: PuntoFrio, parte: Partial<PuntoFrio>) => instalacion(i, { puntos: i.puntos.map((x) => (x.id === p.id ? { ...x, ...parte } : x)) });
  const nombreSitio = (f: Foto) => {
    const i = c.instalaciones.find((x) => x.id === f.instalacion);
    const p = i?.puntos.find((x) => x.id === f.punto);
    return [i && c.instalaciones.length > 1 ? i.nombre : "", p?.nombre].filter(Boolean).join(" · ");
  };
  const anadirInstalacion = () => {
    const nueva = instalacionVacia();
    cambiar({ instalaciones: [...c.instalaciones, nueva] });
    setActual(nueva.id);
  };

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
  const cuantas = (p: Paso) => porRecoger.filter((f) => f.paso === p).length;
  const total = c.instalaciones.reduce((n, i) => n + i.puntos.length, 0);
  const inst = c.instalaciones.find((i) => i.id === actual) ?? c.instalaciones[0];
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
    <>
      <Link href="/ops" className="gx-volver"><ArrowLeft size={18} aria-hidden="true" /> Clientes</Link>
      <header className="gx-cabecera">
        <div>
          <h1 className="gx-corta">{c.nombre || "Cliente sin nombre"}</h1>
          <p className="gx-sub gx-ficha-estado">
            <span className={`gx-chip ${TONO[c.estado]}`}>{ESTADOS[c.estado]}</span>
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
          </p>
        </div>
      </header>

      <nav id="gx-pasos" className="gx-pasos" aria-label="Partes de la ficha">
        {PASOS.map((p) => (
          <button key={p.id} type="button" aria-current={paso === p.id ? "step" : undefined} onClick={() => irA(p.id)}>
            {p.numero && <i aria-hidden="true">{p.numero}</i>}
            {p.texto}
            {p.id !== "resumen" && cuantas(p.id) > 0 && <span className="faltan" aria-label={`Faltan ${cuantas(p.id)} cosas`}>{cuantas(p.id)}</span>}
            {p.numero && p.id !== "seguimiento" && cuantas(p.id) === 0 && <Check size={14} aria-label="Completo" className="completo" />}
          </button>
        ))}
      </nav>

      <div className="gx-pila">
        {!base && <SinBase />}
        {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
        {falloFoto && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{falloFoto}</p>}

        {paso === "resumen" && (
          <>
            <div className="gx-patron">
              <section className="gx-tarjeta realce gx-foco" aria-label="Próximo paso">
                <span className="gx-chip">{porRecoger.length ? `Faltan ${porRecoger.length} ${porRecoger.length === 1 ? "cosa" : "cosas"} por recoger` : "Ficha completa"}</span>
                <p className="titular">{c.proximo.texto || "Sin próximo paso apuntado"}</p>
                <p className="detalle">{c.proximo.fecha ? `Para el ${new Date(`${c.proximo.fecha}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : "Apunta qué toca hacer ahora con este cliente y para cuándo."}</p>
                <button type="button" className="gx-boton" onClick={() => irA("seguimiento")}>{c.proximo.texto ? "Cambiar" : "Apuntarlo"}</button>
              </section>
              <div className="gx-cifras sueltas tres">
                <div><span>Instalaciones</span><strong>{c.instalaciones.length}</strong></div>
                <div><span>Puntos de frío</span><strong>{total}</strong></div>
                <div><span>Fotos</span><strong>{fotos.length}</strong></div>
              </div>
            </div>

            <div className="gx-dos igual">
              <section className="gx-tarjeta">
                <h2>Falta por recoger · {porRecoger.length}</h2>
                {porRecoger.length === 0 ? (
                  <p className="gx-vacio">Está todo lo de la guía de visita.</p>
                ) : (
                  <ul className="gx-faltan">
                    {porRecoger.map((f: Falta) => (
                      <li key={`${f.instalacion ?? ""}${f.punto ?? ""}${f.texto}`}>
                        <button type="button" onClick={() => irA(f.paso, f.instalacion, f.punto)}>
                          <span>{f.texto.charAt(0).toUpperCase() + f.texto.slice(1)}</span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="gx-tarjeta">
                <h2>Instalaciones · {c.instalaciones.length}</h2>
                {c.instalaciones.length === 0 ? (
                  <p className="gx-vacio">Sin instalaciones todavía.</p>
                ) : (
                  <ul className="gx-faltan">
                    {c.instalaciones.map((i, n) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => irA("instalacion", i.id)}>
                          <span>
                            <strong>{i.nombre || `Instalación ${n + 1}`}</strong> · {i.puntos.length === 1 ? "1 punto de frío" : `${i.puntos.length} puntos de frío`}
                            <small className="gx-lee">{lee(i)}</small>
                          </span>
                          <span className={`gx-chip ${TONO_FASE[i.fase]}`}>{FASES[i.fase]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pendientes.length > 0 && (
                  <>
                    <h3 className="gx-subtitulo">Pide atención</h3>
                    <ul className="gx-lista gx-compro">
                      {pendientes.map((a) => (
                        <li key={a.texto}>
                          <span className={`gx-punto ${a.nivel}`} role="img" aria-label={a.nivel === "mal" ? "Falla" : "Por mirar"} />
                          <span>{a.texto}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {paso === "empresa" && (
          <>
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
            {siguiente("instalacion", "Seguir con la instalación y las cámaras")}
          </>
        )}

        {paso === "instalacion" && (
          <>
            {(c.instalaciones.length > 1 || !inst) && (
              <div className="gx-cuales" role="group" aria-label="Instalaciones de este cliente">
                {c.instalaciones.map((i, n) => (
                  <button key={i.id} type="button" className="gx-pildora" aria-pressed={inst?.id === i.id} onClick={() => setActual(i.id)}>
                    {i.nombre || `Instalación ${n + 1}`}
                  </button>
                ))}
              </div>
            )}

            {!inst ? (
              <section className="gx-tarjeta gx-anadir">
                <div>
                  <h2>Sin instalaciones todavía</h2>
                  <p className="gx-nota">Una instalación es un sitio con frío: una nave, una tienda, un almacén. Dentro se apuntan sus cámaras, cada una con sus fotos.</p>
                </div>
                <button type="button" className="gx-boton" onClick={anadirInstalacion}><Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Añadir instalación</button>
              </section>
            ) : (
              <>
                <section className="gx-tarjeta" aria-label="Datos de la instalación">
                  <div className="gx-lista-cabeza">
                    <h2 className="gx-con-chip">{inst.nombre || "Instalación"} <span className={`gx-chip ${TONO_FASE[inst.fase]}`}>{FASES[inst.fase]}</span></h2>
                    <small className="gx-lee">{lee(inst)}</small>
                  </div>
                  <div className="gx-formulario gx-ficha">
                    <Campo rotulo="Nombre de la instalación" valor={inst.nombre} alCambiar={(v) => instalacion(inst, { nombre: v })} placeholder="Por ejemplo: nave de Getafe" maxLength={120} />
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
                          <FotosDe fotos={fotos.filter((f) => f.punto === p.id)} tipos={["controlador", "etiqueta"]} subiendo={subiendo > 0} alSubir={(a, t) => void subir(a, t, inst.id, p.id)} alVer={setGrande} alBorrar={(f) => void borrarFoto(f)} />
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
                    <Campo ancho lineas={2} rotulo="Notas de esta instalación" valor={inst.notas} alCambiar={(v) => instalacion(inst, { notas: v })} maxLength={4000} />
                  </div>
                  <FotosDe fotos={fotos.filter((f) => f.instalacion === inst.id && !inst.puntos.some((p) => p.id === f.punto))} tipos={["sitio", "cuadro", "automata", "sistema", "otra"]} subiendo={subiendo > 0} alSubir={(a, t) => void subir(a, t, inst.id)} alVer={setGrande} alBorrar={(f) => void borrarFoto(f)} />
                </section>

                <Link href={`/ops/clientes/${id}/tecnica?i=${inst.id}`} className="gx-tarjeta gx-a-tecnica">
                  <span>
                    <b>Ficha técnica</b>
                    <small>{fraseConexion(inst)}</small>
                  </span>
                  <span className={`gx-chip ${faltaTecnica(inst).length ? "aviso" : "correcto"}`}>{faltaTecnica(inst).length ? `Faltan ${faltaTecnica(inst).length}` : "Completa"}</span>
                  <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" />
                </Link>

                <details className="gx-tarjeta gx-plegable" open={Boolean(inst.aparato.pasarela || inst.aparato.modelo || inst.aparato.serie) || ["pedido", "instalando", "leyendo", "incidencia"].includes(inst.fase)}>
                  <summary><h2>Aparato de Gradiox</h2><small>Se rellena cuando se pide y se instala</small></summary>
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

                <div className="gx-siguiente doble">
                  <span className="gx-acciones-cabecera">
                    <button type="button" className="gx-boton secundario" onClick={anadirInstalacion}><Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Otra instalación</button>
                    <Borrar enlace texto="Quitar esta instalación" seguro="¿Quitar la instalación y sus cámaras?" alBorrar={() => { cambiar({ instalaciones: c.instalaciones.filter((x) => x.id !== inst.id) }); setActual(""); }} />
                  </span>
                  <button type="button" className="gx-boton" onClick={() => irA("visita")}>Seguir con lo que dijo el cliente <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" /></button>
                </div>
              </>
            )}
          </>
        )}

        {paso === "visita" && (
          <>
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
            {siguiente("seguimiento", "Seguir con el próximo paso")}
          </>
        )}

        {paso === "seguimiento" && (
          <>
            <section className="gx-tarjeta" aria-labelledby="f-paso">
              <h2 id="f-paso">Próximo paso</h2>
              <div className="gx-formulario gx-ficha gx-paso tres">
                <Campo rotulo="Qué hay que hacer ahora" valor={c.proximo.texto} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, texto: v } })} placeholder="Por ejemplo: enviar la propuesta" maxLength={240} />
                <Campo rotulo="Para cuándo" type="date" valor={c.proximo.fecha} alCambiar={(v) => cambiar({ proximo: { ...c.proximo, fecha: v } })} />
                <Lista<EstadoCliente> rotulo="En qué punto está el cliente" valor={c.estado} opciones={ESTADOS} alCambiar={(v) => cambiar({ estado: v })} />
                <Campo ancho lineas={3} rotulo="Notas internas" valor={c.notas} alCambiar={(v) => cambiar({ notas: v })} maxLength={8000} />
              </div>
            </section>

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
          </>
        )}
      </div>

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
    </>
  );
}
