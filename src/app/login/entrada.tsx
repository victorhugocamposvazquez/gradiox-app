"use client";

import { useState, type FormEvent } from "react";
import { Marca } from "@/components/marca";
import { destinoSeguro } from "@/lib/sesion";

export function Entrada({ configurado }: { configurado: boolean }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

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

  return (
    <main className="gx-entrada">
      <form className="gx-tarjeta gx-pila" onSubmit={entrar}>
        <Marca size={34} />
        <div>
          <h1>Entrar</h1>
          <p className="gx-sub">Control de servicios de frío</p>
        </div>
        {configurado ? (
          <>
            <label className="gx-campo">Usuario
              <input type="text" name="usuario" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="gx-campo">Contraseña
              <input type="password" name="clave" required autoComplete="current-password" />
            </label>
            {error && <p className="gx-fallo" role="alert">{error}</p>}
            <button type="submit" className="gx-boton" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          </>
        ) : (
          <p className="gx-fallo" role="alert">
            Falta poner el usuario y la contraseña en el servidor. Hay que añadir las variables GRADIOX_USUARIO y GRADIOX_CLAVE y volver a desplegar.
          </p>
        )}
        <p className="gx-nota">Demostración con datos simulados.</p>
      </form>
    </main>
  );
}
