"use client";

import { Bell, Eye, EyeOff, Thermometer, Zap } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Marca } from "@/components/marca";
import { destinoSeguro } from "@/lib/sesion";

const PUNTOS = [
  { Icono: Thermometer, titulo: "Cada servicio, en vivo", texto: "Temperatura, puerta, compresor y desescarche de un vistazo." },
  { Icono: Bell, titulo: "Avisa antes del límite", texto: "Dice cuánto tiempo queda y qué hay que revisar." },
  { Icono: Zap, titulo: "Enfría cuando la luz es barata", texto: "Un plan diario que nunca se acerca al límite del género." },
];

export function Entrada({ configurado }: { configurado: boolean }) {
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
      const r = await fetch("/api/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: d.get("usuario"), clave: d.get("clave") }),
      });
      if (r.ok) {
        window.location.assign(destinoSeguro(new URLSearchParams(window.location.search).get("volver")));
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
          <p className="gx-entrada-titular">El sistema de optimización de refrigeración que necesitas.</p>
          <ul>
            {PUNTOS.map(({ Icono, titulo, texto }) => (
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
        <p className="gx-demo">Demostración con datos simulados. No hay ninguna instalación conectada.</p>
      </aside>

      <main className="gx-entrada-paso">
        <form className="gx-pila" onSubmit={entrar}>
          <div>
            <h1>Entrar</h1>
            <p className="gx-sub">Gradiox vigila a distancia cámaras frigoríficas y otros servicios de frío. Entra con el usuario y la contraseña que te han dado.</p>
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
              <p className="gx-nota">La sesión dura 7 días en este dispositivo. Si no tienes acceso, pídeselo a quien te ha pasado este enlace. <a href="/presentacion" style={{ color: "var(--gx-azul)", textDecoration: "underline" }}>Qué es Gradiox</a></p>
            </>
          ) : (
            <p className="gx-fallo" role="alert">
              Falta poner el usuario y la contraseña en el servidor. Hay que añadir las variables GRADIOX_USUARIO y GRADIOX_CLAVE y volver a desplegar.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
