"use client";

// La zona de usuario de la barra de arriba: quién ha entrado, de qué cliente,
// cambiar o pedir la contraseña y salir.

import Link from "next/link";
import { BookOpen, Download, KeyRound, LifeBuoy, LogOut, Settings, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useYo } from "@/vivo/cliente";

const iniciales = (t: string) =>
  t
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export function MenuUsuario({ abierto, alAbrir, salir }: { abierto: boolean; alAbrir: (si: boolean) => void; salir: () => void }) {
  const yo = useYo();
  const [modo, setModo] = useState<"menu" | "clave">("menu");
  const [aviso, setAviso] = useState<{ bien: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nombre = !yo ? "" : yo.tipo === "equipo" ? "Equipo de Gradiox" : yo.nombre;
  const detalle = !yo ? "" : yo.tipo === "equipo" ? "Ve todos los clientes" : yo.cliente;

  const cambiarClave = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    const nueva = String(d.get("nueva") ?? "");
    if (nueva !== String(d.get("repite") ?? "")) {
      setAviso({ bien: false, texto: "Las dos contraseñas nuevas no coinciden." });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/sesion/clave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actual: d.get("actual"), nueva }) });
      const c = (await r.json().catch(() => null)) as { error?: string } | null;
      if (r.ok) {
        setAviso({ bien: true, texto: "Contraseña cambiada. Se ha cerrado la sesión en tus otros aparatos." });
        setModo("menu");
      } else setAviso({ bien: false, texto: c?.error ?? "No se ha podido cambiar." });
    } catch {
      setAviso({ bien: false, texto: "No hay conexión con el servidor." });
    }
    setEnviando(false);
  };
  const pedirNueva = async () => {
    if (yo?.tipo !== "cliente") return;
    setAviso(null);
    try {
      const r = await fetch("/api/sesion/olvido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: yo.usuario }) });
      setAviso(r.ok ? { bien: true, texto: "Pedido. Gradiox te dará una contraseña nueva en cuanto lo vea." } : { bien: false, texto: "No se ha podido pedir. Prueba otra vez." });
    } catch {
      setAviso({ bien: false, texto: "No hay conexión con el servidor." });
    }
  };

  return (
    <div className="gx-menu gx-menu-usuario">
      <button
        type="button"
        className="gx-pildora redonda gx-avatar"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls="gx-usuario-menu"
        aria-label={nombre ? `Tu usuario: ${nombre}` : "Tu usuario"}
        onClick={() => {
          alAbrir(!abierto);
          setModo("menu");
          setAviso(null);
        }}
      >
        {nombre ? <span aria-hidden="true">{iniciales(nombre)}</span> : <UserRound size={17} strokeWidth={1.6} aria-hidden="true" />}
      </button>
      {abierto && (
        <div id="gx-usuario-menu" className="gx-flotante gx-usuario-menu">
          <div className="gx-usuario-quien">
            <span className="gx-avatar grande" aria-hidden="true">{nombre ? iniciales(nombre) : "?"}</span>
            <span>
              <strong>{nombre || "Comprobando…"}</strong>
              {yo?.tipo === "cliente" && <small>Usuario {yo.usuario}</small>}
              <small>{detalle}</small>
            </span>
          </div>
          {aviso && <p className={`gx-usuario-aviso${aviso.bien ? "" : " mal"}`} role="status">{aviso.texto}</p>}
          {modo === "clave" ? (
            <form className="gx-usuario-clave" onSubmit={cambiarClave}>
              <label className="gx-campo">Contraseña de ahora<input type="password" name="actual" required autoComplete="current-password" /></label>
              <label className="gx-campo">Contraseña nueva<input type="password" name="nueva" required minLength={10} autoComplete="new-password" /></label>
              <label className="gx-campo">Repite la nueva<input type="password" name="repite" required minLength={10} autoComplete="new-password" /></label>
              <p className="gx-nota" style={{ margin: 0 }}>Al menos 10 caracteres.</p>
              <span className="gx-acciones" style={{ marginTop: 0 }}>
                <button type="submit" className="gx-boton" disabled={enviando}>{enviando ? "Cambiando…" : "Cambiar"}</button>
                <button type="button" className="gx-boton-enlace" onClick={() => setModo("menu")}>Volver</button>
              </span>
            </form>
          ) : (
            <ul>
              {yo?.tipo === "cliente" && (
                <>
                  <li><button type="button" onClick={() => { setModo("clave"); setAviso(null); }}><KeyRound size={17} strokeWidth={1.6} aria-hidden="true" /> Cambiar contraseña</button></li>
                  <li><button type="button" onClick={() => void pedirNueva()}><LifeBuoy size={17} strokeWidth={1.6} aria-hidden="true" /> Pedir una contraseña nueva a Gradiox</button></li>
                </>
              )}
              {yo?.tipo === "equipo" && (
                <>
                  <li><Link href="/ops"><Settings size={17} strokeWidth={1.6} aria-hidden="true" /> Panel interno: clientes y usuarios</Link></li>
                  <li className="nota">La contraseña del equipo se cambia en Vercel (GRADIOX_CLAVE).</li>
                </>
              )}
              <li><Link href="/sistema"><Download size={17} strokeWidth={1.6} aria-hidden="true" /> Instalar Gradiox en este aparato</Link></li>
              <li><Link href="/como-funciona"><BookOpen size={17} strokeWidth={1.6} aria-hidden="true" /> Cómo funciona</Link></li>
              <li className="salir"><button type="button" onClick={salir}><LogOut size={17} strokeWidth={1.6} aria-hidden="true" /> Salir</button></li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
