"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, CloudOff, Copy, Link2, LoaderCircle, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SinBase } from "@/components/sin-base";
import { EditorSenales, ListaDocumentos } from "@/components/tecnica-partes";
import { INTERNET, MAX_FOTO, MIMES_FOTO, esDocumento, type Foto, type Instalacion, type Internet } from "@/clientes/modelo";
import { pedir, reducirFoto } from "@/clientes/navegador";
import {
  ACCESOS,
  CAMPOS_COMENTARIO,
  ENCHUFAR,
  GOBIERNO,
  PERMISOS,
  USUARIOS,
  VIAS,
  faltaTecnica,
  fraseConexion,
  nuevoEnlace,
  type Acceso,
  type Enchufar,
  type Gobierno,
  type Permiso,
  type Tecnica,
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

export default function FichaTecnica() {
  const { id } = useParams<{ id: string }>();
  const { c, fotos, setFotos, base, fallo, estado, cambiar, enviar } = usarFicha(id);
  const [actual, setActual] = useState("");
  const [copiado, setCopiado] = useState(false);
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
  const faltas = faltaTecnica(inst);
  const pendientes = t.comentarios.filter((x) => !x.resuelto).length;
  const documentos = fotos.filter((f) => esDocumento(f) && f.instalacion === inst.id);
  const conAutomata = t.gobierno === "automata" || t.gobierno === "mixto";
  const nombreInst = inst.nombre || "Instalación";

  const fecha = (ms: number) => new Date(ms).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const direccionEnlace = t.enlace && typeof window !== "undefined" ? `${window.location.origin}/ficha/${t.enlace}` : "";
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(direccionEnlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso para copiar, el enlace se puede seleccionar a mano en la casilla.
    }
  };
  const irA = (campo: string) => {
    const destino = document.getElementById(`t-${campo}`);
    destino?.scrollIntoView({ behavior: "smooth", block: "center" });
    destino?.querySelector<HTMLElement>("input, select, textarea, button, a")?.focus({ preventScroll: true });
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
  const borrarDoc = async (doc: string) => {
    try {
      await pedir(`/api/ops/fotos/${doc}`, { method: "DELETE" });
      setFotos((l) => l.filter((x) => x.id !== doc));
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
        {t.enviada > 0 && (
          <p className="gx-aviso-enviada" role="status">
            <CircleCheck size={18} strokeWidth={1.7} aria-hidden="true" />
            <span><b>El técnico envió esta ficha el {fecha(t.enviada)}.</b>{pendientes > 0 ? ` Ha dejado ${pendientes} ${pendientes === 1 ? "comentario" : "comentarios"} sobre el formulario, al final de la página.` : ""} {t.externa > t.enviada ? `Después ha cambiado algo (${fecha(t.externa)}) y aún no lo ha vuelto a enviar.` : "Revísala: lo que rellenó ya está en los apartados de abajo."}</span>
          </p>
        )}

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

            <div className="gx-compartir">
              <h3 className="gx-subtitulo"><Link2 size={16} strokeWidth={1.7} aria-hidden="true" /> Que la rellene un técnico</h3>
              {t.enlace ? (
                <>
                  <p className="gx-nota">Enlace encendido. Quien lo abra ve y rellena solo esta ficha técnica, sin contraseña. No ve otros clientes, ni tus notas, ni el resto del panel.</p>
                  <input className="gx-enlace" readOnly aria-label="Enlace para rellenar esta ficha" value={direccionEnlace} onFocus={(ev) => ev.target.select()} />
                  <div className="gx-compartir-botones">
                    <button type="button" className="gx-boton" onClick={() => void copiar()}>{copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.7} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar enlace"}</button>
                    <button type="button" className="gx-boton secundario" onClick={() => tecnica({ enlace: "" })}>Apagar</button>
                  </div>
                  {t.externa > 0 && t.enviada === 0 && <p className="gx-nota">Están rellenándola: último cambio el {fecha(t.externa)}. Todavía no han pulsado «Enviar».</p>}
                </>
              ) : (
                <>
                  <p className="gx-nota">Crea un enlace privado para quien programa el autómata. Verá solo esta ficha técnica, con los textos pensados para un técnico, y lo que rellene aparecerá aquí.</p>
                  <button type="button" className="gx-boton" onClick={() => tecnica({ enlace: nuevoEnlace() })}><Link2 size={16} strokeWidth={1.7} aria-hidden="true" /> Crear enlace</button>
                </>
              )}
            </div>
          </aside>

          <div className="gx-pila">
            <section className="gx-tarjeta" aria-labelledby="t-s1">
              <h2 id="t-s1"><span className="gx-orden">1</span> Qué gobierna el frío (sistema de control)</h2>
              <p className="gx-nota">De esto depende todo lo demás. En una instalación grande suele haber un autómata; en una pequeña, un controlador por cámara.</p>
              <div className="gx-formulario gx-ficha">
                <Dato campo="gobierno" rotulo="Tipo de sistema de control (arquitectura)" ayuda="Pregunta: «¿hay un autómata que lo gobierne todo, o cada cámara tiene su controlador?»">
                  <Opciones<Gobierno> valor={t.gobierno} opciones={GOBIERNO} alCambiar={(v) => tecnica({ gobierno: v })} />
                </Dato>
                <Dato campo="sistema" rotulo="Programa o pantalla que ya usan (SCADA)" ayuda="Donde ven hoy todas las cámaras juntas, si lo tienen.">
                  <input value={inst.sistemaActual} maxLength={2000} placeholder="Nombre, o «No tienen»" onChange={(ev) => instalacion({ sistemaActual: ev.target.value })} />
                </Dato>
                {conAutomata && (
                  <>
                    <Dato campo="automata" rotulo="Autómata (PLC): marca y modelo" ayuda="Lo que pone en su frontal.">
                      <input value={inst.automata} maxLength={240} placeholder="Por ejemplo: Siemens S7-1500" onChange={(ev) => instalacion({ automata: ev.target.value })} />
                    </Dato>
                    <Dato campo="cpu" rotulo="Modelo exacto de la CPU y versión (firmware)" ayuda="La CPU es el módulo principal del autómata; el firmware, su programa interno. Lo sabe quien lo programa.">
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
                <Dato campo="via" rotulo="Vía de conexión (protocolo)" ayuda="El idioma en que Gradiox habla con los equipos. Con autómata, lo normal es OPC UA. Con controladores sueltos, Modbus.">
                  <Opciones<Via> valor={t.via} opciones={VIAS} alCambiar={(v) => tecnica({ via: v })} />
                </Dato>
                <Dato campo="permiso" rotulo="Qué puede hacer Gradiox (permisos)" ayuda="Se empieza solo leyendo. Las órdenes se acuerdan aparte.">
                  <Opciones<Permiso> valor={t.permiso} opciones={PERMISOS} alCambiar={(v) => tecnica({ permiso: v })} />
                </Dato>
                {t.via !== "modbus-rtu" && (
                  <Dato campo="direccion" rotulo={t.via === "opcua" ? "Dirección del servidor (endpoint OPC UA)" : "Dirección del equipo en la red (IP y puerto)"} ayuda="Una serie de números como 192.168.0.10, y el puerto. La da quien lo programa o el informático.">
                    <input value={t.direccion} maxLength={240} placeholder="192.168.0.10, puerto 4840" onChange={(ev) => tecnica({ direccion: ev.target.value })} />
                  </Dato>
                )}
                {t.via === "opcua" && (
                  <>
                    <Dato campo="acceso" rotulo="Cómo se entra (autenticación)" ayuda="Lo que pide el autómata para dejar leer.">
                      <Opciones<Acceso> valor={t.acceso} opciones={ACCESOS} alCambiar={(v) => tecnica({ acceso: v })} />
                    </Dato>
                    <Dato campo="usuario" rotulo="Usuario de solo lectura para Gradiox" ayuda="Hay que pedírselo a quien programa el autómata. Aquí solo se apunta si ya está, nunca la contraseña.">
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
                  <Dato campo="programador" rotulo="Quién programa el autómata (programador del PLC)" ayuda="Es quien abre la lectura y pasa la lista de señales.">
                    <input value={inst.programador} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ programador: ev.target.value })} />
                  </Dato>
                )}
                <Dato campo="mantenedor" rotulo="Quién mantiene el frío (mantenedor o instalador)" ayuda="Persona o empresa instaladora. Vale para todo el cliente.">
                  <input value={[c.mantenedor.nombre, c.mantenedor.telefono].filter(Boolean).join(" · ")} readOnly placeholder="Se apunta en la ficha del cliente, paso Empresa" />
                </Dato>
                <Dato campo="informatica" rotulo="Quién lleva la informática (responsable de redes)" ayuda="Por si hay que pedir permiso para conectar un aparato a la red.">
                  <input value={inst.informatica} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ informatica: ev.target.value })} />
                </Dato>
              </div>
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s4">
              <h2 id="t-s4"><span className="gx-orden">4</span> Red y sitio del aparato (pasarela de Gradiox)</h2>
              <p className="gx-nota">El aparato de Gradiox es una pasarela: una cajita que lee los equipos y envía los datos por internet. Aquí se apunta dónde va y por dónde sale.</p>
              <div className="gx-formulario gx-ficha">
                <Dato campo="enchufar" rotulo="¿Se puede enchufar un aparato a la red de los equipos (red de control)?" ayuda="Con un cable de red, al mismo sitio donde está el autómata o los controladores.">
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
              <h2 id="t-s5"><span className="gx-orden">5</span> Señales (variables) · {t.senales.length}</h2>
              <p className="gx-nota">Cada dato que se lee (una temperatura, una alarma): su nombre tal como está en el equipo, qué es y de qué cámara. Con autómata, la lista la pasa quien lo programa.</p>
              <EditorSenales senales={t.senales} camaras={inst.puntos.map((p, n) => ({ id: p.id, nombre: p.nombre || `Cámara ${n + 1}` }))} alCambiar={(senales) => tecnica({ senales })} />
            </section>

            <section className="gx-tarjeta" aria-labelledby="t-s6">
              <h2 id="t-s6"><span className="gx-orden">6</span> Documentos · {documentos.length}</h2>
              <p className="gx-nota">Manuales, la lista de señales que pase el programador, esquemas. PDF, hojas de cálculo, texto o fotos, hasta 4 MB cada uno.</p>
              <ListaDocumentos documentos={documentos} direccion={(d) => `/api/ops/fotos/${d.id}`} subiendo={subiendo} fallo={falloDoc} alSubir={(a) => void subir(a)} alBorrar={(d) => void borrarDoc(d.id)} />
            </section>

            {t.observaciones && (
              <section className="gx-tarjeta" aria-labelledby="t-obs">
                <h2 id="t-obs">Observaciones del técnico</h2>
                <p className="gx-nota">Lo que ha escrito quien rellenó la ficha desde el enlace.</p>
                <p className="gx-observaciones">{t.observaciones}</p>
              </section>
            )}

            {t.comentarios.length > 0 && (
              <section id="t-comentarios" className="gx-tarjeta" aria-labelledby="t-com">
                <h2 id="t-com"><MessageSquare size={17} strokeWidth={1.7} aria-hidden="true" /> Comentarios sobre el formulario · {t.comentarios.filter((x) => !x.resuelto).length} sin resolver</h2>
                <p className="gx-nota">Correcciones y sugerencias de quien rellenó la ficha desde el enlace, una por dato. Márcalas cuando estén atendidas.</p>
                <ul className="gx-comentarios">
                  {[...t.comentarios].sort((a, b) => Number(a.resuelto) - Number(b.resuelto) || b.t - a.t).map((x) => (
                    <li key={x.id} className={x.resuelto ? "resuelto" : undefined}>
                      <div>
                        <b>{CAMPOS_COMENTARIO[x.campo]}</b>
                        <p>{x.texto}</p>
                        {x.t > 0 && <small>{fecha(x.t)}</small>}
                      </div>
                      <label className="gx-comentario-hecho"><input type="checkbox" checked={x.resuelto} onChange={(ev) => tecnica({ comentarios: t.comentarios.map((y) => (y.id === x.id ? { ...y, resuelto: ev.target.checked } : y)) })} /> Resuelto</label>
                      <button type="button" className="gx-boton-enlace" aria-label={`Borrar el comentario sobre ${CAMPOS_COMENTARIO[x.campo]}`} onClick={() => tecnica({ comentarios: t.comentarios.filter((y) => y.id !== x.id) })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
