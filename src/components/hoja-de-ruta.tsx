"use client";

// La hoja de ruta de un cliente en su ficha del panel: por dónde va el alta,
// cómo está lo que ya funciona y la entrada de soporte a su app.

import Link from "next/link";
import { Check, Copy, LifeBuoy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FASES, instalacionVacia, puntoVacio, type Cliente, type DatosCliente, type Fase, type Instalacion } from "@/clientes/modelo";
import { PERMISOS, VIAS, type Permiso, type Via } from "@/clientes/tecnica";
import { conJson, pedir } from "@/clientes/navegador";
import type { Ruta } from "@/clientes/ruta";

type PasarelaRuta = { id: string; nombre: string; ubicacion: string; variables: number; propuestas: number; estrenada: boolean };
type Estado = { ahora: number; ruta: Ruta; pasarelas: PasarelaRuta[]; visitas: { t: number; motivo: string }[] };
const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PUNTO = { bien: "", mirar: "mirar", mal: "mal" } as const;
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

function HacerPaso({ id, c, cambiar, e, recargar, secretos, guardarSecretos }: { id: string; c: Cliente; cambiar: (parte: Partial<DatosCliente>) => void; e: Estado; recargar: () => Promise<void>; secretos: Secretos; guardarSecretos: (s: Partial<Secretos>) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState("");
  const [nave, setNave] = useState("");
  const [camaras, setCamaras] = useState("");
  const [nombrePasarela, setNombrePasarela] = useState("");
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
            <p className="gx-nota">El token se enseñó al crear la pasarela. Si no lo tienes, en <Link href="/ops/pasarelas" className="gx-volver">Pasarelas</Link> se le da uno nuevo.</p>
          )}
          <ol className="gx-ruta-guia">
            <li>Instala el programa de la pasarela en el ordenador de la planta que está en la red del autómata.</li>
            <li>Al abrirlo, pega el token y la dirección del autómata.</li>
            <li>En cuanto entregue la primera lectura, este paso se marca solo.</li>
          </ol>
          <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer(async () => undefined)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /> Comprobar ahora</button>
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
    case "visita": {
      const apuntar = (ev: FormEvent) => {
        ev.preventDefault();
        const puntos = camaras.split(/\n|,/).map((t) => t.trim()).filter(Boolean).map((n) => ({ ...puntoVacio(), nombre: n.slice(0, 120) }));
        if (inst) instalacion(inst, { nombre: inst.nombre || nave.trim(), fase: inst.fase === "sinvisitar" ? "visitada" : inst.fase, puntos: [...inst.puntos, ...puntos] });
        else cambiar({ instalaciones: [{ ...instalacionVacia(nave.trim()), fase: "visitada", puntos }] });
        setCamaras("");
      };
      return (
        <form className="gx-ruta-hacer gx-formulario" onSubmit={apuntar}>
          {!inst?.nombre && <label className="gx-campo">Nombre de la nave o instalación<input value={nave} onChange={(ev) => setNave(ev.target.value)} maxLength={120} placeholder="Nave de Alvedro" required /></label>}
          <label className="gx-campo ancho">Cámaras, una por línea<textarea value={camaras} onChange={(ev) => setCamaras(ev.target.value)} rows={4} placeholder={"Cámara 6\nCámara 7A\nTúnel 1"} required /></label>
          <button type="submit" className="gx-boton">Apuntar visita y cámaras</button>
          <p className="gx-nota">Las fotos y el detalle de cada cámara se añaden cuando quieras en «Instalación y cámaras»; para seguir no hacen falta.</p>
        </form>
      );
    }
    case "tecnica":
      if (!inst) return <p className="gx-nota">Primero apunta la instalación en el paso 2.</p>;
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
          <label className="gx-campo">Autómata (PLC)<input value={inst.automata} maxLength={240} onChange={(ev) => instalacion(inst, { automata: ev.target.value })} placeholder="Siemens S7-1500" /></label>
        </div>
      );
    case "aceptada":
      if (!inst) return <p className="gx-nota">Primero apunta la instalación en el paso 2.</p>;
      return (
        <div className="gx-ruta-hacer">
          <button type="button" className="gx-boton" onClick={() => cambiar({ instalaciones: c.instalaciones.map((i) => (ORDEN_FASE.indexOf(i.fase) < ORDEN_FASE.indexOf("aceptada") ? { ...i, fase: "aceptada" as Fase } : i)) })}>El cliente ha aceptado la propuesta</button>
        </div>
      );
    case "pasarela": {
      const crear = (ev: FormEvent) => {
        ev.preventDefault();
        void hacer(async () => {
          const d = await pedir<{ pasarela: { id: string }; token: string }>("/api/ops/pasarelas", conJson("POST", { nombre: nombrePasarela.trim() || inst?.nombre || c.nombre }));
          await pedir(app, conJson("POST", { accion: "instalacion", pasarela: d.pasarela.id, suya: true }));
          // Con una sola nave en la ficha, la pasarela queda ya ubicada en ella.
          if (c.instalaciones.length === 1) await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: d.pasarela.id, ubicacion: c.instalaciones[0].id }));
          setToken(d.token);
        });
      };
      // Recién creada, se enseña ya el token y cómo instalarla: es lo que toca a continuación.
      if (token) return instalar;
      return (
        <form className="gx-ruta-hacer gx-formulario" onSubmit={crear}>
          <label className="gx-campo">Nombre de la pasarela<input value={nombrePasarela} onChange={(ev) => setNombrePasarela(ev.target.value)} maxLength={80} placeholder={inst?.nombre || c.nombre} /></label>
          <button type="submit" className="gx-boton" disabled={ocupado}>{ocupado ? "Creando…" : "Crear la pasarela de este cliente"}</button>
          <p className="gx-nota">Se crea, queda asignada a este cliente y te da su token para instalar el programa.</p>
          {error}
        </form>
      );
    }
    case "leyendo":
      return instalar;
    case "variables": {
      const con = e.pasarelas.filter((p) => p.variables === 0 && p.propuestas > 0);
      return (
        <div className="gx-ruta-hacer">
          {con.length === 0 ? (
            <p className="gx-nota">El programa todavía no ha propuesto ninguna lista: la manda al conectar con el autómata.</p>
          ) : (
            con.map((p) => (
              <p key={p.id} className="gx-ruta-linea">
                <span>{p.nombre}: el programa propone {p.propuestas} variables.</span>
                <button type="button" className="gx-boton" disabled={ocupado} onClick={() => void hacer(async () => { await pedir(`/api/ops/pasarelas/${p.id}`, conJson("POST", { accion: "aceptar-propuesta" })); })}>Aceptar la lista</button>
                <Link href="/ops/pasarelas" className="gx-volver">Revisarla antes</Link>
              </p>
            ))
          )}
          {error}
        </div>
      );
    }
    case "ubicacion":
      return (
        <div className="gx-ruta-hacer gx-formulario">
          {c.instalaciones.length === 0 && <p className="gx-nota">Primero apunta la instalación en el paso 2.</p>}
          {e.pasarelas.filter((p) => !p.ubicacion).map((p) => (
            <label key={p.id} className="gx-campo">Dónde está «{p.nombre}»
              <select value="" disabled={ocupado} onChange={(ev) => void hacer(async () => { await pedir(app, conJson("POST", { accion: "ubicacion", pasarela: p.id, ubicacion: ev.target.value })); })}>
                <option value="" disabled>Elige la nave o el almacén</option>
                {c.instalaciones.map((i) => <option key={i.id} value={i.id}>{i.nombre || "Sin nombre"}</option>)}
              </select>
            </label>
          ))}
          {error}
        </div>
      );
    case "usuarios": {
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
          <label className="gx-campo">Usuario<input value={usuario} onChange={(ev) => setUsuario(ev.target.value)} placeholder="antonio.rgv" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} required minLength={3} /></label>
          <label className="gx-campo">Nombre<input value={persona} onChange={(ev) => setPersona(ev.target.value)} placeholder={c.contacto.nombre || "Antonio Franco"} autoComplete="off" maxLength={120} /></label>
          <button type="submit" className="gx-boton" disabled={ocupado}>Crear usuario</button>
          {error}
        </form>
      );
    }
    case "entrada":
      return (
        <div className="gx-ruta-hacer">
          {clave && (
            <div className="gx-app-clave" role="status">
              <p><strong>Contraseña de {clave.usuario}</strong> Mándasela ahora: no se vuelve a enseñar.</p>
              <code>{clave.clave}</code>
              <Copiar texto={`Gradiox · https://gradiox.com/login\nUsuario: ${clave.usuario}\nContraseña: ${clave.clave}`} rotulo="Copiar usuario y contraseña" />
            </div>
          )}
          <p className="gx-nota">Mándale su usuario y su contraseña y entrad juntos la primera vez. Al entrar, este paso se marca solo.</p>
          <button type="button" className="gx-boton secundario" disabled={ocupado} onClick={() => void hacer(async () => undefined)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /> Comprobar ahora</button>
        </div>
      );
    default:
      return null;
  }
}

export function HojaDeRuta({ c, cambiar, guardado }: { c: Cliente; cambiar: (parte: Partial<DatosCliente>) => void; guardado: string }) {
  const cliente = c.id;
  const nombre = c.nombre;
  const [e, setE] = useState<Estado | null>(null);
  const [fallo, setFallo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [entrando, setEntrando] = useState(false);
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
  // El paso que toca está siempre abierto; cualquier otro pendiente se abre al pulsarlo.
  const desplegado = (id: string) => id === (abierto ?? ruta.siguiente?.id);

  return (
    <>
      <section className="gx-tarjeta gx-ruta" aria-labelledby="ruta-alta">
        <div className="gx-fila">
          <div>
            <h2 id="ruta-alta">Hoja de ruta del alta · {ruta.hechos} de {ruta.alta.length}</h2>
            <p className="gx-sub">{ruta.siguiente ? "Cada paso se completa aquí mismo y se marca solo." : "Alta completa: el cliente está dentro y su instalación lee."}</p>
          </div>
          <span className={`gx-chip ${ruta.siguiente ? "azul" : "correcto"}`}>{ruta.siguiente ? "En curso" : "Completa"}</span>
        </div>
        <div className="gx-ruta-barra" role="img" aria-label={`${ruta.hechos} de ${ruta.alta.length} pasos hechos`}><i style={{ width: `${(ruta.hechos / ruta.alta.length) * 100}%` }} /></div>
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
                  <HacerPaso id={p.id} c={c} cambiar={cambiar} e={e} recargar={recargar} secretos={secretos} guardarSecretos={(x) => setSecretos((y) => ({ ...y, ...x }))} />
                  {p.hecho && <button type="button" className="gx-boton" onClick={() => setAbierto(null)}>Hecho, seguir con el siguiente</button>}
                </div>
              )}
            </li>
          ))}
        </ol>
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

type Resumen = { id: string; nombre: string; hechos: number; total: number; siguiente: string | null; enMarcha: boolean; mal: string[]; mirar: number };

/** En la portada del panel: por dónde va cada cliente. */
export function RutasDeTodos() {
  const [rutas, setRutas] = useState<Resumen[] | null>(null);
  useEffect(() => {
    pedir<{ rutas: Resumen[] }>("/api/ops/rutas").then((d) => setRutas(d.rutas)).catch(() => setRutas([]));
  }, []);
  if (!rutas?.length) return null;
  return (
    <section className="gx-tarjeta gx-ruta" aria-labelledby="rutas-todos">
      <h2 id="rutas-todos">Hoja de ruta de cada cliente</h2>
      <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
        {rutas.map((r) => (
          <li key={r.id}>
            <span className={`gx-punto ${r.mal.length ? "mal" : r.siguiente || r.mirar ? "mirar" : ""}`} role="img" aria-label={r.mal.length ? "Falla" : r.siguiente || r.mirar ? "Por mirar" : "Bien"} />
            <span>
              <strong style={{ fontWeight: 500 }}>{r.nombre || "Cliente sin nombre"} · {r.hechos} de {r.total}</strong>
              <small>{r.mal[0] ?? (r.siguiente ? `Ahora toca: ${r.siguiente.charAt(0).toLowerCase()}${r.siguiente.slice(1)}` : r.mirar ? `Alta completa · ${r.mirar} por mirar en el seguimiento` : "Alta completa y todo bien")}</small>
              <span className="gx-ruta-barra" aria-hidden="true"><i style={{ width: `${(r.hechos / r.total) * 100}%` }} /></span>
            </span>
            <Link href={`/ops/clientes/${r.id}`} className="gx-volver" aria-label={`Abrir la hoja de ruta de ${r.nombre}`}>Ver</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
