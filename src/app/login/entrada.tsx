"use client";

import { Bell, Building2, ClipboardList, Eye, EyeOff, Gauge, ListChecks, Thermometer, Zap } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Marca } from "@/components/marca";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinoOps, destinoSeguro } from "@/lib/sesion";

const PUNTOS_INTERNOS = [
  { Icono: Building2, titulo: "Clientes", texto: "La ficha de cada empresa, con sus instalaciones, sus puntos de frío y las fotos." },
  { Icono: ClipboardList, titulo: "Visitas", texto: "La guía para ir a ver a un cliente y la lista de lo que hay que recoger." },
  { Icono: ListChecks, titulo: "Tareas y plan", texto: "Lo que falta por hacer y en qué fase está Gradiox." },
];

const PUNTOS = [
  { Icono: Gauge, titulo: "Optimiza la instalación", texto: "Detecta dónde se gasta de más, ajusta la instalación para gastar menos y mide el ahorro real." },
  { Icono: Thermometer, titulo: "Cada servicio, en vivo", texto: "Temperatura, puerta, compresor y desescarche de un vistazo." },
  { Icono: Bell, titulo: "Actúa ante las averías", texto: "Ejecuta la orden correctiva e indica qué revisar en el equipo." },
  { Icono: Zap, titulo: "Produce el frío cuando menos cuesta", texto: "Un plan diario según el precio de la energía, con margen de seguridad." },
];

export function Entrada({ configurado, interno = false }: { configurado: boolean; interno?: boolean }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [olvido, setOlvido] = useState("");
  const formulario = useRef<HTMLFormElement>(null);

  const pedirClave = async () => {
    const usuario = String(new FormData(formulario.current ?? undefined).get("usuario") ?? "").trim();
    setError("");
    if (!usuario) {
      setOlvido("Escribe tu usuario arriba y vuelve a pulsar.");
      return;
    }
    setOlvido("Apuntando…");
    try {
      const r = await fetch("/api/sesion/olvido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario }) });
      const d = (await r.json().catch(() => null)) as { texto?: string; error?: string } | null;
      setOlvido(d?.texto ?? d?.error ?? "No se ha podido apuntar. Prueba otra vez.");
    } catch {
      setOlvido("No hay conexión con el servidor. Prueba otra vez.");
    }
  };

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
    <div data-slot="entrada" className="grid min-h-dvh grid-cols-1 bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex flex-col items-center justify-start px-4 pt-10 pb-12 sm:justify-center sm:pt-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Marca size={30} />
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">{interno ? "Entrar al panel" : "Entrar"}</h1>
            <p className="m-0 text-sm text-muted-foreground">{interno ? "Clientes, visitas, tareas y plan de Gradiox. Entra con el usuario interno, que no es el de la app." : "Gradiox vigila y optimiza a distancia cámaras frigoríficas y otros servicios de frío. Entra con el usuario y la contraseña que te han dado."}</p>
          </div>
          {configurado ? (
            <Card className="gap-0 py-5">
              <CardContent className="px-5">
                <form ref={formulario} className="flex flex-col gap-4" onSubmit={entrar}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entrada-usuario">Usuario</Label>
                    <Input id="entrada-usuario" type="text" name="usuario" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} className="h-10 bg-card" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entrada-clave">Contraseña</Label>
                    <div className="relative">
                      <Input id="entrada-clave" type={verClave ? "text" : "password"} name="clave" required autoComplete="current-password" onKeyUp={mirarMayusculas} onKeyDown={mirarMayusculas} className="h-10 bg-card pr-10" />
                      <button type="button" aria-label={verClave ? "Ocultar la contraseña" : "Ver la contraseña"} aria-pressed={verClave} onClick={() => setVerClave(!verClave)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md border-0 bg-transparent text-muted-foreground hover:text-foreground">
                        {verClave ? <EyeOff className="size-4" strokeWidth={1.6} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.6} aria-hidden="true" />}
                      </button>
                    </div>
                    {mayusculas && <p className="m-0 text-[13px] text-aviso">Las mayúsculas están activadas.</p>}
                  </div>
                  {error && (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="h-10 w-full" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</Button>
                  {!interno && (
                    <div className="text-[13px] text-muted-foreground">
                      <button type="button" className="border-0 bg-transparent p-0 text-[13px] text-foreground underline underline-offset-4 hover:text-primary" onClick={() => void pedirClave()}>¿Has olvidado la contraseña?</button>
                      {olvido && <span role="status" className="mt-1 block">{olvido}</span>}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Falta poner el usuario y la contraseña en el servidor. Hay que añadir las variables {interno ? "GRADIOX_OPS_USUARIO y GRADIOX_OPS_CLAVE" : "GRADIOX_USUARIO y GRADIOX_CLAVE"} y volver a desplegar.</AlertDescription>
            </Alert>
          )}
          <p className="m-0 text-[13px] text-muted-foreground">
            La sesión dura 7 días en este dispositivo.{" "}
            {interno ? "Solo para el equipo de Gradiox: los clientes no entran aquí." : <>Si no tienes acceso, pídeselo a quien te ha pasado este enlace. <a href="/presentacion" className="text-foreground underline underline-offset-4 hover:text-primary">Qué es Gradiox</a></>}
          </p>
        </div>
      </main>

      <aside className="hidden flex-col justify-center gap-8 border-l border-border bg-muted/40 px-12 py-12 lg:flex">
        <p className="m-0 max-w-md font-[family-name:var(--gx-letra-marca)] text-2xl leading-tight font-medium tracking-tight">{interno ? "Panel interno de Gradiox." : "El sistema de optimización de refrigeración que necesitas."}</p>
        <ul className="m-0 flex max-w-md list-none flex-col gap-3 p-0">
          {(interno ? PUNTOS_INTERNOS : PUNTOS).map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Icono className="size-4" strokeWidth={1.6} aria-hidden="true" /></span>
              <span className="flex flex-col gap-0.5 text-[13px] leading-normal text-muted-foreground">
                <strong className="text-sm font-medium text-foreground">{titulo}</strong>
                {texto}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] text-muted-foreground">{interno ? "Los clientes entran por gradiox.com/login con su propio usuario." : "Cada cliente entra con su usuario y ve solo sus instalaciones."}</p>
      </aside>
    </div>
  );
}
