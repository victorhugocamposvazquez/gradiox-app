"use client";

// La ficha técnica de una nave: cómo se conecta Gradiox, con qué permiso, señales y documentos.
// Vive como pestaña de la página de la nave y comparte con ella la ficha del cliente.

import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Copy, CornerDownRight, Link2, MessageSquare, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FORMULARIO, Seccion } from "@/components/ops/ficha-piezas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EditorSenales, ListaDocumentos } from "@/components/tecnica-partes";
import { INTERNET, MAX_FOTO, MIMES_FOTO, esDocumento, type Foto, type Instalacion, type Internet } from "@/clientes/modelo";
import { pedir, reducirFoto } from "@/clientes/navegador";
import {
  ACCESOS,
  CAMPOS_COMENTARIO,
  ENCHUFAR,
  GOBIERNO,
  PERMISOS,
  SOPORTES,
  USUARIOS,
  VIAS,
  destinoComentario,
  faltaTecnica,
  fraseConexion,
  nuevoEnlace,
  pasarComentario,
  type Acceso,
  type Enchufar,
  type Gobierno,
  type Permiso,
  type Soporte,
  type Tecnica,
  EQUIPOS_DATO,
  ESTADOS_EQUIPO,
  type EstadoEquipo,
  type UsuarioGradiox,
  type Via,
} from "@/clientes/tecnica";
import type { usarFicha } from "@/clientes/usar-ficha";
import { IDS_EQUIPO } from "@/cop/equipos";

/** Un dato de la ficha: su nombre, una línea que explica qué es y dónde se escribe. */
function Dato({ campo, rotulo, ayuda, ancho, children }: { campo: string; rotulo: string; ayuda?: string; ancho?: boolean; children: ReactNode }) {
  return (
    <label id={`t-${campo}`} className={`flex min-w-0 scroll-mt-24 flex-col gap-1.5 text-[13px] font-medium${ancho ? " sm:col-span-2" : ""}`}>
      <span>{rotulo}</span>
      {children}
      {ayuda && <small className="text-xs font-normal text-muted-foreground">{ayuda}</small>}
    </label>
  );
}

function Opciones<T extends string>({ valor, opciones, alCambiar }: { valor: T; opciones: Record<T, string>; alCambiar: (v: T) => void }) {
  return (
    <NativeSelect size="sm" value={valor} onChange={(ev) => alCambiar(ev.target.value as T)}>
      {(Object.keys(opciones) as T[]).map((k) => (
        <NativeSelectOption key={k} value={k}>{opciones[k]}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** El número de orden de cada apartado. */
const Orden = ({ n }: { n: number }) => <span className="grid size-5 shrink-0 place-items-center rounded-md bg-acento-fondo text-xs font-semibold text-acento-texto" aria-hidden="true">{n}</span>;

export function FichaTecnicaNave({ id, ficha, inst }: { id: string; ficha: ReturnType<typeof usarFicha>; inst: Instalacion }) {
  const { c, fotos, setFotos, cambiar } = ficha;
  const [copiado, setCopiado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [falloDoc, setFalloDoc] = useState("");
  if (!c) return null;

  const t = inst.tecnica;
  const instalacion = (parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === inst.id ? { ...x, ...parte } : x)) });
  const tecnica = (parte: Partial<Tecnica>) => instalacion({ tecnica: { ...t, ...parte } });
  const faltas = faltaTecnica(inst);
  const pendientes = t.comentarios.filter((x) => !x.resuelto).length;
  const documentos = fotos.filter((f) => esDocumento(f) && f.instalacion === inst.id);
  const conAutomata = t.gobierno === "automata" || t.gobierno === "mixto";

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

  const resumen = [t.permiso ? PERMISOS[t.permiso] : "", t.via === "opcua" && t.usuario ? `Acceso de Gradiox: ${USUARIOS[t.usuario].toLowerCase()}` : "", t.direccion].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-4">
      {t.enviada > 0 && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-bien" />
          <AlertTitle>El técnico envió esta ficha el {fecha(t.enviada)}.</AlertTitle>
          <AlertDescription>{pendientes > 0 ? `Ha dejado ${pendientes} ${pendientes === 1 ? "comentario" : "comentarios"} sobre el formulario, al final de la página. ` : ""}{t.externa > t.enviada ? `Después ha cambiado algo (${fecha(t.externa)}) y aún no lo ha vuelto a enviar.` : "Revísala: lo que rellenó ya está en los apartados de abajo."}</AlertDescription>
        </Alert>
      )}

      <Card aria-label="Cómo se conecta" className="gap-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <Badge variant={faltas.length ? "aviso" : "bien"}>{faltas.length ? `Faltan ${faltas.length} ${faltas.length === 1 ? "dato" : "datos"} para poder conectar` : "Hay todo lo necesario para conectar"}</Badge>
            <h2 className="m-0 text-base font-semibold tracking-tight">{fraseConexion(inst)}</h2>
            <p className="m-0 text-[13px] text-muted-foreground">{resumen || "Rellena los apartados de abajo en orden. Cada dato dice para qué sirve."}</p>
          </div>
          <dl className="m-0 grid grid-cols-3 gap-2">
            {[["Cámaras", inst.puntos.length], ["Señales", t.senales.length], ["Documentos", documentos.length]].map(([r, n]) => (
              <div key={r} className="flex min-w-20 flex-col gap-0.5 rounded-md border bg-muted/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{r}</dt>
                <dd className="m-0 text-lg font-semibold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-14 lg:order-2" aria-label="Lo que falta y compartir">
          <Seccion titulo={`Falta por saber · ${faltas.length}`} descripcion="Solo se pide lo que hace falta según lo que haya en la instalación.">
            {faltas.length === 0 ? (
              <p className="m-0 flex items-center gap-2 text-[13px] text-bien"><Check className="size-4" aria-hidden="true" /> Nada. Con esto se puede preparar la conexión.</p>
            ) : (
              <ul data-slot="lista" className="m-0 flex list-none flex-col divide-y rounded-md border p-0">
                {faltas.map((f) => (
                  <li key={f.campo + f.texto}>
                    <button type="button" onClick={() => irA(f.campo)} className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[13px] text-foreground hover:bg-accent/60">
                      <span className="min-w-0 flex-1">{f.texto}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo={<><Link2 className="size-4 text-muted-foreground" aria-hidden="true" />Que la rellene un técnico</>} descripcion={t.enlace ? "Enlace encendido. Quien lo abra ve y rellena solo esta ficha técnica, sin contraseña. No ve otros clientes, ni tus notas, ni el resto del panel." : "Un enlace privado para quien programa el autómata. Verá solo esta ficha, con textos para técnicos, y lo que rellene aparecerá aquí."}>
            {t.enlace ? (
              <>
                <Input readOnly aria-label="Enlace para rellenar esta ficha" value={direccionEnlace} onFocus={(ev) => ev.target.select()} className="h-8 bg-muted/40 font-mono text-xs" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void copiar()}>{copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copiado ? "Copiado" : "Copiar enlace"}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => tecnica({ enlace: "" })}>Apagar</Button>
                </div>
                {t.externa > 0 && t.enviada === 0 && <p className="m-0 text-xs text-muted-foreground">Están rellenándola: último cambio el {fecha(t.externa)}. Todavía no han pulsado «Enviar».</p>}
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => tecnica({ enlace: nuevoEnlace() })}><Link2 aria-hidden="true" /> Crear enlace</Button>
            )}
          </Seccion>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <Seccion titulo={<><Orden n={1} />Qué gobierna el frío (sistema de control)</>} descripcion="De esto depende todo lo demás. En una instalación grande suele haber un autómata; en una pequeña, un controlador por cámara.">
            <div className={FORMULARIO}>
              <Dato campo="gobierno" rotulo="Tipo de sistema de control (arquitectura)" ayuda="Pregunta: «¿hay un autómata que lo gobierne todo, o cada cámara tiene su controlador?»">
                <Opciones<Gobierno> valor={t.gobierno} opciones={GOBIERNO} alCambiar={(v) => tecnica({ gobierno: v })} />
              </Dato>
              <Dato campo="sistema" rotulo="Programa o pantalla que ya usan (SCADA)" ayuda="Donde ven hoy todas las cámaras juntas, si lo tienen.">
                <Input className="h-8 bg-card text-sm font-normal" value={inst.sistemaActual} maxLength={2000} placeholder="Nombre, o «No tienen»" onChange={(ev) => instalacion({ sistemaActual: ev.target.value })} />
              </Dato>
              {conAutomata && (
                <>
                  <Dato campo="automata" rotulo="Autómata (PLC): marca y modelo" ayuda="Lo que pone en su frontal.">
                    <Input className="h-8 bg-card text-sm font-normal" value={inst.automata} maxLength={240} placeholder="Ej.: Siemens S7-1500" onChange={(ev) => instalacion({ automata: ev.target.value })} />
                  </Dato>
                  <Dato campo="cpu" rotulo="Modelo exacto de la CPU y versión (firmware)" ayuda="La CPU es el módulo principal del autómata; el firmware, su programa interno. Lo sabe quien lo programa.">
                    <Input className="h-8 bg-card text-sm font-normal" value={t.cpu} maxLength={240} placeholder="Ej.: CPU 1513, versión 2.9" onChange={(ev) => tecnica({ cpu: ev.target.value })} />
                  </Dato>
                </>
              )}
            </div>
            <div id="t-camaras" className="flex scroll-mt-24 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 text-[13px] font-medium">Cámaras y su controlador · {inst.puntos.length}</h3>
                <Link href={`/ops/clientes/${id}/instalaciones/${inst.id}?pestana=visita`} className="text-[13px] font-medium text-acento-texto hover:underline">Cambiar en «Cámaras y visita»</Link>
              </div>
              {inst.puntos.length === 0 ? (
                <p className="m-0 text-[13px] text-muted-foreground">Sin cámaras apuntadas.</p>
              ) : (
                <ul data-slot="lista" className="m-0 flex list-none flex-col divide-y rounded-md border p-0">
                  {inst.puntos.map((p, n) => (
                    <li key={p.id} className="flex flex-col px-3 py-2">
                      <span className="text-[13px] font-medium">{p.nombre || `Cámara ${n + 1}`}{p.temperatura ? <span className="font-normal text-muted-foreground"> · {p.temperatura}</span> : ""}</span>
                      <span className="text-xs text-muted-foreground">{p.controlador || (t.gobierno === "automata" ? "La lee el autómata" : "Controlador sin apuntar")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Seccion>

          <Seccion titulo={<><Orden n={2} />Cómo se conecta Gradiox</>} descripcion="Por dónde lee la pasarela de Gradiox y con qué permiso. Las contraseñas no se apuntan aquí.">
            <div className={FORMULARIO}>
              <Dato campo="via" rotulo="Vía de conexión (protocolo)" ayuda="El idioma en que Gradiox habla con los equipos. Con autómata, lo normal es OPC UA. Con controladores sueltos, Modbus.">
                <Opciones<Via> valor={t.via} opciones={VIAS} alCambiar={(v) => tecnica({ via: v })} />
              </Dato>
              <Dato campo="permiso" rotulo="Qué puede hacer Gradiox (permisos)" ayuda="Se empieza solo leyendo. Las órdenes se acuerdan aparte.">
                <Opciones<Permiso> valor={t.permiso} opciones={PERMISOS} alCambiar={(v) => tecnica({ permiso: v })} />
              </Dato>
              {t.via !== "modbus-rtu" && (
                <Dato campo="direccion" rotulo={t.via === "opcua" ? "Dirección del servidor (endpoint OPC UA)" : "Dirección del equipo en la red (IP y puerto)"} ayuda="Una serie de números como 192.168.0.10, y el puerto. La da quien lo programa o el informático.">
                  <Input className="h-8 bg-card text-sm font-normal" value={t.direccion} maxLength={240} placeholder="Ej.: 192.168.0.10, puerto 4840" onChange={(ev) => tecnica({ direccion: ev.target.value })} />
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
          </Seccion>

          <Seccion titulo={<><Orden n={3} />A quién preguntar</>} descripcion="Las personas que saben de esta instalación, con su teléfono.">
            <div className={FORMULARIO}>
              {conAutomata && (
                <Dato campo="programador" rotulo="Quién programa el autómata (programador del PLC)" ayuda="Es quien abre la lectura y pasa la lista de señales.">
                  <Input className="h-8 bg-card text-sm font-normal" value={inst.programador} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ programador: ev.target.value })} />
                </Dato>
              )}
              <Dato campo="mantenedor" rotulo="Quién mantiene el frío (mantenedor o instalador)" ayuda="Persona o empresa instaladora. Vale para todo el cliente.">
                <Input className="h-8 bg-card text-sm font-normal" value={[c.mantenedor.nombre, c.mantenedor.telefono].filter(Boolean).join(" · ")} readOnly placeholder="Se apunta en la ficha del cliente, paso Empresa" />
              </Dato>
              <Dato campo="informatica" rotulo="Quién lleva la informática (responsable de redes)" ayuda="Por si hay que pedir permiso para conectar un aparato a la red.">
                <Input className="h-8 bg-card text-sm font-normal" value={inst.informatica} maxLength={240} placeholder="Nombre y teléfono" onChange={(ev) => instalacion({ informatica: ev.target.value })} />
              </Dato>
            </div>
          </Seccion>

          <Seccion titulo={<><Orden n={4} />Pasarela de Gradiox: dónde va y por dónde sale</>} descripcion="La pasarela lee los equipos y envía los datos por internet. Puede ser un aparato nuestro o un programa en un ordenador del cliente: se elige en cada instalación.">
            <div className={FORMULARIO}>
              <Dato campo="soporte" rotulo="Dónde va la pasarela" ayuda="Aparato nuestro: igual en todos los clientes y lo mantenemos nosotros. Ordenador del cliente: más rápido de poner si ya tiene uno encendido siempre en la red del autómata.">
                <Opciones<Soporte> valor={t.soporte} opciones={SOPORTES} alCambiar={(v) => tecnica({ soporte: v })} />
              </Dato>
              <Dato campo="enchufar" rotulo="¿Se puede enchufar un aparato a la red de los equipos (red de control)?" ayuda="Con un cable de red, al mismo sitio donde está el autómata o los controladores.">
                <Opciones<Enchufar> valor={t.enchufar} opciones={ENCHUFAR} alCambiar={(v) => tecnica({ enchufar: v })} />
              </Dato>
              <Dato campo="internet" rotulo="Internet en la sala" ayuda="Si no hay, el aparato lleva su propia tarjeta de móvil.">
                <Opciones<Internet> valor={inst.internet} opciones={INTERNET} alCambiar={(v) => instalacion({ internet: v })} />
              </Dato>
              <Dato campo="sitio" ancho rotulo="Dónde iría el aparato">
                <Input className="h-8 bg-card text-sm font-normal" value={inst.sitioAparato} maxLength={2000} placeholder="Ej.: cerca de los equipos, bajo techo y con enchufe" onChange={(ev) => instalacion({ sitioAparato: ev.target.value })} />
              </Dato>
            </div>
          </Seccion>

          <Seccion ancla="t-senales" titulo={<><Orden n={5} />Señales (variables) · {t.senales.length}</>} descripcion="Cada dato que se lee (una temperatura, una alarma): su nombre tal como está en el equipo, qué es y de qué cámara. Con autómata, la lista la pasa quien lo programa.">
            <EditorSenales senales={t.senales} camaras={inst.puntos.map((p, n) => ({ id: p.id, nombre: p.nombre || `Cámara ${n + 1}` }))} alCambiar={(senales) => tecnica({ senales })} />
          </Seccion>

          <Seccion ancla="t-equipos" titulo={<><Orden n={6} />Equipos de medida que ya tiene</>} descripcion="Lo normal es que la instalación ya los tenga. Mira si existen y si el autómata los lee: si los lee, Gradiox los usa sin comprar nada. Solo lo que falte tiene coste (ver Automatización).">
            <div className={FORMULARIO}>
              {IDS_EQUIPO.map((k) => (
                <Dato key={k} campo={`equipo-${k}`} rotulo={EQUIPOS_DATO[k].nombre} ayuda={`${EQUIPOS_DATO[k].paraQue} Mejora: ${EQUIPOS_DATO[k].mejora}`}>
                  <Opciones<EstadoEquipo> valor={t.equipos[k] ?? ""} opciones={ESTADOS_EQUIPO} alCambiar={(v) => tecnica({ equipos: { ...t.equipos, [k]: v } })} />
                </Dato>
              ))}
            </div>
          </Seccion>

          <Seccion titulo={<><Orden n={7} />Documentos · {documentos.length}</>} descripcion="Manuales, la lista de señales que pase el programador, esquemas. PDF, hojas de cálculo, texto o fotos, hasta 4 MB cada uno.">
            <ListaDocumentos documentos={documentos} direccion={(d) => `/api/ops/fotos/${d.id}`} subiendo={subiendo} fallo={falloDoc} alSubir={(a) => void subir(a)} alBorrar={(d) => void borrarDoc(d.id)} />
          </Seccion>

          {t.observaciones && (
            <Seccion titulo="Observaciones del técnico" descripcion="Lo que ha escrito quien rellenó la ficha desde el enlace.">
              <p className="m-0 text-[13px] whitespace-pre-wrap">{t.observaciones}</p>
            </Seccion>
          )}

          {t.comentarios.length > 0 && (
            <Seccion ancla="t-comentarios" titulo={<><MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />Comentarios sobre el formulario · {t.comentarios.filter((x) => !x.resuelto).length} sin resolver</>} descripcion="Lo que dice quien rellenó la ficha vale como dato. «Usar como dato» lo escribe en su casilla si está vacía; «Pasar a notas» lo guarda en las notas técnicas sin pisar nada.">
              <ul data-slot="lista" className="m-0 flex list-none flex-col divide-y rounded-md border p-0">
                {[...t.comentarios].sort((a, b) => Number(a.resuelto) - Number(b.resuelto) || b.t - a.t).map((x) => (
                  <li key={x.id} className={`flex flex-wrap items-start gap-3 px-3 py-2.5${x.resuelto ? " opacity-60" : ""}`}>
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                      <span className="text-[13px] font-medium">{CAMPOS_COMENTARIO[x.campo]}</span>
                      <p className="m-0 text-[13px]">{x.texto}</p>
                      {x.t > 0 && <span className="text-xs text-muted-foreground">{fecha(x.t)}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {!x.resuelto && (
                        <Button type="button" variant="outline" size="sm" onClick={() => instalacion(pasarComentario(inst, x.id))}>
                          <CornerDownRight aria-hidden="true" /> {destinoComentario(inst, x) === "dato" ? "Usar como dato" : "Pasar a notas"}
                        </Button>
                      )}
                      <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={x.resuelto} onCheckedChange={(v) => tecnica({ comentarios: t.comentarios.map((y) => (y.id === x.id ? { ...y, resuelto: v === true } : y)) })} /> Resuelto</label>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Borrar el comentario sobre ${CAMPOS_COMENTARIO[x.campo]}`} onClick={() => tecnica({ comentarios: t.comentarios.filter((y) => y.id !== x.id) })}><Trash2 aria-hidden="true" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          <Seccion titulo={<><Orden n={8} />Notas técnicas</>} descripcion="Lo particular de esta instalación: lo que no cabe en los apartados de arriba.">
            <Textarea aria-label="Notas técnicas" rows={4} value={t.notas} maxLength={8000} onChange={(ev) => tecnica({ notas: ev.target.value })} className="min-h-24 bg-card text-sm" />
          </Seccion>
        </div>
      </div>
    </div>
  );
}
