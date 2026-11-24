"use client";

// El botón grande del cliente y de cada nave: siempre el paso que toca del alta,
// el mismo que marca la hoja de ruta. Así hay una sola guía y no varias que se contradicen.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { pedir } from "@/clientes/navegador";
import type { Ruta } from "@/clientes/ruta";
import { Button } from "@/components/ui/button";

/** `alSaber` cuenta a la página por qué paso del alta va (o null si ya está completa), para ponerlo arriba. */
export function PasoAlta({ cliente, guardado, cambio = "", alIr, alSaber }: { cliente: string; guardado: string; cambio?: string; alIr?: (donde: string) => boolean; alSaber?: (p: { n: number; total: number } | null) => void }) {
  const router = useRouter();
  const [ruta, setRuta] = useState<Ruta | null>(null);
  // Se vuelve a mirar cada vez que la ficha termina de guardarse o cambia la conexión: el paso cambia en cuanto se completa.
  useEffect(() => {
    if (guardado !== "guardado") return;
    let vivo = true;
    pedir<{ ruta: Ruta }>(`/api/ops/clientes/${cliente}/ruta`)
      .then((d) => vivo && setRuta(d.ruta))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, [cliente, guardado, cambio]);

  const paso = ruta?.siguiente;
  const n = ruta && paso ? ruta.alta.findIndex((p) => p.id === paso.id) + 1 : 0;
  const total = ruta?.alta.length ?? 0;
  useEffect(() => {
    if (ruta) alSaber?.(n ? { n, total } : null);
  }, [ruta, n, total, alSaber]);
  if (!ruta || !paso) return null;
  const texto = (
    <>
      <span className="truncate">Paso {n} de {ruta.alta.length}: {paso.accion.charAt(0).toLowerCase() + paso.accion.slice(1)}</span>
      <ArrowRight aria-hidden="true" />
    </>
  );
  // Si el paso está en la misma página (otra pestaña), se cambia de pestaña sin recargar.
  return alIr ? (
    <Button size="sm" className="max-w-full" title={paso.titulo} onClick={() => { if (!alIr(paso.donde)) router.push(paso.donde); }}>{texto}</Button>
  ) : (
    <Button asChild size="sm" className="max-w-full" title={paso.titulo}><Link href={paso.donde}>{texto}</Link></Button>
  );
}
