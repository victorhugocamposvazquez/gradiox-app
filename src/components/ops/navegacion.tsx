"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { pedir } from "@/clientes/navegador";
import type { ResumenCliente } from "@/clientes/modelo";
import type { ResumenPasarela } from "@/pasarelas/modelo";

export type Navegacion = {
  clientes: ResumenCliente[] | null;
  instalaciones: ResumenPasarela[] | null;
  ahora: number;
  recargar: () => void;
};

const Contexto = createContext<Navegacion>({ clientes: null, instalaciones: null, ahora: 0, recargar: () => {} });

/** Clientes e instalaciones para la barra lateral y el buscador: se leen una vez y se refrescan solos. */
export function NavegacionProvider({ children }: { children: ReactNode }) {
  const [clientes, setClientes] = useState<ResumenCliente[] | null>(null);
  const [instalaciones, setInstalaciones] = useState<ResumenPasarela[] | null>(null);
  const [ahora, setAhora] = useState(0);

  const recargar = useCallback(() => {
    pedir<{ clientes: ResumenCliente[] }>("/api/ops/clientes").then((d) => setClientes(d.clientes)).catch(() => setClientes((c) => c ?? []));
    pedir<{ ahora: number; pasarelas: ResumenPasarela[] }>("/api/ops/pasarelas")
      .then((d) => {
        setInstalaciones(d.pasarelas);
        setAhora(d.ahora);
      })
      .catch(() => setInstalaciones((p) => p ?? []));
  }, []);

  useEffect(() => {
    recargar();
    const reloj = window.setInterval(recargar, 30_000);
    return () => window.clearInterval(reloj);
  }, [recargar]);

  return <Contexto.Provider value={{ clientes, instalaciones, ahora, recargar }}>{children}</Contexto.Provider>;
}

export const useNavegacion = () => useContext(Contexto);

export type Tono = "bien" | "aviso" | "mal" | "azul" | "neutro";

/** Cómo está una instalación, en una palabra y un tono. */
export function estadoInstalacion(p: ResumenPasarela, ahora: number): { tono: Tono; texto: string } {
  if (p.token === "anulado") return { tono: "neutro", texto: "Token anulado" };
  if (p.token === "caducado") return { tono: "aviso", texto: "Token caducado" };
  if (!p.contacto) return { tono: "azul", texto: "Sin estrenar" };
  if (ahora - p.contacto.t > 5 * 60_000) return { tono: "aviso", texto: "Callada" };
  if (p.contacto.estado.plc !== "conectado") return { tono: "aviso", texto: "Sin PLC" };
  if (p.propuesta) return { tono: "azul", texto: p.contacto.estado.simulado ? "Propone su lista (simulado)" : "Propone su lista" };
  return { tono: "bien", texto: p.contacto.estado.simulado ? "Leyendo (simulado)" : "Leyendo" };
}

/** Las instalaciones de un cliente y las que no son de nadie, para agrupar en la barra y el buscador. */
export function agrupar(clientes: ResumenCliente[], instalaciones: ResumenPasarela[]) {
  const ids = new Set(clientes.map((c) => c.id));
  return {
    deCliente: (id: string) => instalaciones.filter((p) => p.cliente === id),
    sinCliente: instalaciones.filter((p) => !p.cliente || !ids.has(p.cliente)),
  };
}
