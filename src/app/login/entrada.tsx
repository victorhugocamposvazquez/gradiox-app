"use client";

import { Bell, Building2, ClipboardList, Eye, EyeOff, ListChecks, Thermometer, Zap } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Marca } from "@/components/marca";
import { destinoOps, destinoSeguro } from "@/lib/sesion";

const PUNTOS_INTERNOS = [
  { Icono: Building2, titulo: "Clientes", texto: "La ficha de cada empresa, con sus instalaciones, sus puntos de frío y las fotos." },
  { Icono: ClipboardList, titulo: "Visitas", texto: "La guía para ir a ver a un cliente y la lista de lo que hay que recoger." },
  { Icono: ListChecks, titulo: "Tareas y plan", texto: "Lo que falta por hacer y en qué fase está Gradiox." },
];

const PUNTOS = [
  { Icono: Thermometer, titulo: "Cada servicio, en vivo", texto: "Temperatura, puerta, compresor y desescarche de un vistazo." },
  { Icono: Bell, titulo: "Actúa ante las averías", texto: "Ejecuta la orden correctiva e indica qué revisar en el equipo." },
  { Icono: Zap, titulo: "Produce el frío cuando menos cuesta", texto: "Un plan diario según el precio de la energía, con margen de seguridad." },
];

export function Entrada({ configurado, interno = false }: { configurado: boolean; interno?: boolean }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);

  const entrar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(interno ? "/api/ops/sesion" : "/api/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: d.get("usuario"), clave: d.get("clave") }),
      });
      if (r.ok) {
        const volver = new URLSearchParams(window.location.search).get("volver");
        window.location.assign(interno ? destinoOps(volver) : destinoSeguro(volver));
        return;
      }
      const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
      setError(cuerpo?.error ?? "No se ha podido entrar. Prueba otra vez.");
    } catch {
      setError("No hay conexión con el servidor. Prueba otra vez.");
    }
    setEnviando(false);
  };
  const mirarMayusculas = (ev: KeyboardEvent<HTMLInputElement>) => setMayusculas(ev.getModifierState("CapsLock"));

  return (
    <div className="gx-entrada">
      <aside className="gx-entrada-marca">
        <span className="gx-aros" aria-hidden="true"><i /><i /><i /></span>
        <Marca size={34} oscuro />
        <div className="gx-entrada-lema">
          <p className="gx-entrada-titular">{interno ? "Panel interno de Gradiox." : "El sistema de optimización de refrigeración que necesitas."}</p>
          <ul>
            {(interno ? PUNTOS_INTERNOS : PUNTOS).map(({ Icono, titulo, texto }) => (
              <li key={titulo}>
                <Icono size={20} strokeWidth={1.6} aria-hidden="true" />
                <span>
                  <strong>{titulo}</strong>
                  {texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="gx-demo">{interno ? "Solo para el equipo de Gradiox. Los clientes no entran aquí." : "Demostración con datos simulados. No hay ninguna instalación conectada."}</p>
      </aside>

      <main className="gx-entrada-paso">
        <form className="gx-pila" onSubmit={entrar}>
          <div>
            <h1>{interno ? "Entrar al panel" : "Entrar"}</h1>
            <p className="gx-sub">{interno ? "Clientes, visitas, tareas y plan de Gradiox. Entra con el usuario interno, que no es el de la app." : "Gradiox vigila a distancia cámaras frigoríficas y otros servicios de frío. Entra con el usuario y la contraseña que te han dado."}</p>
          </div>
          {configurado ? (
            <>
              <label className="gx-campo">Usuario
                <input type="text" name="usuario" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} />
              </label>
              <label className="gx-campo">Contraseña
                <span className="gx-clave">
                  <input type={verClave ? "text" : "password"} name="clave" required autoComplete="current-password" onKeyUp={mirarMayusculas} onKeyDown={mirarMayusculas} />
                  <button type="button" aria-label={verClave ? "Ocultar la contraseña" : "Ver la contraseña"} aria-pressed={verClave} onClick={() => setVerClave(!verClave)}>
                    {verClave ? <EyeOff size={20} strokeWidth={1.6} aria-hidden="true" /> : <Eye size={20} strokeWidth={1.6} aria-hidden="true" />}
                  </button>
                </span>
              </label>
              {mayusculas && <p className="gx-nota">Las mayúsculas están activadas.</p>}
              {error && <p className="gx-fallo" role="alert">{error}</p>}
              <button type="submit" className="gx-boton" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
              {interno ? (
                <p className="gx-nota">La sesión dura 7 días en este dispositivo.</p>
              ) : (
                <p className="gx-nota">La sesión dura 7 días en este dispositivo. Si no tienes acceso, pídeselo a quien te ha pasado este enlace. <a href="/presentacion" style={{ color: "var(--gx-azul)", textDecoration: "underline" }}>Qué es Gradiox</a></p>
              )}
            </>
          ) : (
            <p className="gx-fallo" role="alert">
              Falta poner el usuario y la contraseña en el servidor. Hay que añadir las variables {interno ? "GRADIOX_OPS_USUARIO y GRADIOX_OPS_CLAVE" : "GRADIOX_USUARIO y GRADIOX_CLAVE"} y volver a desplegar.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
