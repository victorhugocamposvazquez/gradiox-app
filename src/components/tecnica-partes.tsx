"use client";

// Las dos partes de la ficha técnica que se usan igual en el panel y en el
// enlace para rellenarla desde fuera: la lista de señales y los documentos.

import { Download, FileText, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { MAX_SENALES, TIPOS_SENAL, senalVacia, senalesDeTexto, type Senal, type TipoSenal } from "@/clientes/tecnica";

export function EditorSenales({ senales, camaras, alCambiar, tecnico }: { senales: Senal[]; camaras: { id: string; nombre: string }[]; alCambiar: (s: Senal[]) => void; tecnico?: boolean }) {
  const [pegado, setPegado] = useState("");
  const una = (s: Senal, parte: Partial<Senal>) => alCambiar(senales.map((x) => (x.id === s.id ? { ...x, ...parte } : x)));
  const pegar = () => {
    const nuevas = senalesDeTexto(pegado);
    if (!nuevas.length) return;
    alCambiar([...senales, ...nuevas].slice(0, MAX_SENALES));
    setPegado("");
  };
  return (
    <>
      {senales.length > 0 && (
        <ol className="gx-senales">
          {senales.map((s) => (
            <li key={s.id}>
              <input aria-label={tecnico ? "Nombre de la variable o NodeId" : "Nombre de la señal en el equipo"} className="nombre" value={s.nombre} maxLength={160} placeholder={tecnico ? "Nombre o NodeId" : "Nombre en el equipo"} onChange={(ev) => una(s, { nombre: ev.target.value })} />
              <select aria-label="Qué es" value={s.tipo} onChange={(ev) => una(s, { tipo: ev.target.value as TipoSenal })}>
                {(Object.keys(TIPOS_SENAL) as TipoSenal[]).map((k) => <option key={k} value={k}>{TIPOS_SENAL[k]}</option>)}
              </select>
              <select aria-label="De qué cámara" value={s.punto} onChange={(ev) => una(s, { punto: ev.target.value })}>
                <option value="">Toda la instalación</option>
                {camaras.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <label className="escribe"><input type="checkbox" checked={s.escribe} onChange={(ev) => una(s, { escribe: ev.target.checked })} /> {tecnico ? "Admite escritura" : "Se puede cambiar"}</label>
              <button type="button" className="gx-boton-enlace" aria-label={`Quitar ${s.nombre || "la señal"}`} onClick={() => alCambiar(senales.filter((x) => x.id !== s.id))}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
            </li>
          ))}
        </ol>
      )}
      <div className="gx-senales-pie">
        <button type="button" className="gx-boton secundario" disabled={senales.length >= MAX_SENALES} onClick={() => alCambiar([...senales, senalVacia()])}><Plus size={16} strokeWidth={1.7} aria-hidden="true" /> {tecnico ? "Añadir una variable" : "Añadir una señal"}</button>
      </div>
      <details className="gx-pegar" open={tecnico && senales.length === 0 ? true : undefined}>
        <summary>Pegar una lista entera</summary>
        <label className="gx-campo">
          {tecnico ? "Una variable por línea. Si se pega desde una hoja de cálculo o un CSV, se toma la primera columna. El tipo se deduce del nombre y se puede corregir." : "Una señal por línea. Si pegas desde una hoja de cálculo, se usa la primera columna."}
          <textarea rows={5} value={pegado} onChange={(ev) => setPegado(ev.target.value)} placeholder={"Camara1_Temperatura\nCamara1_Alarma\nCamara1_Consigna"} />
        </label>
        <button type="button" className="gx-boton" disabled={!pegado.trim()} onClick={pegar}>{tecnico ? "Añadir estas variables" : "Añadir estas señales"}</button>
      </details>
    </>
  );
}

export type Documento = { id: string; pie: string; tamano: number; creada: number };
const peso = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

export function ListaDocumentos({ documentos, direccion, subiendo, fallo, alSubir, alBorrar }: { documentos: Documento[]; direccion: (d: Documento) => string; subiendo: boolean; fallo: string; alSubir: (archivos: File[]) => void; alBorrar: (d: Documento) => void }) {
  return (
    <>
      {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
      {documentos.length > 0 && (
        <ul className="gx-documentos">
          {documentos.map((d) => (
            <li key={d.id}>
              <FileText size={18} strokeWidth={1.6} aria-hidden="true" />
              <a href={direccion(d)} download={d.pie || "documento"}>
                <b>{d.pie || "Documento"}</b>
                <small>{peso(d.tamano)} · {new Date(d.creada).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</small>
              </a>
              <a href={direccion(d)} download={d.pie || "documento"} className="gx-boton-enlace" aria-label={`Descargar ${d.pie}`}><Download size={16} strokeWidth={1.7} aria-hidden="true" /></a>
              <button type="button" className="gx-boton-enlace" aria-label={`Borrar ${d.pie}`} onClick={() => alBorrar(d)}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
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
            if (archivos.length) alSubir(archivos);
          }}
        />
      </label>
    </>
  );
}
