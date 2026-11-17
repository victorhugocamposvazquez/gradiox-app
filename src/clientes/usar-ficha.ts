"use client";

// La ficha de un cliente en el navegador: se abre, se cambia y se guarda sola
// un momento después de dejar de escribir. La usan la ficha y la ficha técnica.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Apunte, Cliente, DatosCliente, Foto, Lecturas } from "./modelo";
import { conJson, pedir } from "./navegador";

export type Guardado = "guardado" | "pendiente" | "guardando" | "fallo";
const ESPERA_MS = 900;

export function usarFicha(id: string) {
  const [c, setC] = useState<Cliente | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [base, setBase] = useState(true);
  const [fallo, setFallo] = useState("");
  const [estado, setEstado] = useState<Guardado>("guardado");
  const [lecturas, setLecturas] = useState<Lecturas>({});
  const [ahora, setAhora] = useState(0);
  const version = useRef(0);
  const ultimo = useRef<DatosCliente | null>(null);
  const reloj = useRef<number | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    pedir<{ guardado: "memoria" | "base"; ahora: number; cliente: Cliente; fotos: Foto[]; lecturas: Lecturas }>(`/api/ops/clientes/${id}`)
      .then((d) => {
        if (!vivo) return;
        setC(d.cliente);
        setFotos(d.fotos);
        setBase(d.guardado === "base");
        setLecturas(d.lecturas);
        setAhora(d.ahora);
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
      const d = await pedir<{ historial: Apunte[]; cliente?: Cliente }>(`/api/ops/clientes/${id}`, { ...conJson("PUT", datos), keepalive: true });
      // El registro lo lleva el servidor: se trae de vuelta sin tocar lo que se esté escribiendo.
      // Si alguien ha rellenado una ficha técnica desde su enlace, el servidor devuelve la ficha como ha quedado.
      const puesta = d.cliente;
      if (puesta && version.current === v) {
        ultimo.current = puesta;
        setC(puesta);
      } else setC((x) => (x ? { ...x, historial: d.historial } : x));
      if (version.current === v) setEstado("guardado");
    } catch {
      if (version.current === v) setEstado("fallo");
    }
  }, [id]);

  /** Cada cambio se guarda solo, un momento después de dejar de escribir. */
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
  /** Deja de guardar lo pendiente: se usa antes de borrar el cliente. */
  const cancelar = () => {
    window.clearTimeout(reloj.current);
    reloj.current = undefined;
    ultimo.current = null;
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

  return { c, setC, fotos, setFotos, base, fallo, setFallo, estado, lecturas, ahora, cambiar, enviar, cancelar };
}
