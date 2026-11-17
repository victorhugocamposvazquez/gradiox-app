"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CloudOff, Download, FileText, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SinBase } from "@/components/sin-base";
import { INTERNET, MAX_FOTO, MIMES_FOTO, esDocumento, type Foto, type Instalacion, type Internet } from "@/clientes/modelo";
import { pedir, reducirFoto } from "@/clientes/navegador";
import {
  ACCESOS,
  ENCHUFAR,
  GOBIERNO,
  MAX_SENALES,
  PERMISOS,
  TIPOS_SENAL,
  USUARIOS,
  VIAS,
  faltaTecnica,
  fraseConexion,
  senalVacia,
  senalesDeTexto,
  type Acceso,
  type Enchufar,
  type Gobierno,
  type Permiso,
  type Senal,
  type Tecnica,
  type TipoSenal,
  type UsuarioGradiox,
  type Via,
} from "@/clientes/tecnica";
import { usarFicha } from "@/clientes/usar-ficha";

/** Un dato de la ficha: su nombre, una línea que explica qué es y dónde se escribe. */
function Dato({ campo, rotulo, ayuda, ancho, children }: { campo: string; rotulo: string; ayuda?: string; ancho?: boolean; children: ReactNode }) {
  return (
    <label id={`t-${campo}`} className={`gx-campo gx-dato${ancho ? " ancho" : ""}`}>
      <span>{rotulo}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

function Opciones<T extends string>({ valor, opciones, alCambiar }: { valor: T; opciones: Record<T, string>; alCambiar: (v: T) => void }) {
  return (
    <select value={valor} onChange={(ev) => alCambiar(ev.target.value as T)}>
      {(Object.keys(opciones) as T[]).map((k) => (
        <option key={k} value={k}>{opciones[k]}</option>
      ))}
    </select>
  );
}

const peso = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

export default function FichaTecnica() {
  const { id } = useParams<{ id: string }>();
  const { c, fotos, setFotos, base, fallo, estado, cambiar, enviar } = usarFicha(id);
  const [actual, setActual] = useState("");
  const [pegado, setPegado] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [falloDoc, setFalloDoc] = useState("");

  useEffect(() => {
    const inst = new URLSearchParams(window.location.search).get("i");
    if (inst) setActual(inst);
  }, []);

  if (!c)
    return (
      <>
        <Link href={`/ops/clientes/${id}`} className="gx-volver"><ArrowLeft size={18} aria-hidden="true" /> Ficha del cliente</Link>
        <p className="gx-sub" role={fallo ? "alert" : undefined}>{fallo || "Abriendo la ficha técnica…"}</p>
      </>
    );

  const inst = c.instalaciones.find((i) => i.id === actual) ?? c.instalaciones[0];
  if (!inst)
    return (
      <>
        <Link href={`/ops/clientes/${id}`} className="gx-volver"><ArrowLeft size={18} aria-hidden="true" /> {c.nombre}</Link>
        <header className="gx-cabecera"><div><h1>Ficha técnica</h1></div></header>
        <section className="gx-tarjeta gx-anadir">
          <div>
            <h2>Este cliente no tiene instalaciones todavía</h2>
            <p className="gx-nota">La ficha técnica es de cada instalación. Primero apunta la instalación y sus cámaras en la ficha del cliente.</p>
          </div>
          <Link href={`/ops/clientes/${id}?nuevo=1`} className="gx-boton">Ir a la ficha del cliente <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" /></Link>
        </section>
      </>
    );

  const t = inst.tecnica;
  const instalacion = (parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === inst.id ? { ...x, ...parte } : x)) });
  const tecnica = (parte: Partial<Tecnica>) => instalacion({ tecnica: { ...t, ...parte } });
  const senal = (s: Senal, parte: Partial<Senal>) => tecnica({ senales: t.senales.map((x) => (x.id === s.id ? { ...x, ...parte } : x)) });
  const faltas = faltaTecnica(inst);
  const documentos = fotos.filter((f) => esDocumento(f) && f.instalacion === inst.id);
  const conAutomata = t.gobierno === "automata" || t.gobierno === "mixto";
  const nombreInst = inst.nombre || "Instalación";

  const irA = (campo: string) => {
    const destino = document.getElementById(`t-${campo}`);
    destino?.scrollIntoView({ behavior: "smooth", block: "center" });
    destino?.querySelector<HTMLElement>("input, select, textarea, button, a")?.focus({ preventScroll: true });
  };
  const pegar = () => {
    const nuevas = senalesDeTexto(pegado);
    if (!nuevas.length) return;
    tecnica({ senales: [...t.senales, ...nuevas].slice(0, MAX_SENALES) });
    setPegado("");
  };
  const subir = async (archivos: File[]) => {
    setFalloDoc("");
    setSubiendo(true);
    for (const archivo of archivos) {
      try {
        const esFoto = MIMES_FOTO.includes(archivo.type) || archivo.type.startsWith("image/");
        const contenido = esFoto ? await reducirFoto(archivo) : archivo;
        if (contenido.size > MAX_FOTO) throw new Error(`«${archivo.name}» pesa demasiado (máximo 4 MB)`);
        const cuerpo = new FormData();
        cuerpo.set("foto", contenido, archivo.name);
        cuerpo.set("tipo", "documento");
        cuerpo.set("instalacion", inst.id);
        cuerpo.set("pie", archivo.name);
        const d = await pedir<{ foto: Foto }>(`/api/ops/clientes/${id}/fotos`, { method: "POST", body: cuerpo });
        setFotos((f) => [...f, d.foto]);
      } catch (e) {
        setFalloDoc(e instanceof Error ? e.message : "No se ha podido subir el documento");
      }
    }
    setSubiendo(false);
  };
  const borrarDoc = async (f: Foto) => {
    try {
      await pedir(`/api/ops/fotos/${f.id}`, { method: "DELETE" });
      setFotos((l) => l.filter((x) => x.id !== f.id));
    } catch (e) {
      setFalloDoc(e instanceof Error ? e.message : "No se ha podido borrar el documento");
    }
  };

  return (
    <>
      <Link href={`/ops/clientes/${id}?i=${inst.id}`} className="gx-volver"><ArrowLeft size={18} aria-hidden="true" /> {c.nombre}</Link>
      <header className="gx-cabecera">
        <div>
          <h1 className="gx-corta">Ficha técnica · {nombreInst}</h1>
          <p className="gx-sub gx-ficha-estado">
            <span>Cómo se conecta Gradiox a esta instalación</span>
            <span className={`gx-guardado ${estado}`} role="status">
              {estado === "guardado" && <><Check size={15} aria-hidden="true" /> Guardado</>}
              {estado === "pendiente" && "Sin guardar todavía"}
              {estado === "guardando" && <><LoaderCircle size={15} aria-hidden="true" className="gx-gira" /> Guardando…</>}
              {estado === "fallo" && (
                <>
                  <CloudOff size={15} aria-hidden="true" /> No se ha guardado
                  <button type="button" className="gx-boton-enlace" onClick={() => void enviar()}>Reintentar</button>
                </>
              )}
            </span>
          </p>
        </div>
      </header>

      {c.instalaciones.length > 1 && (
        <div className="gx-cuales" role="group" aria-label="Instalaciones de este cliente">
          {c.instalaciones.map((i, n) => (
            <button key={i.id} type="button" className="gx-pildora" aria-pressed={inst.id === i.id} onClick={() => setActual(i.id)}>
              {i.nombre || `Instalación ${n + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="gx-pila">
        {!base && <SinBase />}

        <div className="gx-patron">
          <section className="gx-tarjeta realce gx-foco" aria-label="Cómo se conecta">
            <span className="gx-chip">{faltas.length ? `Faltan ${faltas.length} ${faltas.length === 1 ? "dato" : "datos"} para poder conectar` : "Hay todo lo necesario para conectar"}</span>
            <h2>{fraseConexion(inst)}</h2>
            <p>{[t.permiso ? PERMISOS[t.permiso] : "", t.via === "opcua" && t.usuario ? `Acceso de Gradiox: ${USUARIOS[t.usuario].toLowerCase()}` : "", t.direccion].filter(Boolean).join(" · ") || "Rellena los apartados de abajo en orden. Cada dato dice para qué sirve."}</p>
          </section>
          <div className="gx-cifras sueltas tres">
            <div><span>Cámaras</span><strong>{inst.puntos.length}</strong></div>
            <div><span>Señales</span><strong>{t.senales.length}</strong></div>
            <div><span>Documentos</span><strong>{documentos.length}</strong></div>
          </div>
        </div>

        <div className="gx-tecnica">
          <aside className="gx-tarjeta gx-tecnica-falta" aria-labelledby="t-falta">
            <h2 id="t-falta">Falta por saber · {faltas.length}</h2>
            {faltas.length === 0 ? (
              <p className="gx-vacio">Nada. Con esto se puede preparar la conexión.</p>
            ) : (
              <ul className="gx-faltan">
                {faltas.map((f) => (
                  <li key={f.campo + f.texto}>
                    <button type="button" onClick={() => irA(f.campo)}>
                      <span>{f.texto}</span>
                      <ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="gx-nota">Solo se pide lo que hace falta según lo que haya en la instalación.</p>
          </aside>

          <div className="gx-pila">
            <section className="gx-tarjeta" aria-labelledby="t-s1">
              <h2 id="t-s1"><span className="gx-orden">1</span> Qué gobierna el frío</h2>
              <p className="gx-nota">De esto depende todo lo demás. En una instalación grande suele haber un autómata; en una pequeña, un controlador por cámara.</p>
              <div className="gx-formulario gx-ficha">
                <Dato campo="gobierno" rotulo="Qué hay" ayuda="Pregunta: «¿hay un autómata que lo gobierne todo?»">
                  <Opciones<Gobierno> valor={t.gobierno} opciones={GOBIERNO} alCambiar={(v) => tecnica({ gobierno: v })} />
                </Dato>
                <Dato campo="sistema" rotulo="Programa o pantalla que ya usan" ayuda="Donde ven hoy todas las cámaras juntas, si lo tienen.">
                  <input value={inst.sistemaActual} maxLength={2000} placeholder="Nombre, o «No tienen»" onChange={(ev) => instalacion({ sistemaActual: ev.target.value })} />
                </Dato>
                {conAutomata && (
                  <>
                    <Dato campo="automata" rotulo="Autómata: marca y modelo" ayuda="Lo que pone en su frontal.">
                      <input value={inst.automata} maxLength={240} placeholder="Por ejemplo: Siemens S7-1500" onChange={(ev) => instalacion({ automata: ev.target.value })} />
                    </Dato>
                    <Dato campo="cpu" rotulo="CPU exacta y versión" ayuda="El número del modelo y la versión de su programa interno. Lo sabe quien lo programa.">
                      <input value={t.cpu} maxLength={240} placeholder="Por ejemplo: CPU 1513, versión 2.9" onChange={(ev) => tecnica({ cpu: ev.target.value })} />
                    </Dato>
                  </>
                )}
              </div>
              <div id="t-camaras" className="gx-tecnica-camaras">
                <div className="gx-lista-cabeza">
                  <h3 className="gx-subtitulo">Cámaras y su controlador · {inst.puntos.length}</h3>
                  <Link href={`/ops/clientes/${id}?i=${inst.id}`} className="gx-boton-enlace">Cambiar en la ficha del cliente</Link>
                </div>
                {inst.puntos.length === 0 ? (
                  <p className="gx-vacio">Sin cámaras apuntadas.</p>
                ) : (
                  <ul className="gx-lista gx-compro">
                    {inst.puntos.map((p, n) => (
                      <li key={p.id}>
                        <span><b>{p.nombre || `Cámara ${n + 1}`}</b>{p.temperatura ? ` · ${p.temperatura}` : ""}</span>
                        <small>{p.controlador || (t.gobierno === "automata" ? "La lee el autómata" : "Controlador sin apuntar")}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s2">
              <h2 id="t-s2"><span className="gx-orden">2</span> Cómo se conecta Gradiox</h2>
              <p className="gx-nota">Por dónde lee el aparato de Gradiox y con qué permiso. Las contraseñas no se apuntan aquí.</p>
              <div className="gx-formulario gx-ficha">
                <Dato campo="via" rotulo="Vía de conexión" ayuda="Con autómata, lo normal es OPC UA. Con controladores sueltos, Modbus.">
                  <Opciones<Via> valor={t.via} opciones={VIAS} alCambiar={(v) => tecnica({ via: v })} />
                </Dato>
                <Dato campo="permiso" rotulo="Qué puede hacer Gradiox" ayuda="Se empieza solo leyendo. Las órdenes se acuerdan aparte.">
                  <Opciones<Permiso> valor={t.permiso} opciones={PERMISOS} alCambiar={(v) => tecnica({ permiso: v })} />
                </Dato>
                {t.via !== "modbus-rtu" && (
                  <Dato campo="direccion" rotulo="Dirección del equipo en la red" ayuda="Una serie de números como 192.168.0.10, y el puerto. La da quien lo programa o el informático.">
                    <input value={t.direccion} maxLength={240} placeholder="192.168.0.10, puerto 4840" onChange={(ev) => tecnica({ direccion: ev.target.value })} />
                  </Dato>
                )}
                {t.via === "opcua" && (
                  <>
                    <Dato campo="acceso" rotulo="Cómo se entra" ayuda="Lo que pide el autómata para dejar leer.">
                      <Opciones<Acceso> valor={t.acceso} opciones={ACCESOS} alCambiar={(v) => tecnica({ acceso: v })} />
                    </Dato>
                    <Dato campo="usuario" rotulo="Acceso de solo lectura para Gradiox" ayuda="Hay que pedírselo a quien programa el autómata. Aquí solo se apunta si ya está.">
                      <Opciones<UsuarioGradiox> valor={t.usuario} opciones={USUARIOS} alCambiar={(v) => tecnica({ usuario: v })} />
                    </Dato>
                  </>
                )}
              </div>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s3">
              <h2 id="t-s3"><span className="gx-orden">3</span> A quién preguntar</h2>
              <p className="gx-nota">Las personas que saben de esta instalación, con su teléfono.</p>
              <div className="gx-formulario gx-ficha">
                {conAutomata && (
                  <Dato campo="programador" rotulo="Quién programa el autómata" ayuda="Es quien abre la lectura y pasa la lista de señales.">
                    <input value={inst.programador} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ programador: ev.target.value })} />
                  </Dato>
                )}
                <Dato campo="mantenedor" rotulo="Quién mantiene el frío" ayuda="Persona o empresa instaladora. Vale para todo el cliente.">
                  <input value={[c.mantenedor.nombre, c.mantenedor.telefono].filter(Boolean).join(" · ")} readOnly placeholder="Se apunta en la ficha del cliente, paso Empresa" />
                </Dato>
                <Dato campo="informatica" rotulo="Quién lleva la informática" ayuda="Por si hay que pedir permiso para conectar un aparato a la red.">
                  <input value={inst.informatica} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ informatica: ev.target.value })} />
                </Dato>
              </div>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s4">
              <h2 id="t-s4"><span className="gx-orden">4</span> Red y sitio del aparato</h2>
              <p className="gx-nota">Dónde va el aparato de Gradiox y por dónde sale a internet.</p>
              <div className="gx-formulario gx-ficha">
                <Dato campo="enchufar" rotulo="¿Se puede enchufar un aparato a la red de los equipos?" ayuda="Con un cable de red, al mismo sitio donde está el autómata o los controladores.">
                  <Opciones<Enchufar> valor={t.enchufar} opciones={ENCHUFAR} alCambiar={(v) => tecnica({ enchufar: v })} />
                </Dato>
                <Dato campo="internet" rotulo="Internet en la sala" ayuda="Si no hay, el aparato lleva su propia tarjeta de móvil.">
                  <Opciones<Internet> valor={inst.internet} opciones={INTERNET} alCambiar={(v) => instalacion({ internet: v })} />
                </Dato>
                <Dato campo="sitio" ancho rotulo="Dónde iría el aparato">
                  <input value={inst.sitioAparato} maxLength={2000} placeholder="Cerca de los equipos, bajo techo y con enchufe" onChange={(ev) => instalacion({ sitioAparato: ev.target.value })} />
                </Dato>
              </div>
            </section>

            <section id="t-senales" className="gx-tarjeta" aria-labelledby="t-s5">
              <h2 id="t-s5"><span className="gx-orden">5</span> Señales · {t.senales.length}</h2>
              <p className="gx-nota">Cada dato que se lee: su nombre tal como está en el equipo, qué es y de qué cámara. Con autómata, la lista la pasa quien lo programa.</p>
              {t.senales.length > 0 && (
                <ol className="gx-senales">
                  {t.senales.map((s) => (
                    <li key={s.id}>
                      <input aria-label="Nombre de la señal en el equipo" className="nombre" value={s.nombre} maxLength={160} placeholder="Nombre en el equipo" onChange={(ev) => senal(s, { nombre: ev.target.value })} />
                      <select aria-label="Qué es" value={s.tipo} onChange={(ev) => senal(s, { tipo: ev.target.value as TipoSenal })}>
                        {(Object.keys(TIPOS_SENAL) as TipoSenal[]).map((k) => <option key={k} value={k}>{TIPOS_SENAL[k]}</option>)}
                      </select>
                      <select aria-label="De qué cámara" value={s.punto} onChange={(ev) => senal(s, { punto: ev.target.value })}>
                        <option value="">Toda la instalación</option>
                        {inst.puntos.map((p, n) => <option key={p.id} value={p.id}>{p.nombre || `Cámara ${n + 1}`}</option>)}
                      </select>
                      <label className="escribe"><input type="checkbox" checked={s.escribe} onChange={(ev) => senal(s, { escribe: ev.target.checked })} /> Se puede cambiar</label>
                      <button type="button" className="gx-boton-enlace" aria-label={`Quitar la señal ${s.nombre}`} onClick={() => tecnica({ senales: t.senales.filter((x) => x.id !== s.id) })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="gx-senales-pie">
                <button type="button" className="gx-boton secundario" disabled={t.senales.length >= MAX_SENALES} onClick={() => tecnica({ senales: [...t.senales, senalVacia()] })}><Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Añadir una señal</button>
              </div>
              <details className="gx-pegar">
                <summary>Pegar una lista entera</summary>
                <label className="gx-campo">
                  Una señal por línea. Si pegas desde una hoja de cálculo, se usa la primera columna.
                  <textarea rows={5} value={pegado} onChange={(ev) => setPegado(ev.target.value)} placeholder={"Camara1_Temperatura\nCamara1_Alarma\nCamara1_Consigna"} />
                </label>
                <button type="button" className="gx-boton" disabled={!pegado.trim()} onClick={pegar}>Añadir estas señales</button>
              </details>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s6">
              <h2 id="t-s6"><span className="gx-orden">6</span> Documentos · {documentos.length}</h2>
              <p className="gx-nota">Manuales, la lista de señales que pase el programador, esquemas. PDF, hojas de cálculo, texto o fotos, hasta 4 MB cada uno.</p>
              {falloDoc && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{falloDoc}</p>}
              {documentos.length > 0 && (
                <ul className="gx-documentos">
                  {documentos.map((d) => (
                    <li key={d.id}>
                      <FileText size={18} strokeWidth={1.6} aria-hidden="true" />
                      <a href={`/api/ops/fotos/${d.id}`} download={d.pie || "documento"}>
                        <b>{d.pie || "Documento"}</b>
                        <small>{peso(d.tamano)} · {new Date(d.creada).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</small>
                      </a>
                      <a href={`/api/ops/fotos/${d.id}`} download={d.pie || "documento"} className="gx-boton-enlace" aria-label={`Descargar ${d.pie}`}><Download size={16} strokeWidth={1.7} aria-hidden="true" /></a>
                      <button type="button" className="gx-boton-enlace" aria-label={`Borrar ${d.pie}`} onClick={() => void borrarDoc(d)}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <label className={`gx-boton secundario gx-subir-doc${subiendo ? " ocupado" : ""}`}>
                {subiendo ? <LoaderCircle size={16} aria-hidden="true" className="gx-gira" /> : <Upload size={16} strokeWidth={1.7} aria-hidden="true" />}
                {subiendo ? "Subiendo…" : "Subir un documento"}
                <input
                  type="file"
                  multiple
                  className="gx-solo-lector"
                  disabled={subiendo}
                  accept=".pdf,.csv,.txt,.xlsx,.xls,.xml,image/*"
                  onChange={(ev) => {
                    const archivos = [...(ev.target.files ?? [])];
                    ev.target.value = "";
                    if (archivos.length) void subir(archivos);
                  }}
                />
              </label>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s7">
              <h2 id="t-s7"><span className="gx-orden">7</span> Notas técnicas</h2>
              <label className="gx-campo">
                <span className="gx-solo-lector">Notas técnicas</span>
                <textarea rows={4} value={t.notas} maxLength={8000} placeholder="Lo particular de esta instalación: lo que no cabe en los apartados de arriba." onChange={(ev) => tecnica({ notas: ev.target.value })} />
              </label>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
