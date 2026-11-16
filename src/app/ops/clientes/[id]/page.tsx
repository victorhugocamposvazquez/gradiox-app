"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, CloudOff, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { SinBase } from "@/components/sin-base";
import {
  ESTADOS,
  INTERNET,
  SOLO_LECTURA,
  TIPOS_FOTO,
  TONO,
  instalacionVacia,
  puntoVacio,
  type Cliente,
  type DatosCliente,
  type EstadoCliente,
  type Foto,
  type Instalacion,
  type Internet,
  type PuntoFrio,
  type SoloLectura,
  type TipoFoto,
} from "@/clientes/modelo";
import { conJson, pedir, reducirFoto } from "@/clientes/navegador";

type Guardado = "guardado" | "pendiente" | "guardando" | "fallo";
const ESPERA_MS = 900;

function Campo({ rotulo, valor, alCambiar, ancho, lineas, ...resto }: { rotulo: string; valor: string; alCambiar: (v: string) => void; ancho?: boolean; lineas?: number; type?: string; placeholder?: string; maxLength?: number; inputMode?: "tel" | "email" | "text" }) {
  return (
    <label className={`gx-campo${ancho ? " ancho" : ""}`}>
      {rotulo}
      {lineas ? <textarea rows={lineas} value={valor} onChange={(ev) => alCambiar(ev.target.value)} placeholder={resto.placeholder} maxLength={resto.maxLength} /> : <input value={valor} onChange={(ev) => alCambiar(ev.target.value)} autoComplete="off" {...resto} />}
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

export default function Ficha() {
  const { id } = useParams<{ id: string }>();
  const ir = useRouter();
  const [c, setC] = useState<Cliente | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [base, setBase] = useState(true);
  const [fallo, setFallo] = useState("");
  const [estado, setEstado] = useState<Guardado>("guardado");
  const [subiendo, setSubiendo] = useState(0);
  const [falloFoto, setFalloFoto] = useState("");
  const [tipoFoto, setTipoFoto] = useState<TipoFoto>("controlador");
  const [dondeFoto, setDondeFoto] = useState("");
  const [grande, setGrande] = useState<Foto | null>(null);
  const version = useRef(0);
  const ultimo = useRef<DatosCliente | null>(null);
  const reloj = useRef<number | undefined>(undefined);
  const visor = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let vivo = true;
    pedir<{ guardado: "memoria" | "base"; cliente: Cliente; fotos: Foto[] }>(`/api/ops/clientes/${id}`)
      .then((d) => {
        if (!vivo) return;
        setC(d.cliente);
        setFotos(d.fotos);
        setBase(d.guardado === "base");
      })
      .catch((e: Error) => vivo && setFallo(e.message));
    return () => {
      vivo = false;
    };
  }, [id]);

  const enviar = useCallback(async () => {
    const datos = ultimo.current;
    if (!datos) return;
    if (!datos.nombre.trim()) return setEstado("fallo");
    const v = version.current;
    setEstado("guardando");
    try {
      await pedir(`/api/ops/clientes/${id}`, { ...conJson("PUT", datos), keepalive: true });
      if (version.current === v) setEstado("guardado");
    } catch {
      if (version.current === v) setEstado("fallo");
    }
  }, [id]);

  // Cada cambio se guarda solo, un momento después de dejar de escribir.
  const cambiar = (parte: Partial<DatosCliente>) => {
    if (!c) return;
    const nuevo = { ...c, ...parte };
    setC(nuevo);
    ultimo.current = nuevo;
    version.current++;
    setEstado("pendiente");
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => void enviar(), ESPERA_MS);
  };
  // Al salir de la pantalla o cerrar la app, se guarda lo que quedara pendiente.
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

  const instalacion = (i: Instalacion, parte: Partial<Instalacion>) => cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === i.id ? { ...x, ...parte } : x)) });
  const punto = (i: Instalacion, p: PuntoFrio, parte: Partial<PuntoFrio>) => instalacion(i, { puntos: i.puntos.map((x) => (x.id === p.id ? { ...x, ...parte } : x)) });
  const nombreSitio = (f: Foto) => {
    const i = c.instalaciones.find((x) => x.id === f.instalacion);
    const p = i?.puntos.find((x) => x.id === f.punto);
    return p?.nombre || i?.nombre || "";
  };
  // Dónde se hizo la foto: una instalación entera o uno de sus puntos de frío.
  const sitios = c.instalaciones.flatMap((i, n) => [
    { valor: `${i.id}|`, texto: i.nombre || `Instalación ${n + 1}` },
    ...i.puntos.filter((p) => p.nombre).map((p) => ({ valor: `${i.id}|${p.id}`, texto: `${i.nombre || `Instalación ${n + 1}`} · ${p.nombre}` })),
  ]);

  const subir = async (ev: ChangeEvent<HTMLInputElement>) => {
    const archivos = [...(ev.target.files ?? [])];
    ev.target.value = "";
    if (!archivos.length) return;
    setFalloFoto("");
    setSubiendo(archivos.length);
    const [inst = "", pto = ""] = dondeFoto.split("|");
    for (const archivo of archivos) {
      try {
        const cuerpo = new FormData();
        cuerpo.set("foto", await reducirFoto(archivo), "foto.jpg");
        cuerpo.set("tipo", tipoFoto);
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
    } catch (e) {
      setFalloFoto(e instanceof Error ? e.message : "No se ha podido borrar la foto");
    }
  };
  const borrarCliente = async () => {
    try {
      window.clearTimeout(reloj.current);
      reloj.current = undefined;
      ultimo.current = null;
      await pedir(`/api/ops/clientes/${id}`, { method: "DELETE" });
      ir.push("/ops");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido borrar");
    }
  };

  const total = c.instalaciones.reduce((n, i) => n + i.puntos.length, 0);

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
          </p>
        </div>
      </header>

      <div className="gx-pila">
        {!base && <SinBase />}
        {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}

        <section className="gx-tarjeta" aria-labelledby="f-datos">
          <h2 id="f-datos">La empresa</h2>
          <div className="gx-formulario gx-ficha">
            <Campo rotulo="Nombre" valor={c.nombre} alCambiar={(v) => cambiar({ nombre: v })} maxLength={120} />
            <Lista<EstadoCliente> rotulo="En qué punto está" valor={c.estado} opciones={ESTADOS} alCambiar={(v) => cambiar({ estado: v })} />
            <Campo rotulo="Razón social" valor={c.razon} alCambiar={(v) => cambiar({ razon: v })} maxLength={160} />
            <Campo rotulo="NIF" valor={c.nif} alCambiar={(v) => cambiar({ nif: v })} maxLength={20} />
            <Campo rotulo="A qué se dedican" valor={c.actividad} alCambiar={(v) => cambiar({ actividad: v })} placeholder="Por ejemplo: almacén de congelados" maxLength={240} />
            <Campo rotulo="Dirección" valor={c.direccion} alCambiar={(v) => cambiar({ direccion: v })} maxLength={240} />
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

        {c.instalaciones.map((i, n) => (
          <section key={i.id} className="gx-tarjeta" aria-label={i.nombre || `Instalación ${n + 1}`}>
            <div className="gx-lista-cabeza">
              <h2>{i.nombre || `Instalación ${n + 1}`}</h2>
              <Borrar enlace texto="Quitar instalación" seguro="¿Quitar esta instalación y sus puntos de frío?" alBorrar={() => cambiar({ instalaciones: c.instalaciones.filter((x) => x.id !== i.id) })} />
            </div>
            <div className="gx-formulario gx-ficha">
              <Campo rotulo="Nombre de la instalación" valor={i.nombre} alCambiar={(v) => instalacion(i, { nombre: v })} placeholder="Por ejemplo: nave de Getafe" maxLength={120} />
              <Campo rotulo="Dirección, si es otra" valor={i.direccion} alCambiar={(v) => instalacion(i, { direccion: v })} maxLength={240} />
              <Lista<Internet> rotulo="Internet en la sala de los controladores" valor={i.internet} opciones={INTERNET} alCambiar={(v) => instalacion(i, { internet: v })} />
              <Campo rotulo="Cobertura del móvil en ese sitio" valor={i.cobertura} alCambiar={(v) => instalacion(i, { cobertura: v })} placeholder="Rayas y compañía" maxLength={240} />
              <Campo rotulo="Quién lleva la informática" valor={i.informatica} alCambiar={(v) => instalacion(i, { informatica: v })} maxLength={240} />
              <Campo rotulo="Sistema que ya tienen" valor={i.sistemaActual} alCambiar={(v) => instalacion(i, { sistemaActual: v })} placeholder="Nombre del programa o pantalla, si hay" maxLength={2000} />
              <Campo ancho lineas={2} rotulo="Dónde iría el aparato" valor={i.sitioAparato} alCambiar={(v) => instalacion(i, { sitioAparato: v })} placeholder="Cerca de los controladores, bajo techo y con enchufe" maxLength={2000} />
              <Campo ancho lineas={2} rotulo="Notas de esta instalación" valor={i.notas} alCambiar={(v) => instalacion(i, { notas: v })} maxLength={4000} />
            </div>

            <h3 className="gx-subtitulo">Puntos de frío · {i.puntos.length}</h3>
            {i.puntos.length === 0 ? (
              <p className="gx-vacio">Sin puntos de frío todavía. Añade uno por cada cámara, túnel o mueble.</p>
            ) : (
              <ul className="gx-puntos">
                {i.puntos.map((p, m) => (
                  <li key={p.id}>
                    <span className="numero" aria-hidden="true">{m + 1}</span>
                    <Campo rotulo="Cómo lo llaman" valor={p.nombre} alCambiar={(v) => punto(i, p, { nombre: v })} placeholder="Cámara 1" maxLength={120} />
                    <Campo rotulo="Qué guarda" valor={p.guarda} alCambiar={(v) => punto(i, p, { guarda: v })} placeholder="Pescado congelado" maxLength={240} />
                    <Campo rotulo="Temperatura que debe tener" valor={p.temperatura} alCambiar={(v) => punto(i, p, { temperatura: v })} placeholder="-20 °C" maxLength={60} />
                    <Campo rotulo="Controlador: marca y modelo" valor={p.controlador} alCambiar={(v) => punto(i, p, { controlador: v })} placeholder="Lo que ponga en la etiqueta" maxLength={240} />
                    <Campo rotulo="Notas" valor={p.notas} alCambiar={(v) => punto(i, p, { notas: v })} maxLength={2000} />
                    <button type="button" className="gx-boton-enlace quitar" aria-label={`Quitar ${p.nombre || `el punto ${m + 1}`}`} onClick={() => instalacion(i, { puntos: i.puntos.filter((x) => x.id !== p.id) })}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="gx-boton secundario" onClick={() => instalacion(i, { puntos: [...i.puntos, puntoVacio()] })}>
              <Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Añadir punto de frío
            </button>
          </section>
        ))}

        <section className="gx-tarjeta gx-anadir">
          <div>
            <h2>{c.instalaciones.length === 0 ? "Instalaciones y puntos de frío" : "Otra instalación"}</h2>
            <p className="gx-nota">{c.instalaciones.length === 0 ? "Una instalación es un sitio con frío: una nave, una tienda, un almacén. Dentro se apuntan sus cámaras." : `Este cliente tiene ${c.instalaciones.length === 1 ? "una instalación" : `${c.instalaciones.length} instalaciones`} y ${total === 1 ? "un punto de frío" : `${total} puntos de frío`}.`}</p>
          </div>
          <button type="button" className={c.instalaciones.length === 0 ? "gx-boton" : "gx-boton secundario"} onClick={() => cambiar({ instalaciones: [...c.instalaciones, instalacionVacia()] })}>
            <Plus size={16} strokeWidth={1.7} aria-hidden="true" /> Añadir instalación
          </button>
        </section>

        <section className="gx-tarjeta" aria-labelledby="f-fotos">
          <h2 id="f-fotos">Fotos · {fotos.length}</h2>
          <div className="gx-subir">
            <Lista<TipoFoto> rotulo="Qué se ve en la foto" valor={tipoFoto} opciones={TIPOS_FOTO} alCambiar={setTipoFoto} />
            {sitios.length > 0 && (
              <label className="gx-campo">
                De dónde es
                <select value={dondeFoto} onChange={(ev) => setDondeFoto(ev.target.value)}>
                  <option value="">Sin indicar</option>
                  {sitios.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                </select>
              </label>
            )}
            <label className={`gx-boton${subiendo ? " ocupado" : ""}`}>
              <Camera size={18} strokeWidth={1.6} aria-hidden="true" /> {subiendo ? `Subiendo ${subiendo}…` : "Hacer o elegir fotos"}
              <input type="file" accept="image/*" multiple className="gx-solo-lector" onChange={subir} disabled={subiendo > 0} />
            </label>
          </div>
          {falloFoto && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{falloFoto}</p>}
          {fotos.length === 0 ? (
            <p className="gx-vacio">Sin fotos todavía. Elige arriba qué vas a fotografiar y pulsa «Hacer o elegir fotos»: en el móvil se abre la cámara.</p>
          ) : (
            <ul className="gx-fotos">
              {fotos.map((f) => (
                <li key={f.id}>
                  <button type="button" className="imagen" onClick={() => setGrande(f)} aria-label={`Ver en grande: ${TIPOS_FOTO[f.tipo]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/ops/fotos/${f.id}`} alt={f.pie || TIPOS_FOTO[f.tipo]} loading="lazy" />
                  </button>
                  <label className="gx-campo">
                    <span className="gx-solo-lector">Qué se ve</span>
                    <select value={f.tipo} onChange={(ev) => void cambiarFoto(f, { tipo: ev.target.value as TipoFoto })}>
                      {(Object.keys(TIPOS_FOTO) as TipoFoto[]).map((k) => <option key={k} value={k}>{TIPOS_FOTO[k]}</option>)}
                    </select>
                  </label>
                  <label className="gx-campo">
                    <span className="gx-solo-lector">Nota de la foto</span>
                    <input defaultValue={f.pie} maxLength={240} placeholder="Nota" onBlur={(ev) => ev.target.value !== f.pie && void cambiarFoto(f, { pie: ev.target.value })} />
                  </label>
                  <div className="pie">
                    <small>{nombreSitio(f) || "Sin sitio"}</small>
                    <Borrar enlace texto="Borrar" seguro="¿Borrar la foto?" alBorrar={() => void borrarFoto(f)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gx-tarjeta" aria-labelledby="f-visita">
          <h2 id="f-visita">Lo que dijo el cliente</h2>
          <div className="gx-formulario gx-ficha">
            <Campo rotulo="Día de la visita" type="date" valor={c.visita.fecha} alCambiar={(v) => cambiar({ visita: { ...c.visita, fecha: v } })} />
            <Lista<SoloLectura> rotulo="¿Acepta empezar solo mirando?" valor={c.visita.soloLectura} opciones={SOLO_LECTURA} alCambiar={(v) => cambiar({ visita: { ...c.visita, soloLectura: v } })} />
            <Campo ancho lineas={2} rotulo="Qué le quita el sueño" valor={c.visita.preocupa} alCambiar={(v) => cambiar({ visita: { ...c.visita, preocupa: v } })} maxLength={4000} />
            <Campo ancho lineas={2} rotulo="Cómo se entera hoy de un fallo" valor={c.visita.comoSeEntera} alCambiar={(v) => cambiar({ visita: { ...c.visita, comoSeEntera: v } })} maxLength={4000} />
            <Campo ancho lineas={2} rotulo="Otras cosas que dijo" valor={c.visita.otras} alCambiar={(v) => cambiar({ visita: { ...c.visita, otras: v } })} maxLength={4000} />
            <Campo ancho lineas={3} rotulo="Notas internas" valor={c.notas} alCambiar={(v) => cambiar({ notas: v })} maxLength={8000} />
          </div>
        </section>

        <section className="gx-tarjeta gx-anadir">
          <div>
            <h2>Borrar el cliente</h2>
            <p className="gx-nota">Se borran su ficha y todas sus fotos. No se puede deshacer.</p>
          </div>
          <Borrar texto="Borrar cliente" seguro="¿Borrar la ficha y sus fotos?" alBorrar={() => void borrarCliente()} />
        </section>
      </div>

      <dialog ref={visor} className="gx-visor" onClose={() => setGrande(null)} onClick={(ev) => ev.target === visor.current && visor.current?.close()}>
        {grande && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/ops/fotos/${grande.id}`} alt={grande.pie || TIPOS_FOTO[grande.tipo]} />
            <p>
              <span>{[TIPOS_FOTO[grande.tipo], nombreSitio(grande), grande.pie].filter(Boolean).join(" · ")}</span>
              <button type="button" className="gx-boton secundario" onClick={() => visor.current?.close()}>Cerrar</button>
            </p>
          </>
        )}
      </dialog>
    </>
  );
}
