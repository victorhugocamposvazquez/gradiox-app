"use client";

// La visita, dentro de la hoja de ruta: los pasos de la guía de visita en su
// orden, cada uno con qué hacer y con los campos donde se apunta lo que pide.
// Es la misma guía (src/lib/visita.ts), pero rellenándose a la vez.

import Link from "next/link";
import { Camera, Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MasInfo } from "@/components/mas-info";
import { INTERNET, SOLO_LECTURA, instalacionVacia, puntoVacio, type Cliente, type DatosCliente, type Foto, type Instalacion, type Internet, type PuntoFrio, type SoloLectura, type TipoFoto } from "@/clientes/modelo";
import { PASOS_VISITA, ROTULOS_VISITA } from "@/lib/visita";

export type SubirFoto = (archivos: File[], tipo: TipoFoto, instalacion?: string, punto?: string) => Promise<void>;

function BotonFoto({ rotulo, hay, alElegir }: { rotulo: string; hay: number; alElegir: (a: File[]) => void }) {
  return (
    <label className={`gx-boton secundario gx-ruta-foto${hay ? " hecha" : ""}`}>
      {hay ? <Check size={15} strokeWidth={2.2} aria-hidden="true" /> : <Camera size={15} strokeWidth={1.7} aria-hidden="true" />} {rotulo}{hay > 1 ? ` · ${hay}` : ""}
      <input type="file" accept="image/*" capture="environment" className="gx-solo-lector" onChange={(ev) => { const a = [...(ev.target.files ?? [])]; ev.target.value = ""; if (a.length) alElegir(a); }} />
    </label>
  );
}

export function GuiaVisitaRuta({ c, cambiar, fotos, subir }: { c: Cliente; cambiar: (parte: Partial<DatosCliente>) => void; fotos: Foto[]; subir: SubirFoto }) {
  const inst: Instalacion | undefined = c.instalaciones[0];
  const [nave, setNave] = useState("");
  const [camaras, setCamaras] = useState("");
  const instalacion = (parte: Partial<Instalacion>) => inst && cambiar({ instalaciones: c.instalaciones.map((x) => (x.id === inst.id ? { ...x, ...parte } : x)) });
  const punto = (p: PuntoFrio, parte: Partial<PuntoFrio>) => inst && instalacion({ puntos: inst.puntos.map((x) => (x.id === p.id ? { ...x, ...parte } : x)) });
  const de = (p: PuntoFrio, tipo: TipoFoto) => fotos.filter((f) => f.punto === p.id && f.tipo === tipo).length;
  const delSitio = inst ? fotos.filter((f) => f.instalacion === inst.id && f.tipo === "sitio").length : 0;
  const puntos = inst?.puntos ?? [];

  const apuntar = (ev: FormEvent) => {
    ev.preventDefault();
    const nuevos = camaras.split(/\n|,/).map((t) => t.trim()).filter(Boolean).map((n) => ({ ...puntoVacio(), nombre: n.slice(0, 120) }));
    if (inst) instalacion({ nombre: inst.nombre || nave.trim(), fase: inst.fase === "sinvisitar" ? "visitada" : inst.fase, puntos: [...inst.puntos, ...nuevos] });
    else cambiar({ instalaciones: [{ ...instalacionVacia(nave.trim()), fase: "visitada", puntos: nuevos }] });
    setCamaras("");
  };
  const sinNave = <p className="gx-nota">Se rellena al apuntar la nave y sus cámaras, en el paso «Cuenta las cámaras».</p>;

  // Si está lo que pide cada paso de la guía.
  const hecho: Record<string, boolean> = {
    antes: !!c.mantenedor.nombre && !!c.mantenedor.telefono,
    camaras: puntos.length > 0 && puntos.every((p) => p.guarda && p.temperatura),
    controladores: puntos.length > 0 && puntos.every((p) => p.controlador && de(p, "controlador") && de(p, "etiqueta")),
    conexion: !!inst?.sistemaActual,
    automata: !!inst?.automata,
    internet: !!inst?.internet && !!inst.cobertura && !!inst.informatica,
    sitio: !!inst?.sitioAparato && delSitio > 0,
    preguntas: !!c.visita.preocupa && !!c.visita.comoSeEntera && !!c.visita.soloLectura,
    despues: false,
  };
  const primero = PASOS_VISITA.find((p) => p.id !== "despues" && !hecho[p.id])?.id ?? "";
  // Se queda abierto el que se está rellenando: no salta solo al completarse, se pasa con «Siguiente».
  const [actual, setAbierto] = useState<string>(primero);

  const campos = (id: string) => {
    switch (id) {
      case "antes":
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo">Quién mantiene el frío<input value={c.mantenedor.nombre} maxLength={160} onChange={(ev) => cambiar({ mantenedor: { ...c.mantenedor, nombre: ev.target.value } })} placeholder="Nombre o empresa" /></label>
            <label className="gx-campo">Su teléfono<input value={c.mantenedor.telefono} maxLength={40} inputMode="tel" onChange={(ev) => cambiar({ mantenedor: { ...c.mantenedor, telefono: ev.target.value } })} /></label>
            <label className="gx-campo">Día de la visita<input type="date" value={c.visita.fecha} onChange={(ev) => cambiar({ visita: { ...c.visita, fecha: ev.target.value } })} /></label>
          </div>
        );
      case "camaras":
        return (
          <>
            {puntos.length > 0 && (
              <ul className="gx-ruta-camaras">
                {puntos.map((p) => (
                  <li key={p.id}>
                    <label className="gx-campo">Cómo la llaman<input value={p.nombre} maxLength={120} onChange={(ev) => punto(p, { nombre: ev.target.value })} /></label>
                    <label className="gx-campo">Qué guarda<input value={p.guarda} maxLength={240} onChange={(ev) => punto(p, { guarda: ev.target.value })} placeholder="Pescado congelado" /></label>
                    <label className="gx-campo">Temperatura<input value={p.temperatura} maxLength={60} onChange={(ev) => punto(p, { temperatura: ev.target.value })} placeholder="−20 °C" /></label>
                  </li>
                ))}
              </ul>
            )}
            <form className="gx-formulario gx-ruta-campos" onSubmit={apuntar}>
              {!inst?.nombre && <label className="gx-campo">Nombre de la nave o instalación<input value={nave} onChange={(ev) => setNave(ev.target.value)} maxLength={120} placeholder="Nave de Alvedro" required /></label>}
              <label className="gx-campo ancho">{puntos.length ? "Añadir más cámaras, una por línea" : "Cámaras, una por línea"}<textarea value={camaras} onChange={(ev) => setCamaras(ev.target.value)} rows={3} placeholder={"Cámara 6\nCámara 7A\nTúnel 1"} required /></label>
              <button type="submit" className="gx-boton">{puntos.length ? "Añadir" : "Apuntar las cámaras"}</button>
            </form>
          </>
        );
      case "controladores":
        if (!inst || !puntos.length) return sinNave;
        return (
          <ul className="gx-ruta-camaras">
            {puntos.map((p) => (
              <li key={p.id}>
                <label className="gx-campo">{p.nombre || "Cámara"}: marca y modelo del controlador<input value={p.controlador} maxLength={240} onChange={(ev) => punto(p, { controlador: ev.target.value })} placeholder="Lo que ponga en la etiqueta" /></label>
                <BotonFoto rotulo="Foto de frente" hay={de(p, "controlador")} alElegir={(a) => void subir(a, "controlador", inst.id, p.id)} />
                <BotonFoto rotulo="Foto de la etiqueta" hay={de(p, "etiqueta")} alElegir={(a) => void subir(a, "etiqueta", inst.id, p.id)} />
              </li>
            ))}
          </ul>
        );
      case "conexion":
        if (!inst) return sinNave;
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo ancho">¿Hay ya un sistema que junte las cámaras? Cuál<input value={inst.sistemaActual} maxLength={2000} onChange={(ev) => instalacion({ sistemaActual: ev.target.value })} placeholder="Ninguno, o el nombre que tenga la pantalla" /></label>
            <BotonFoto rotulo="Foto de ese sistema" hay={fotos.filter((f) => f.instalacion === inst.id && f.tipo === "sistema").length} alElegir={(a) => void subir(a, "sistema", inst.id)} />
          </div>
        );
      case "automata":
        if (!inst) return sinNave;
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo">Autómata (PLC): marca y modelo<input value={inst.automata} maxLength={240} onChange={(ev) => instalacion({ automata: ev.target.value })} placeholder="Siemens S7-1500, o «no hay»" /></label>
            <label className="gx-campo">Quién lo programa<input value={inst.programador} maxLength={240} onChange={(ev) => instalacion({ programador: ev.target.value })} /></label>
            <BotonFoto rotulo="Foto del autómata" hay={fotos.filter((f) => f.instalacion === inst.id && f.tipo === "automata").length} alElegir={(a) => void subir(a, "automata", inst.id)} />
          </div>
        );
      case "internet":
        if (!inst) return sinNave;
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo">Internet en la sala
              <select value={inst.internet} onChange={(ev) => instalacion({ internet: ev.target.value as Internet })}>
                {(Object.keys(INTERNET) as Internet[]).map((k) => <option key={k} value={k}>{INTERNET[k]}</option>)}
              </select>
            </label>
            <label className="gx-campo">Cobertura del móvil allí<input value={inst.cobertura} maxLength={240} onChange={(ev) => instalacion({ cobertura: ev.target.value })} placeholder="Buena, dos rayas, ninguna…" /></label>
            <label className="gx-campo">Quién lleva la informática<input value={inst.informatica} maxLength={240} onChange={(ev) => instalacion({ informatica: ev.target.value })} /></label>
          </div>
        );
      case "sitio":
        if (!inst) return sinNave;
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo ancho">Dónde iría el aparato y si hay enchufe<input value={inst.sitioAparato} maxLength={2000} onChange={(ev) => instalacion({ sitioAparato: ev.target.value })} /></label>
            <BotonFoto rotulo="Foto del sitio" hay={delSitio} alElegir={(a) => void subir(a, "sitio", inst.id)} />
          </div>
        );
      case "preguntas":
        return (
          <div className="gx-formulario gx-ruta-campos">
            <label className="gx-campo ancho">Qué le quita el sueño<textarea rows={2} value={c.visita.preocupa} maxLength={4000} onChange={(ev) => cambiar({ visita: { ...c.visita, preocupa: ev.target.value } })} /></label>
            <label className="gx-campo ancho">Cómo se entera hoy de un fallo<textarea rows={2} value={c.visita.comoSeEntera} maxLength={4000} onChange={(ev) => cambiar({ visita: { ...c.visita, comoSeEntera: ev.target.value } })} /></label>
            <label className="gx-campo">¿Acepta empezar solo mirando?
              <select value={c.visita.soloLectura} onChange={(ev) => cambiar({ visita: { ...c.visita, soloLectura: ev.target.value as SoloLectura } })}>
                {(Object.keys(SOLO_LECTURA) as SoloLectura[]).map((k) => <option key={k} value={k}>{SOLO_LECTURA[k]}</option>)}
              </select>
            </label>
            <label className="gx-campo ancho">Otras cosas que dijo<textarea rows={2} value={c.visita.otras} maxLength={4000} onChange={(ev) => cambiar({ visita: { ...c.visita, otras: ev.target.value } })} /></label>
          </div>
        );
      default:
        return <p className="gx-nota">Arriba, junto al nombre del cliente, tiene que poner «Guardado». <Link href="/ops/visita" className="gx-volver">Qué es el aparato, cuánto cuesta y qué te van a preguntar</Link></p>;
    }
  };

  return (
    <ol className="gx-ruta-guia-visita">
      {PASOS_VISITA.map((p, n) => {
        const si = actual === p.id;
        const sig = PASOS_VISITA[n + 1];
        return (
          <li key={p.id} className={hecho[p.id] ? "hecho" : undefined}>
            <button type="button" className="cabeza" aria-expanded={si} onClick={() => setAbierto(si ? "" : p.id)}>
              <span className="marca" aria-hidden="true">{hecho[p.id] && <Check size={12} strokeWidth={2.6} />}</span>
              <strong>{p.titulo}</strong>
              <small>{p.hoy}</small>
            </button>
            {si && (
              <div className="cuerpo">
                <p>{p.corto}</p>
                {campos(p.id)}
                <MasInfo tema={p} rotulos={ROTULOS_VISITA} />
                {sig && <button type="button" className="gx-boton secundario" style={{ marginTop: 10 }} onClick={() => setAbierto(sig.id)}>Siguiente: {sig.titulo.charAt(0).toLowerCase()}{sig.titulo.slice(1)}</button>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
