"use client";

import Link from "next/link";
import { CircleCheck, ClipboardList, Cpu, Info, TriangleAlert, WifiOff, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mostrar, pitar } from "@/lib/dispositivo";
import { foto, novedades, type Foto, type Noti, type TipoNoti } from "@/lib/notificaciones";
import { useDemo } from "@/lib/store";

export const ICONOS: Record<TipoNoti, LucideIcon> = { alarma: TriangleAlert, conexion: WifiOff, fallo: ClipboardList, orden: Cpu, aviso: Info, recuperado: CircleCheck };

/** Vigila los cambios mientras Gradiox está abierto y los convierte en notificaciones. */
export function Vigia() {
  const { ahora, ajustes, fallos, preferencias, refuerzos, anotar, marcarLeidas, ordenar, quitarRefuerzo } = useDemo();
  const previa = useRef<Foto | null>(null);
  const [emergente, setEmergente] = useState<{ n: Noti; mas: number } | null>(null);

  useEffect(() => {
    if (ahora === null) return;
    const actual = foto(ahora, ajustes, fallos);
    const antes = previa.current;
    previa.current = actual;
    // La primera foto solo sirve de referencia: lo que ya pasaba no es novedad.
    if (!antes) return;
    // Los fallos que traen orden automática la dan al aparecer; el refuerzo de consigna se quita al pasar.
    for (const clave of actual.fallos) {
      if (antes.fallos.includes(clave)) continue;
      const [falloId, camaraId] = clave.split("|");
      const f = fallos.find((x) => x.id === falloId);
      if (f?.auto && f.orden !== "ninguna") ordenar(falloId, camaraId, true);
    }
    for (const camaraId of Object.keys(refuerzos)) if (!actual.fallos.some((k) => k.endsWith(`|${camaraId}`))) quitarRefuerzo(camaraId);
    const nuevas = novedades(antes, actual, ahora, fallos);
    if (!nuevas.length) return;
    anotar(nuevas);
    const interrumpen = nuevas.filter((n) => preferencias[n.tipo]);
    if (!interrumpen.length) return;
    setEmergente({ n: interrumpen[0], mas: interrumpen.length - 1 });
    if (preferencias.sonido && interrumpen.some((n) => n.tipo === "alarma" || n.tipo === "conexion")) pitar();
    // Con Gradiox a la vista basta el aviso en pantalla; el del sistema es para cuando está detrás.
    if (document.visibilityState === "hidden") for (const n of interrumpen) void mostrar(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora]);

  useEffect(() => {
    if (!emergente) return;
    const id = window.setTimeout(() => setEmergente(null), 9000);
    return () => window.clearTimeout(id);
  }, [emergente]);

  if (!emergente) return null;
  const { n, mas } = emergente;
  const Icono = ICONOS[n.tipo];
  return (
    <div className={`gx-emergente ${n.tipo}`} role={n.tipo === "alarma" ? "alert" : "status"}>
      <Link
        href={mas ? "/notificaciones" : n.href}
        onClick={() => {
          if (!mas) marcarLeidas(n.id);
          setEmergente(null);
        }}
      >
        <Icono size={20} strokeWidth={1.7} aria-hidden="true" />
        <span>
          <strong>{n.titulo}</strong>
          <small>{mas ? `y ${mas} más. Ver todas` : n.texto}</small>
        </span>
      </Link>
      <button type="button" aria-label="Cerrar" onClick={() => setEmergente(null)}>
        <X size={18} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
  );
}
