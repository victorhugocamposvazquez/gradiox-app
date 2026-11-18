"use client";

import { AreaTexto } from "@/components/area-texto";
import { useParams } from "next/navigation";
import { Check, CircleCheck, CloudOff, LoaderCircle, MessageSquare, Send } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Marca } from "@/components/marca";
import { EditorSenales, ListaDocumentos, type Documento } from "@/components/tecnica-partes";
import type { CambiosExternos, FichaExterna, TecnicaExterna } from "@/clientes/externo";
import { MAX_FOTO, type Internet } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { ACCESOS, ENCHUFAR, GOBIERNO, MAX_COMENTARIO, PERMISOS, USUARIOS, VIAS, type Acceso, type CampoComentario, type Comentario, type Enchufar, type Gobierno, type Permiso, type UsuarioGradiox, type Via } from "@/clientes/tecnica";

// Las mismas opciones que en el panel: el nombre llano y el término técnico entre paréntesis.
// Solo cambia cómo se dice que un dato está sin rellenar.
const sinIndicar = <T extends string>(mapa: Record<T, string>, vacio = "Sin indicar") => ({ ...mapa, "": vacio }) as Record<T, string>;
const GOBIERNO_T = sinIndicar<Gobierno>(GOBIERNO);
const VIAS_T = sinIndicar<Via>(VIAS);
const ACCESOS_T = sinIndicar<Acceso>(ACCESOS);
const USUARIOS_T = sinIndicar<UsuarioGradiox>(USUARIOS, "Pendiente de pedir");
const PERMISOS_T = sinIndicar<Permiso>(PERMISOS);
const ENCHUFAR_T = sinIndicar<Enchufar>(ENCHUFAR);
const INTERNET_T: Record<Internet, string> = { "": "Sin indicar", cable: "Sí, por cable", wifi: "Solo por wifi", movil: "No, solo cobertura móvil", ninguno: "No, ni cobertura móvil" };

type Guardado = "guardado" | "pendiente" | "guardando" | "fallo";
const ESPERA_MS = 900;

type Notas = { de: (campo: CampoComentario) => Comentario | undefined; poner: (campo: CampoComentario, texto: string) => void };
const NotasCtx = createContext<Notas>({ de: () => undefined, poner: () => {} });

/** Una corrección o sugerencia sobre un dato del formulario. Cerrada, es solo un enlace pequeño. */
function Comentar({ campo, pregunta = "Comentar" }: { campo: CampoComentario; pregunta?: string }) {
  const { de, poner } = useContext(NotasCtx);
  const actual = de(campo);
  const [abierto, setAbierto] = useState(false);
  if (!abierto && !actual)
    return (
      <button type="button" className="gx-comentar" onClick={() => setAbierto(true)}>
        <MessageSquare size={14} strokeWidth={1.7} aria-hidden="true" /> {pregunta}
      </button>
    );
  return (
    <label className="gx-comentario">
      <span><MessageSquare size={14} strokeWidth={1.7} aria-hidden="true" /> Su comentario sobre este dato{actual?.resuelto ? " · Revisado por Gradiox" : ""}</span>
      <AreaTexto rows={2} autoFocus={abierto && !actual} value={actual?.texto ?? ""} maxLength={MAX_COMENTARIO} placeholder="Qué corregiría, qué no se entiende o qué falta preguntar." onChange={(ev) => poner(campo, ev.target.value)} onBlur={() => setAbierto(false)} />
    </label>
  );
}

function Dato({ rotulo, ayuda, ancho, campo, children }: { rotulo: string; ayuda?: string; ancho?: boolean; campo: CampoComentario; children: ReactNode }) {
  return (
    <div className={`gx-dato-con${ancho ? " ancho" : ""}`}>
      <label className="gx-campo gx-dato">
        <span>{rotulo}</span>
        {children}
        {ayuda && <small>{ayuda}</small>}
      </label>
      <Comentar campo={campo} />
    </div>
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

export default function FichaPorEnlace() {
  const { enlace } = useParams<{ enlace: string }>();
  const api = `/api/ficha/${enlace}`;
  const [f, setF] = useState<FichaExterna | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [fallo, setFallo] = useState("");
  const [estado, setEstado] = useState<Guardado>("guardado");
  const [subiendo, setSubiendo] = useState(false);
  const [falloDoc, setFalloDoc] = useState("");
  const [enviada, setEnviada] = useState(0);
  const [cambiada, setCambiada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falloEnvio, setFalloEnvio] = useState("");
  const version = useRef(0);
  const ultimo = useRef<CambiosExternos | null>(null);
  const reloj = useRef<number | undefined>(undefined);

  useEffect(() => {
    pedir<{ ficha: FichaExterna; documentos: Documento[] }>(api)
      .then((d) => {
        setF(d.ficha);
        setDocumentos(d.documentos);
        setEnviada(d.ficha.enviada);
        setCambiada(d.ficha.cambiada);
      })
      .catch((e: Error) => setFallo(e.message));
  }, [api]);

  const enviar = useCallback(async () => {
    const datos = ultimo.current;
    if (!datos) return;
    const v = version.current;
    setEstado("guardando");
    try {
      await pedir(api, { ...conJson("PUT", datos), keepalive: true });
      if (version.current === v) setEstado("guardado");
    } catch {
      if (version.current === v) setEstado("fallo");
    }
  }, [api]);

  useEffect(() => {
    const apurar = () => {
      if (reloj.current === undefined) return;
      window.clearTimeout(reloj.current);
      reloj.current = undefined;
      void enviar();
    };
    window.addEventListener("pagehide", apurar);
    return () => {
      window.removeEventListener("pagehide", apurar);
      apurar();
    };
  }, [enviar]);

  if (!f)
    return (
      <main className="gx-externa">
        <header className="gx-externa-cabeza"><Marca size={24} /></header>
        {fallo ? (
          <section className="gx-tarjeta">
            <h1>Este enlace no está disponible</h1>
            <p className="gx-nota">{fallo}. Pide uno nuevo a la persona de Gradiox que te lo envió.</p>
          </section>
        ) : (
          <p className="gx-sub">Abriendo la ficha…</p>
        )}
      </main>
    );

  const cambiar = (parte: Partial<CambiosExternos>) => {
    const nuevo = { ...f, ...parte };
    setF(nuevo);
    ultimo.current = { automata: nuevo.automata, programador: nuevo.programador, informatica: nuevo.informatica, internet: nuevo.internet, tecnica: nuevo.tecnica };
    version.current++;
    setCambiada(true);
    setEstado("pendiente");
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => void enviar(), ESPERA_MS);
  };
  const t = f.tecnica;
  const tecnica = (parte: Partial<TecnicaExterna>) => cambiar({ tecnica: { ...t, ...parte } });
  const notas: Notas = {
    de: (campo) => t.comentarios.find((c) => c.campo === campo),
    poner: (campo, texto) => {
      const resto = t.comentarios.filter((c) => c.campo !== campo);
      const previo = t.comentarios.find((c) => c.campo === campo);
      tecnica({ comentarios: texto.trim() ? [...resto, { id: previo?.id ?? crypto.randomUUID(), campo, texto, t: previo?.t ?? 0, resuelto: false }] : resto });
    },
  };
  const conPlc = t.gobierno === "automata" || t.gobierno === "mixto";

  const cuando = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const entregar = async () => {
    setFalloEnvio("");
    setEnviando(true);
    window.clearTimeout(reloj.current);
    reloj.current = undefined;
    const v = version.current;
    const datos: CambiosExternos = ultimo.current ?? { automata: f.automata, programador: f.programador, informatica: f.informatica, internet: f.internet, tecnica: f.tecnica };
    try {
      const d = await pedir<{ enviada: number }>(api, conJson("POST", datos));
      setEnviada(d.enviada);
      if (version.current === v) {
        setCambiada(false);
        setEstado("guardado");
      }
    } catch (e) {
      setFalloEnvio(e instanceof Error ? e.message : "No se ha podido enviar");
    }
    setEnviando(false);
  };

  const subir = async (archivos: File[]) => {
    setFalloDoc("");
    setSubiendo(true);
    for (const archivo of archivos) {
      try {
        if (archivo.size > MAX_FOTO) throw new Error(`«${archivo.name}» pesa demasiado (máximo 4 MB)`);
        const cuerpo = new FormData();
        cuerpo.set("documento", archivo, archivo.name);
        const d = await pedir<{ documento: Documento }>(`${api}/documentos`, { method: "POST", body: cuerpo });
        setDocumentos((l) => [...l, d.documento]);
      } catch (e) {
        setFalloDoc(e instanceof Error ? e.message : "No se ha podido subir el documento");
      }
    }
    setSubiendo(false);
  };
  const borrar = async (d: Documento) => {
    try {
      await pedir(`${api}/documentos/${d.id}`, { method: "DELETE" });
      setDocumentos((l) => l.filter((x) => x.id !== d.id));
    } catch (e) {
      setFalloDoc(e instanceof Error ? e.message : "No se ha podido borrar el documento");
    }
  };

  return (
    <NotasCtx.Provider value={notas}>
    <main className="gx-externa">
      <header className="gx-externa-cabeza">
        <Marca size={24} />
        <span className={`gx-guardado ${estado}`} role="status">
          {estado === "guardado" && <><Check size={15} aria-hidden="true" /> {enviada && !cambiada ? "Enviado" : "Borrador guardado"}</>}
          {estado === "pendiente" && "Guardando el borrador…"}
          {estado === "guardando" && <><LoaderCircle size={15} aria-hidden="true" className="gx-gira" /> Guardando…</>}
          {estado === "fallo" && (
            <>
              <CloudOff size={15} aria-hidden="true" /> No se ha guardado
              <button type="button" className="gx-boton-enlace" onClick={() => void enviar()}>Reintentar</button>
            </>
          )}
        </span>
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta realce gx-externa-intro">
          <span className="gx-chip">Ficha de conexión</span>
          <h1>Su instalación de frío, optimizada con Gradiox</h1>
          <p className="gx-externa-sitio">{[f.empresa, f.instalacion].filter(Boolean).join(" · ")}</p>
        </section>

        <section className="gx-tarjeta" aria-labelledby="e-1">
          <h2 id="e-1"><span className="gx-orden">1</span> Sistema de control y acceso para la lectura</h2>
          <div className="gx-formulario gx-ficha">
            <Dato campo="gobierno" rotulo="Tipo de sistema de control (arquitectura)" ayuda="Si un autómata (PLC) gobierna toda la instalación o cada cámara tiene su propio controlador.">
              <Opciones<Gobierno> valor={t.gobierno} opciones={GOBIERNO_T} alCambiar={(v) => tecnica({ gobierno: v })} />
            </Dato>
            <Dato campo="via" rotulo="Vía de conexión (protocolo)">
              <Opciones<Via> valor={t.via} opciones={VIAS_T} alCambiar={(v) => tecnica({ via: v })} />
            </Dato>
            {t.via !== "modbus-rtu" && (
              <Dato campo="direccion" rotulo={t.via === "opcua" ? "Dirección del servidor (endpoint OPC UA)" : "Dirección del equipo en la red (IP y puerto)"} ayuda={t.via === "opcua" ? "Dirección en la red de la planta y puerto. Si aplica, la política de seguridad." : undefined}>
                <input value={t.direccion} maxLength={240} placeholder={t.via === "opcua" ? "Ej.: opc.tcp://192.168.0.10:4840" : "Ej.: 192.168.0.10:502"} onChange={(ev) => tecnica({ direccion: ev.target.value })} />
              </Dato>
            )}
            {t.via === "opcua" && (
              <>
                <Dato campo="acceso" rotulo="Cómo se entra (autenticación)">
                  <Opciones<Acceso> valor={t.acceso} opciones={ACCESOS_T} alCambiar={(v) => tecnica({ acceso: v })} />
                </Dato>
                <Dato campo="usuario" rotulo="Usuario de solo lectura para Gradiox" ayuda="Indique solo si está creado. No escriba aquí la contraseña: se entrega por otro canal.">
                  <Opciones<UsuarioGradiox> valor={t.usuario} opciones={USUARIOS_T} alCambiar={(v) => tecnica({ usuario: v })} />
                </Dato>
              </>
            )}
          </div>
        </section>

        <section className="gx-tarjeta" aria-labelledby="e-2">
          <h2 id="e-2"><span className="gx-orden">2</span> Variables (señales) · {t.senales.length}</h2>
          <p className="gx-nota">Las variables de frío expuestas: temperaturas, alarmas, estados de compresores y consignas. Puede pegar la lista aquí o subir el archivo exportado en el apartado siguiente.</p>
          <EditorSenales tecnico senales={t.senales} camaras={f.camaras} alCambiar={(senales) => tecnica({ senales })} />
          <Comentar campo="senales" pregunta="Comentar este apartado" />
        </section>

        <section className="gx-tarjeta" aria-labelledby="e-3">
          <h2 id="e-3"><span className="gx-orden">3</span> Documentos · {documentos.length} <span className="gx-opcional">Opcional</span></h2>
          <p className="gx-nota">Exportación de variables, esquemas o manuales. PDF, hojas de cálculo, CSV, XML, texto o imágenes, hasta 4 MB por archivo.</p>
          <ListaDocumentos documentos={documentos} direccion={(d) => `${api}/documentos/${d.id}`} subiendo={subiendo} fallo={falloDoc} alSubir={(a) => void subir(a)} alBorrar={(d) => void borrar(d)} />
          <Comentar campo="documentos" pregunta="Comentar este apartado" />
        </section>

        <details className="gx-tarjeta gx-plegable" open>
          <summary><h2><span className="gx-orden">4</span> Datos de la instalación</h2><small>Es lo que Gradiox tiene apuntado. Confirme que es correcto y corrija o complete lo que haga falta.</small></summary>
          <div className="gx-formulario gx-ficha gx-adicionales">
            {conPlc && (
              <>
                <Dato campo="automata" rotulo="Autómata (PLC): fabricante y familia">
                  <input value={f.automata} maxLength={240} placeholder="Ej.: Siemens SIMATIC S7-1500" onChange={(ev) => cambiar({ automata: ev.target.value })} />
                </Dato>
                <Dato campo="cpu" rotulo="Modelo exacto de la CPU y versión (firmware)">
                  <input value={t.cpu} maxLength={240} placeholder="Ej.: CPU 1513-1 PN, V2.9" onChange={(ev) => tecnica({ cpu: ev.target.value })} />
                </Dato>
              </>
            )}
            <Dato campo="programador" rotulo="Persona de contacto (quien programa el autómata)" ayuda="Nombre y teléfono o correo.">
              <input value={f.programador} maxLength={240} onChange={(ev) => cambiar({ programador: ev.target.value })} />
            </Dato>
            <Dato campo="permiso" rotulo="Qué podrá hacer Gradiox (permisos)" ayuda="Se propone empezar en solo lectura.">
              <Opciones<Permiso> valor={t.permiso} opciones={PERMISOS_T} alCambiar={(v) => tecnica({ permiso: v })} />
            </Dato>
            <Dato campo="enchufar" rotulo="¿Se puede conectar un equipo a la red de los equipos (red de control)?" ayuda="El equipo de Gradiox es una pasarela (gateway) que solo abre conexiones salientes hacia internet (HTTPS, puerto 443).">
              <Opciones<Enchufar> valor={t.enchufar} opciones={ENCHUFAR_T} alCambiar={(v) => tecnica({ enchufar: v })} />
            </Dato>
            <Dato campo="internet" rotulo="¿Hay salida a internet en ese punto?">
              <Opciones<Internet> valor={f.internet} opciones={INTERNET_T} alCambiar={(v) => cambiar({ internet: v })} />
            </Dato>
            <Dato campo="informatica" rotulo="Quién lleva la informática (responsable de redes)" ayuda="Nombre y teléfono o correo, si es otra persona.">
              <input value={f.informatica} maxLength={240} onChange={(ev) => cambiar({ informatica: ev.target.value })} />
            </Dato>
            <Dato campo="observaciones" ancho rotulo="Observaciones">
              <AreaTexto rows={3} value={t.observaciones} maxLength={8000} placeholder="Particularidades de la instalación, restricciones o cualquier dato que convenga conocer." onChange={(ev) => tecnica({ observaciones: ev.target.value })} />
            </Dato>
          </div>
        </details>

        <section className="gx-tarjeta" aria-labelledby="e-5">
          <h2 id="e-5">¿Qué mejoraría de este formulario? <span className="gx-opcional">Opcional</span></h2>
          <p className="gx-nota">Preguntas que sobran o faltan, términos mal dichos, un orden mejor. Para corregir un dato concreto, use «Comentar», debajo de cada uno.</p>
          <label className="gx-campo">
            <span className="gx-solo-lector">Opinión sobre el formulario</span>
            <AreaTexto rows={3} value={notas.de("")?.texto ?? ""} maxLength={MAX_COMENTARIO} placeholder="Su opinión nos ayuda a preguntar mejor." onChange={(ev) => notas.poner("", ev.target.value)} />
          </label>
        </section>

        <section className={`gx-tarjeta gx-enviar${enviada && !cambiada ? " hecho" : ""}`} aria-live="polite">
          {enviada > 0 && !cambiada ? (
            <>
              <h2><CircleCheck size={20} strokeWidth={1.7} aria-hidden="true" /> Enviado a Gradiox</h2>
              <p>Hemos recibido la ficha el {cuando(enviada)}. Gracias.</p>
              <p className="gx-nota">Si necesita corregir o añadir algo, cambie el dato aquí mismo, hoy o cualquier otro día desde este enlace, y vuelva a pulsar «Enviar».</p>
            </>
          ) : (
            <>
              <h2>{enviada > 0 ? "Hay cambios sin enviar" : "Cuando termine, envíe la ficha"}</h2>
              <p>{enviada > 0 ? `La ficha se envió el ${cuando(enviada)} y después se ha cambiado algo. Los cambios están guardados; pulse «Enviar los cambios» para avisar a Gradiox.` : "Lo que ha escrito se guarda solo, como borrador. Al enviar, avisamos a Gradiox de que ya puede revisarla. Puede enviarla aunque falte algún dato y volver después a este enlace a corregirla o completarla."}</p>
              {falloEnvio && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{falloEnvio}. Vuelva a intentarlo.</p>}
              <button type="button" className="gx-boton" disabled={enviando} onClick={() => void entregar()}>
                {enviando ? <LoaderCircle size={17} aria-hidden="true" className="gx-gira" /> : <Send size={17} strokeWidth={1.7} aria-hidden="true" />} {enviando ? "Enviando…" : enviada > 0 ? "Enviar los cambios" : "Enviar a Gradiox"}
              </button>
            </>
          )}
        </section>

        <p className="gx-nota gx-externa-pie">Enlace privado de Gradiox para esta instalación. No lo reenvíe a terceros.</p>
      </div>
    </main>
    </NotasCtx.Provider>
  );
}
