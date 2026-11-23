"use client";

// En la ficha del cliente del panel interno: quién de ese cliente entra en la
// app de Gradiox y qué instalaciones conectadas son suyas. Cada usuario solo
// ve las instalaciones marcadas aquí.

import { Copy, KeyRound, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { Acceso } from "@/accesos/modelo";
import { conJson, pedir } from "@/clientes/navegador";

type PasarelaDeCliente = { id: string; nombre: string; suya: boolean; ubicacion: string; deOtro?: string; ultima: number | null };
type Estado = { ahora: number; accesos: Acceso[]; pasarelas: PasarelaDeCliente[]; clave?: string };

const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AppCliente({ cliente, nombreCliente, instalaciones }: { cliente: string; nombreCliente: string; instalaciones: { id: string; nombre: string }[] }) {
  const ruta = `/api/ops/clientes/${cliente}/app`;
  const [e, setE] = useState<Estado | null>(null);
  const [fallo, setFallo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nueva, setNueva] = useState<{ usuario: string; clave: string } | null>(null);
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [demo, setDemo] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    pedir<Estado>(ruta).then(setE).catch((x: Error) => setFallo(x.message));
  }, [ruta]);

  const hacer = async (cuerpo: Record<string, unknown>, quien?: string) => {
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<Estado>(ruta, conJson("POST", cuerpo));
      setE(d);
      if (d.clave && quien) {
        setNueva({ usuario: quien, clave: d.clave });
        setCopiado(false);
      }
      return true;
    } catch (x) {
      setFallo((x as Error).message);
      return false;
    } finally {
      setOcupado(false);
    }
  };
  const crear = async (ev: FormEvent) => {
    ev.preventDefault();
    const u = usuario.trim().toLowerCase();
    if (await hacer({ accion: "crear", usuario: u, nombre, demo }, u)) {
      setUsuario("");
      setNombre("");
    }
  };
  const copiar = async () => {
    if (!nueva) return;
    try {
      await navigator.clipboard.writeText(`Gradiox · https://gradiox.com/login\nUsuario: ${nueva.usuario}\nContraseña: ${nueva.clave}`);
      setCopiado(true);
    } catch {
      // Sin portapapeles se copia a mano.
    }
  };

  if (!e) return <section className="gx-tarjeta"><p className="gx-vacio">{fallo || "Cargando…"}</p></section>;
  const suyas = e.pasarelas.filter((p) => p.suya);

  return (
    <>
      <section className="gx-tarjeta gx-pila" aria-labelledby="f-app-que" style={{ gap: 10 }}>
        <h2 id="f-app-que">Cómo funciona</h2>
        <p className="gx-nota" style={{ margin: 0 }}>
          Cada persona de {nombreCliente || "este cliente"} entra en la app de Gradiox (gradiox.com) con su usuario y su contraseña. Solo ve las instalaciones conectadas que estén marcadas aquí como suyas: las de otros clientes no le aparecen en ningún sitio, ni en Hoy, ni en Servicios, ni en Históricos.
          La contraseña la crea Gradiox y se enseña una sola vez; no se guarda, solo su huella, así que si se pierde se crea otra. Al crear otra o desactivar a alguien, se le cierra la sesión en todos sus aparatos.
        </p>
      </section>

      <section className="gx-tarjeta" aria-labelledby="f-app-inst">
        <h2 id="f-app-inst">Instalaciones que ve · {suyas.length}</h2>
        {e.pasarelas.length === 0 ? (
          <p className="gx-vacio">Todavía no hay ninguna instalación con pasarela. Se da de alta en Instalaciones.</p>
        ) : (
          <ul className="gx-app-lista">
            {e.pasarelas.map((p) => (
              <li key={p.id}>
                <label>
                  <input type="checkbox" checked={p.suya} disabled={ocupado} onChange={(ev) => void hacer({ accion: "instalacion", pasarela: p.id, suya: ev.target.checked })} />
                  <span>
                    <strong>{p.nombre}</strong>
                    <small>
                      {p.ultima ? `Última entrega ${fecha(p.ultima)}` : "Sin entregas todavía"}
                      {p.deOtro ? ` · ahora es de ${p.deOtro}: al marcarla pasa a ser de este cliente` : ""}
                    </small>
                  </span>
                </label>
                {p.suya && (
                  <label className="gx-campo gx-app-ubicacion">
                    Ubicación
                    <select value={p.ubicacion} disabled={ocupado} onChange={(ev) => void hacer({ accion: "ubicacion", pasarela: p.id, ubicacion: ev.target.value })}>
                      <option value="">La propia instalación ({p.nombre})</option>
                      {instalaciones.map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre || "Sin nombre"}</option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="gx-nota">La ubicación es la nave o el almacén donde está, de las instalaciones de la ficha (paso 2). En la app, el selector de arriba enseña las ubicaciones del cliente y, dentro de cada una, sus instalaciones con pasarela.</p>
      </section>

      <section className="gx-tarjeta" aria-labelledby="f-app-usuarios">
        <h2 id="f-app-usuarios">Usuarios · {e.accesos.length}</h2>
        {nueva && (
          <div className="gx-app-clave" role="status">
            <p><strong>Contraseña de {nueva.usuario}</strong> Apúntala o mándasela ahora: no se vuelve a enseñar.</p>
            <code>{nueva.clave}</code>
            <span className="gx-acciones" style={{ marginTop: 0 }}>
              <button type="button" className="gx-boton secundario" onClick={() => void copiar()}><Copy size={16} strokeWidth={1.7} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar usuario y contraseña"}</button>
              <button type="button" className="gx-boton-enlace" onClick={() => setNueva(null)}>Ya la tengo</button>
            </span>
          </div>
        )}
        {e.accesos.length === 0 ? (
          <p className="gx-vacio">Nadie de este cliente entra todavía. El primer paso es crear su usuario aquí abajo.</p>
        ) : (
          <ul className="gx-app-lista">
            {e.accesos.map((a) => (
              <li key={a.id} className={a.activo ? undefined : "apagado"}>
                <span>
                  <strong>{a.nombre || a.usuario} {!a.activo && <span className="gx-chip neutro">Desactivado</span>}{a.pideClave && <span className="gx-chip aviso">Pide contraseña nueva</span>}</strong>
                  <small>
                    Usuario {a.usuario} · {a.ultimo ? `entró por última vez el ${fecha(a.ultimo)}` : "no ha entrado nunca"}
                    {a.pideClave ? ` · pidió una contraseña nueva el ${fecha(a.pideClave)}: pulsa «Otra contraseña» y dásela` : ""}
                  </small>
                  <label className="gx-app-demo">
                    <input type="checkbox" checked={a.demo} disabled={ocupado} onChange={(ev) => void hacer({ accion: "cambiar", id: a.id, demo: ev.target.checked })} />
                    Ve también la nave de demostración
                  </label>
                </span>
                <span className="gx-app-botones">
                  <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer({ accion: "clave", id: a.id }, a.usuario)}><KeyRound size={16} strokeWidth={1.7} aria-hidden="true" /> Otra contraseña</button>
                  <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer({ accion: "cambiar", id: a.id, activo: !a.activo })}>
                    {a.activo ? <UserX size={16} strokeWidth={1.7} aria-hidden="true" /> : <UserCheck size={16} strokeWidth={1.7} aria-hidden="true" />} {a.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button type="button" className="gx-boton secundario" aria-label={`Borrar a ${a.usuario}`} disabled={ocupado} onClick={() => window.confirm(`¿Borrar a ${a.usuario}? Dejará de poder entrar.`) && void hacer({ accion: "borrar", id: a.id })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form className="gx-formulario gx-app-nuevo" onSubmit={crear}>
          <label className="gx-campo">
            Usuario
            <input value={usuario} onChange={(ev) => setUsuario(ev.target.value)} placeholder="antonio.rgv" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} required />
          </label>
          <label className="gx-campo">
            Nombre
            <input value={nombre} onChange={(ev) => setNombre(ev.target.value)} placeholder="Antonio Franco" autoComplete="off" maxLength={120} />
          </label>
          <label className="gx-app-demo">
            <input type="checkbox" checked={demo} onChange={(ev) => setDemo(ev.target.checked)} />
            Ve también la nave de demostración
          </label>
          <button type="submit" className="gx-boton" disabled={ocupado || usuario.trim().length < 3}><Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Crear usuario</button>
        </form>
        {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
      </section>
    </>
  );
}
