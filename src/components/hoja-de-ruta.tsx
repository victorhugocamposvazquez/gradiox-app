"use client";

// La hoja de ruta de un cliente en su ficha del panel: el alta paso a paso (un
// paso a la vista, con Atrás y Siguiente), cómo está lo que ya funciona y la
// entrada de soporte a su app.

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, LifeBuoy, ListChecks, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FASES, type Cliente, type DatosCliente, type Fase, type Foto, type Instalacion } from "@/clientes/modelo";
import { GuiaConexion } from "@/components/guia-conexion";
import { Button } from "@/components/ui/button";
import { GuiaVisitaRuta, type SubirFoto } from "@/components/guia-visita-ruta";
import { PERMISOS, SOPORTES, VIAS, type Permiso, type Soporte, type Via } from "@/clientes/tecnica";
import { conJson, pedir } from "@/clientes/navegador";
import type { Ruta } from "@/clientes/ruta";

type PasarelaRuta = { id: string; nombre: string; ubicacion: string; variables: number; propuestas: number; estrenada: boolean };
type Estado = { ahora: number; ruta: Ruta; pasarelas: PasarelaRuta[]; visitas: { t: number; motivo: string }[] };
const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PUNTO = { bien: "", mirar: "mirar", mal: "mal" } as const;
/** Pasos que, ya hechos, se vuelven a abrir aquí mismo para completar o corregir. */
const EN_LINEA = new Set(["empresa", "visita", "tecnica", "conectada", "acceso"]);
const ORDEN_FASE = Object.keys(FASES) as Fase[];

function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" className="gx-boton secundario" onClick={() => void navigator.clipboard.writeText(texto).then(() => setHecho(true), () => undefined)}>
      <Copy size={16} strokeWidth={1.7} aria-hidden="true" /> {hecho ? "Copiado" : rotulo}
    </button>
  );
}

/**
 * Lo que hace falta para dar un paso por hecho, ahí mismo: los campos justos
 * de ese paso, sin salir de la hoja de ruta. Lo que toca la ficha se guarda
 * con el guardado automático de la propia ficha.
 */
type Secretos = { token: string; clave: { usuario: string; clave: string } | null };

function HacerPaso({ id, c, cambiar, e, recargar, secretos, guardarSecretos, fotos, subir }: { fotos: Foto[]; subir: SubirFoto; id: string; c: Cliente; cambiar: (parte: Partial<DatosCliente>) => void; e: Estado; recargar: () => Promise<void>; secretos: Secretos; guardarSecretos: (s: Partial<Secretos>) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [persona, setPersona] = useState("");
  const { token, clave } = secretos;
  const setToken = (t: string) => guardarSecretos({ token: t });
  const setClave = (k: Secretos["clave"]) => guardarSecretos({ clave: k });
  const app = `/api/ops/clientes/${c.id}/app`;
  const inst = c.instalaciones[0];
  const instalacion = (i: Instalacion, parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === i.id ? { ...x, ...parte } : x)) });
  const hacer = async (f: () => Promise<void>) => {
    setOcupado(true);
    setFallo("");
    try {
      await f();
      await recargar();
    } catch (x) {
      setFallo((x as Error).message);
    }
    setOcupado(false);
  };
  const error = fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>;

  const instalar = (
        <div className="gx-ruta-hacer">
          {token ? (
            <div className="gx-app-clave" role="status">
              <p><strong>Token de la pasarela</strong> Cópialo ahora: no se vuelve a enseñar.</p>
              <code>{token}</code>
              <Copiar texto={token} rotulo="Copiar el token" />
            </div>
          ) : (
            <p className="gx-nota">El token se enseñó al conectar la nave. Si no lo tienes, en la propia nave, pestaña «Ajustes», se le da uno nuevo.</p>
          )}
          <ol className="gx-ruta-guia">
            <li>{inst?.tecnica.soporte === "aparato" ? "Enchufa el aparato de Gradiox a la red del autómata y a la corriente." : inst?.tecnica.soporte === "ordenador" ? "Instala el programa de la pasarela en el ordenador del cliente que está en la red del autómata." : "Pon la pasarela en la red del autómata: el aparato de Gradiox, o el programa en un ordenador del cliente."}</li>
            <li>Al abrirlo, pega el token y la dirección del autómata.</li>
            <li>En cuanto entregue la primera lectura, este paso se marca solo.</li>
          </ol>
          <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer(async () => undefined)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /> Comprobar ahora</button>
          {inst?.automata && (
            <>
              <p className="gx-nota"><strong>La visita de conexión, paso a paso.</strong> Para el día en que se va a la planta a conectar con el autómata. Solo leyendo.</p>
              <GuiaConexion />
            </>
          )}
        </div>
  );

  switch (id) {
    case "empresa":
      return (
        <div className="gx-ruta-hacer gx-formulario">
          <label className="gx-campo">Persona de contacto<input value={c.contacto.nombre} maxLength={120} onChange={(ev) => cambiar({ contacto: { ...c.contacto, nombre: ev.target.value } })} placeholder="Antonio Franco" /></label>
          <label className="gx-campo">Teléfono<input value={c.contacto.telefono} maxLength={40} inputMode="tel" onChange={(ev) => cambiar({ contacto: { ...c.contacto, telefono: ev.target.value } })} /></label>
          <label className="gx-campo">Correo<input value={c.contacto.correo} maxLength={160} inputMode="email" onChange={(ev) => cambiar({ contacto: { ...c.contacto, correo: ev.target.value } })} /></label>
        </div>
      );
    case "visita":
      // La guía de visita entera, rellenándose aquí.
      return <div className="gx-ruta-hacer"><GuiaVisitaRuta c={c} cambiar={cambiar} fotos={fotos} subir={subir} /></div>;
    case "tecnica":
      if (!inst) return <p className="gx-nota">Primero apunta la nave en el paso 2.</p>;
      return (
        <div className="gx-ruta-hacer gx-formulario">
          <label className="gx-campo">Vía de conexión (protocolo)
            <select value={inst.tecnica.via} onChange={(ev) => instalacion(inst, { tecnica: { ...inst.tecnica, via: ev.target.value as Via } })}>
              {(Object.keys(VIAS) as Via[]).map((v) => <option key={v} value={v}>{VIAS[v]}</option>)}
            </select>
          </label>
          <label className="gx-campo">Qué podrá hacer Gradiox (permisos)
            <select value={inst.tecnica.permiso} onChange={(ev) => instalacion(inst, { tecnica: { ...inst.tecnica, permiso: ev.target.value as Permiso } })}>
              {(Object.keys(PERMISOS) as Permiso[]).map((v) => <option key={v} value={v}>{PERMISOS[v]}</option>)}
            </select>
          </label>
          <label className="gx-campo">Dónde va la pasarela
            <select value={inst.tecnica.soporte} onChange={(ev) => instalacion(inst, { tecnica: { ...inst.tecnica, soporte: ev.target.value as Soporte } })}>
              {(Object.keys(SOPORTES) as Soporte[]).map((v) => <option key={v} value={v}>{SOPORTES[v]}</option>)}
            </select>
          </label>
          <label className="gx-campo">Autómata (PLC)<input value={inst.automata} maxLength={240} onChange={(ev) => instalacion(inst, { automata: ev.target.value })} placeholder="Siemens S7-1500" /></label>
        </div>
      );
    case "aceptada":
      if (!inst) return <p className="gx-nota">Primero apunta la nave en el paso 2.</p>;
      return (
        <div className="gx-ruta-hacer">
          <button type="button" className="gx-boton" onClick={() => cambiar({ instalaciones: c.instalaciones.map((i) => (ORDEN_FASE.indexOf(i.fase) < ORDEN_FASE.indexOf("aceptada") ? { ...i, fase: "aceptada" as Fase } : i)) })}>El cliente ha aceptado la propuesta</button>
        </div>
      );
    case "conectada": {
      // Cada nave sin conexión se conecta aquí: se crea su conexión, queda del cliente y en esa nave, y sale el token.
      const conectar = (i: Instalacion) =>
        void hacer(async () => {
          const d = await pedir<{ pasarela: { id: string }; token: string }>("/api/ops/pasarelas", conJson("POST", { nombre: i.nombre || c.nombre }));
          await pedir(app, conJson("POST", { accion: "instalacion", pasarela: d.pasarela.id, suya: true }));
          await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: d.pasarela.id, ubicacion: i.id }));
          setToken(d.token);
        });
      const sinNave = e.pasarelas.filter((p) => !p.ubicacion || !c.instalaciones.some((i) => i.id === p.ubicacion));
      return (
        <div className="gx-ruta-hacer">
          {c.instalaciones.length === 0 && <p className="gx-nota">Primero apunta la nave en el paso 2.</p>}
          {c.instalaciones.map((i) => {
            const suya = e.pasarelas.find((p) => p.ubicacion === i.id);
            return (
              <p key={i.id} className="gx-ruta-linea">
                <span className="min-w-0 flex-1"><strong className="block font-medium">{i.nombre || "Nave sin nombre"}</strong><small className="block text-[13px] text-muted-foreground">{suya ? (suya.estrenada ? "Conectada y hablando con Gradiox" : "Conectada, falta instalar el programa") : "Sin conectar"}</small></span>
                {suya ? (
                  <Link href={`/ops/clientes/${c.id}/naves/${i.id}?pestana=conexion`} className="gx-volver">Ver su conexión</Link>
                ) : (
                  <button type="button" className="gx-boton" disabled={ocupado} onClick={() => conectar(i)}>{ocupado ? "Conectando…" : "Conectar esta nave"}</button>
                )}
              </p>
            );
          })}
          {sinNave.map((p) => (
            <label key={p.id} className="gx-campo">En qué nave está «{p.nombre}»
              <select value="" disabled={ocupado} onChange={(ev) => void hacer(async () => { await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: p.id, ubicacion: ev.target.value })); })}>
                <option value="" disabled>Elige la nave</option>
                {c.instalaciones.map((i) => <option key={i.id} value={i.id}>{i.nombre || "Sin nombre"}</option>)}
              </select>
            </label>
          ))}
          {token && (
            <div className="gx-app-clave" role="status">
              <p><strong>Token de la conexión</strong> Cópialo ahora: no se vuelve a enseñar. Lo pide el programa de la planta en el paso siguiente.</p>
              <code>{token}</code>
              <Copiar texto={token} rotulo="Copiar el token" />
            </div>
          )}
          {!token && <p className="gx-nota">Al conectar sale un token: es la llave con la que el programa de la planta entrega a Gradiox.</p>}
          {error}
        </div>
      );
    }
    case "leyendo": {
      // Primero que el programa hable con Gradiox; luego elegir qué variables se leen.
      const con = e.pasarelas.filter((p) => p.variables === 0 && p.propuestas > 0);
      const revisar = (p: PasarelaRuta) => (p.ubicacion ? `/ops/clientes/${c.id}/naves/${p.ubicacion}?pestana=lecturas` : `/ops/instalaciones/${p.id}?pestana=lecturas`);
      if (e.pasarelas.length > 0 && e.pasarelas.every((p) => p.estrenada))
        return (
          <div className="gx-ruta-hacer">
            {con.length === 0 ? (
              <p className="gx-nota">El programa ya habla con Gradiox. Falta que, en la planta, se marquen las variables que se leen (en la página del propio programa); en cuanto llegue la lista, este paso se marca solo.</p>
            ) : (
              con.map((p) => (
                <p key={p.id} className="gx-ruta-linea">
                  <span>{p.nombre}: el programa propone {p.propuestas} variables.</span>
                  <button type="button" className="gx-boton" disabled={ocupado} onClick={() => void hacer(async () => { await pedir(`/api/ops/pasarelas/${p.id}`, conJson("POST", { accion: "aceptar-propuesta" })); })}>Aceptar la lista</button>
                  <Link href={revisar(p)} className="gx-volver">Revisarla antes</Link>
                </p>
              ))
            )}
            <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer(async () => undefined)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /> Comprobar ahora</button>
            {error}
          </div>
        );
      return instalar;
    }
    case "acceso": {
      const crear = (ev: FormEvent) => {
        ev.preventDefault();
        const u = usuario.trim().toLowerCase();
        void hacer(async () => {
          const d = await pedir<{ clave?: string }>(app, conJson("POST", { accion: "crear", usuario: u, nombre: persona, demo: false }));
          if (d.clave) setClave({ usuario: u, clave: d.clave });
          setUsuario("");
          setPersona("");
        });
      };
      return (
        <form className="gx-ruta-hacer gx-formulario" onSubmit={crear}>
          {clave && (
            <div className="gx-app-clave" role="status">
              <p><strong>Contraseña de {clave.usuario}</strong> Mándasela ahora: no se vuelve a enseñar.</p>
              <code>{clave.clave}</code>
              <Copiar texto={`Gradiox · https://gradiox.com/login\nUsuario: ${clave.usuario}\nContraseña: ${clave.clave}`} rotulo="Copiar usuario y contraseña" />
            </div>
          )}
          <label className="gx-campo">Usuario<input value={usuario} onChange={(ev) => setUsuario(ev.target.value)} placeholder="antonio.rgv" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} required minLength={3} /></label>
          <label className="gx-campo">Nombre<input value={persona} onChange={(ev) => setPersona(ev.target.value)} placeholder={c.contacto.nombre || "Antonio Franco"} autoComplete="off" maxLength={120} /></label>
          <button type="submit" className={clave ? "gx-boton secundario" : "gx-boton"} disabled={ocupado}>{clave ? "Crear otro usuario" : "Crear su usuario"}</button>
          <p className="gx-nota">Mándale su usuario y su contraseña y entrad juntos la primera vez. Al entrar, este paso se marca solo. Más usuarios y permisos, en la pestaña «App».</p>
          <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer(async () => undefined)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /> Comprobar ahora</button>
          {error}
        </form>
      );
    }
    default:
      return null;
  }
}

export function HojaDeRuta({ c, cambiar, guardado, fotos, subir }: { c: Cliente; cambiar: (parte: Partial<DatosCliente>) => void; guardado: string; fotos: Foto[]; subir: SubirFoto }) {
  const cliente = c.id;
  const nombre = c.nombre;
  const [e, setE] = useState<Estado | null>(null);
  const [fallo, setFallo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [entrando, setEntrando] = useState(false);
  // El paso a la vista: el que toca, salvo que se elija otro. Con «todos» se ve la lista entera.
  const [vista, setVista] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  // El token y la contraseña recién creados se enseñan en el paso siguiente: se guardan aquí mientras la ficha esté abierta.
  const [secretos, setSecretos] = useState<Secretos>({ token: "", clave: null });

  const recargar = useCallback(async () => {
    try {
      setE(await pedir<Estado>(`/api/ops/clientes/${cliente}/ruta`));
    } catch (x) {
      setFallo((x as Error).message);
    }
  }, [cliente]);
  // Al abrir, y cada vez que la ficha termina de guardarse: así el paso se marca en cuanto está hecho.
  useEffect(() => {
    if (guardado === "guardado") void recargar();
  }, [guardado, recargar]);

  const entrar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEntrando(true);
    setFallo("");
    try {
      await pedir(`/api/ops/clientes/${cliente}/soporte`, conJson("POST", { motivo }));
      // La app se abre en otra pestaña: el panel se queda donde estaba.
      window.open("/", "_blank", "noopener");
      setMotivo("");
      await recargar();
    } catch (x) {
      setFallo((x as Error).message);
    }
    setEntrando(false);
  };

  if (!e) return <section className="gx-tarjeta"><p className="gx-vacio">{fallo || "Cargando la hoja de ruta…"}</p></section>;
  const { ruta } = e;
  const mal = ruta.seguimiento.filter((x) => x.nivel === "mal").length;
  const mirar = ruta.seguimiento.filter((x) => x.nivel === "mirar").length;
  // Paso a la vista: el elegido o, si no, el que toca. Con el alta completa se ve la lista entera.
  const enFoco = ruta.alta.find((p) => p.id === vista) ?? ruta.siguiente ?? null;
  const nFoco = enFoco ? ruta.alta.findIndex((p) => p.id === enFoco.id) : -1;
  // En la lista entera, el paso que toca está siempre abierto; cualquier otro pendiente se abre al pulsarlo.
  const desplegado = (id: string) => id === (abierto ?? ruta.siguiente?.id);

  return (
    <>
      <section className="gx-tarjeta gx-ruta" aria-labelledby="ruta-alta">
        <div className="gx-fila">
          <div>
            <h2 id="ruta-alta">Alta del cliente · {ruta.hechos} de {ruta.alta.length}</h2>
            <p className="gx-sub">{ruta.siguiente ? "Un paso cada vez. Se completa aquí mismo y se marca solo." : "Alta completa: el cliente está dentro y su nave lee."}</p>
          </div>
          <span className={`gx-chip ${ruta.siguiente ? "azul" : "correcto"}`}>{ruta.siguiente ? "En curso" : "Completa"}</span>
        </div>
        <div className="gx-ruta-barra" role="img" aria-label={`${ruta.hechos} de ${ruta.alta.length} pasos hechos`}><i style={{ width: `${(ruta.hechos / ruta.alta.length) * 100}%` }} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Pasos del alta">
          {ruta.alta.map((p, n) => {
            const actual = !todos && p.id === enFoco?.id;
            return (
              <button key={p.id} type="button" title={p.titulo} aria-label={`Paso ${n + 1}: ${p.titulo}${p.hecho ? " (hecho)" : ""}`} aria-current={actual ? "step" : undefined} onClick={() => { setTodos(false); setVista(p.id); }}
                className={`grid size-7 cursor-pointer place-items-center rounded-full border text-xs font-semibold ${p.hecho ? "border-transparent bg-[var(--gx-correcto)] text-white" : "border-border bg-background text-muted-foreground"} ${actual ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                {p.hecho ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : n + 1}
              </button>
            );
          })}
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setTodos(!todos)} aria-expanded={todos}><ListChecks aria-hidden="true" />{todos ? "Ver paso a paso" : "Ver todos los pasos"}</Button>
        </div>
        {todos || !enFoco ? (
          <ol className="gx-ruta-pasos">
            {ruta.alta.map((p, n) => (
              <li key={p.id} className={p.hecho ? "hecho" : p.id === ruta.siguiente?.id ? "ahora" : undefined}>
                <span className="marca" aria-hidden="true">{p.hecho ? <Check size={14} strokeWidth={2.4} /> : n + 1}</span>
                <span>
                  <strong>{p.titulo}</strong>
                  <small>{p.detalle}</small>
                </span>
                {p.hecho && abierto === p.id ? (
                  <span className="gx-chip correcto">Hecho</span>
                ) : p.hecho && EN_LINEA.has(p.id) ? (
                  <button type="button" className="gx-boton-enlace" onClick={() => setAbierto(p.id)}>Abrir</button>
                ) : p.hecho ? (
                  <Link href={p.donde} className="gx-volver" aria-label={`Ver: ${p.titulo}`}>Ver</Link>
                ) : p.id === ruta.siguiente?.id && abierto === null ? (
                  <span className="gx-chip azul">Ahora</span>
                ) : (
                  <button type="button" className="gx-boton-enlace" aria-expanded={desplegado(p.id)} onClick={() => setAbierto(desplegado(p.id) ? "" : p.id)}>{desplegado(p.id) ? "Cerrar" : "Hacerlo"}</button>
                )}
                {desplegado(p.id) && (!p.hecho || abierto === p.id) && (
                  // Al empezar a escribir, el paso se queda abierto aunque ya cuente como hecho: no se cierra a media frase.
                  <div className="gx-ruta-hueco" onFocusCapture={() => setAbierto(p.id)}>
                    <HacerPaso fotos={fotos} subir={subir} id={p.id} c={c} cambiar={cambiar} e={e} recargar={recargar} secretos={secretos} guardarSecretos={(x) => setSecretos((y) => ({ ...y, ...x }))} />
                    {p.hecho && <button type="button" className="gx-boton" onClick={() => setAbierto(null)}>{p.id === "visita" ? "Seguir con el siguiente paso del alta" : "Hecho, seguir con el siguiente"}</button>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <>
            <ol className="gx-ruta-pasos">
              <li className={enFoco.hecho ? "hecho" : "ahora"}>
                <span className="marca" aria-hidden="true">{enFoco.hecho ? <Check size={14} strokeWidth={2.4} /> : nFoco + 1}</span>
                <span>
                  <small>Paso {nFoco + 1} de {ruta.alta.length}</small>
                  <strong>{enFoco.titulo}</strong>
                  <small>{enFoco.detalle}</small>
                </span>
                {enFoco.hecho ? <span className="gx-chip correcto">Hecho</span> : enFoco.id === ruta.siguiente?.id ? <span className="gx-chip azul">Ahora</span> : <span />}
                {/* Al escribir, el paso se queda a la vista aunque ya cuente como hecho: no salta al siguiente a media frase. */}
                <div className="gx-ruta-hueco" onFocusCapture={() => setVista(enFoco.id)}>
                  {enFoco.hecho && !EN_LINEA.has(enFoco.id) ? (
                    <Link href={enFoco.donde} className="gx-volver">Ver dónde está</Link>
                  ) : (
                    <HacerPaso fotos={fotos} subir={subir} id={enFoco.id} c={c} cambiar={cambiar} e={e} recargar={recargar} secretos={secretos} guardarSecretos={(x) => setSecretos((y) => ({ ...y, ...x }))} />
                  )}
                </div>
              </li>
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {nFoco > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setVista(ruta.alta[nFoco - 1].id)}><ArrowLeft aria-hidden="true" />Atrás</Button>}
              <span className="flex-1" />
              {ruta.siguiente && ruta.siguiente.id !== enFoco.id && !enFoco.hecho && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setVista(null)}>Ir al paso que toca</Button>
              )}
              {nFoco < ruta.alta.length - 1 && (
                <Button type="button" variant={enFoco.hecho ? "default" : "outline"} size="sm" onClick={() => setVista(ruta.alta[nFoco + 1].id)}>
                  {enFoco.hecho ? "Siguiente" : "Saltar por ahora"}<ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <div className="gx-dos igual">
        <section className="gx-tarjeta" aria-labelledby="ruta-seg">
          <h2 id="ruta-seg">Seguimiento{ruta.enMarcha ? ` · ${mal ? `${mal} ${mal === 1 ? "fallo" : "fallos"}` : mirar ? `${mirar} por mirar` : "todo bien"}` : ""}</h2>
          {ruta.seguimiento.length === 0 ? (
            <p className="gx-vacio">Empieza cuando su pasarela se estrene: aquí se verá si entrega, si llega al autómata y si el cliente usa la app.</p>
          ) : (
            <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
              {ruta.seguimiento.map((x) => (
                <li key={x.id}>
                  <span className={`gx-punto ${PUNTO[x.nivel]}`} role="img" aria-label={x.nivel === "mal" ? "Falla" : x.nivel === "mirar" ? "Por mirar" : "Bien"} />
                  <span>
                    <strong style={{ fontWeight: 500 }}>{x.titulo}</strong>
                    <small>{x.detalle}</small>
                  </span>
                  {x.nivel !== "bien" && <Link href={x.donde} className="gx-volver">Ver</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gx-tarjeta" aria-labelledby="ruta-soporte">
          <h2 id="ruta-soporte">Ver su app como soporte</h2>
          <p className="gx-nota" style={{ marginTop: 6 }}>Abre la app tal como la ve {nombre || "este cliente"}, una hora y sin poder cambiar nada. El motivo queda apuntado aquí y el cliente lo puede ver en su app, en Seguridad.</p>
          <form className="gx-formulario" onSubmit={entrar} style={{ marginTop: 10 }}>
            <label className="gx-campo">
              Motivo de la visita
              <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} maxLength={200} placeholder="Dice que no ve la cámara 12" required minLength={5} />
            </label>
            <button type="submit" className="gx-boton" disabled={entrando || motivo.trim().length < 5}><LifeBuoy size={16} strokeWidth={1.7} aria-hidden="true" /> {entrando ? "Abriendo…" : "Entrar a ver su app"}</button>
          </form>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
          {e.visitas.length > 0 && (
            <>
              <h3 className="gx-subtitulo">Últimas visitas</h3>
              <ul className="gx-lista gx-compro">
                {e.visitas.map((v) => (
                  <li key={v.t}><span><strong style={{ fontWeight: 500 }}>{fecha(v.t)}</strong><small>{v.motivo}</small></span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
