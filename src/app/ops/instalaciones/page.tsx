"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import { conJson, pedir } from "@/clientes/navegador";
import type { ResumenPasarela, SituacionToken } from "@/pasarelas/modelo";
import { estadoInstalacion, useNavegacion } from "@/components/ops/navegacion";
import { Token, fecha, hace } from "@/components/ops/pasarela";
import { Estado } from "@/components/ops/punto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TOKEN: Record<SituacionToken, string> = { vale: "caduca el", anulado: "anulado; caducaba el", caducado: "caducó el" };

/** Todas las instalaciones conectadas, de cualquier cliente, y el alta de una nueva. */
export default function Instalaciones() {
  const router = useRouter();
  const { clientes, recargar } = useNavegacion();
  const [lista, setLista] = useState<ResumenPasarela[] | null>(null);
  const [ahora, setAhora] = useState(0);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState<{ token: string; id: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await pedir<{ guardado: "memoria" | "base"; ahora: number; pasarelas: ResumenPasarela[] }>("/api/ops/pasarelas");
      setLista(d.pasarelas);
      setAhora(d.ahora);
      setGuardado(d.guardado);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido leer");
    }
  }, []);
  useEffect(() => {
    void cargar();
    const reloj = window.setInterval(() => void cargar(), 15_000);
    return () => window.clearInterval(reloj);
  }, [cargar]);
  // Desde el buscador («Dar de alta una instalación») se llega con el cursor ya en el nombre.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nueva")) document.getElementById("gx-instalacion-nueva")?.focus();
  }, []);

  const alta = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ pasarela: ResumenPasarela; token: string }>("/api/ops/pasarelas", conJson("POST", { nombre }));
      setToken({ token: d.token, id: d.pasarela.id });
      setNombre("");
      recargar();
      await cargar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido crear");
    }
    setOcupado(false);
  };

  const nombreCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Conexiones</h1>
        <p className="max-w-[68ch] text-[13px] text-muted-foreground">Todas las conexiones con un programa de Gradiox que lee un PLC. Lo normal es conectar desde la instalación de un cliente (Cliente → Instalación → Conexión), y entonces se ve dentro de la instalación. Aquí quedan además las de prueba o las que aún no son de nadie.</p>
      </header>

      {guardado === "memoria" && <SinBase />}
      {token && (
        <div className="flex flex-col gap-2">
          <Token token={token.token} alCerrar={() => { const id = token.id; setToken(null); router.push(`/ops/instalaciones/${id}`); }} />
        </div>
      )}

      <form onSubmit={alta} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <label className="flex min-w-0 flex-[1_1_260px] flex-col gap-1 text-[13px] font-medium" htmlFor="gx-instalacion-nueva">
          Instalación nueva
          <Input id="gx-instalacion-nueva" value={nombre} maxLength={80} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nombre de la conexión, p. ej. Nave de Alvedro" autoComplete="off" className="h-8 font-normal" />
        </label>
        <Button type="submit" size="sm" disabled={ocupado || !nombre.trim()}>
          <Plus aria-hidden="true" /> Crear y sacar su token
        </Button>
        {fallo && <p role="alert" className="basis-full text-[13px] text-mal">{fallo}</p>}
      </form>

      <section aria-labelledby="titulo-lista" className="overflow-hidden rounded-lg border bg-card">
        <h2 id="titulo-lista" className="m-0 border-b px-4 py-3 text-sm font-semibold">
          {lista === null ? "Conexiones" : `${lista.length} ${lista.length === 1 ? "conexión" : "conexiones"}`}
        </h2>
        {lista === null ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">{fallo || "Leyendo las conexiones…"}</p>
        ) : lista.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">Todavía no hay ninguna. Escribe arriba su nombre y pulsa «Crear y sacar su token»: ese token se pega en el programa de la planta y ya puede entregar lecturas.</p>
        ) : (
          <ul data-slot="lista-instalaciones" className="divide-y">
            {lista.map((p) => {
              const e = estadoInstalacion(p, ahora);
              const de = p.cliente ? nombreCliente.get(p.cliente) : undefined;
              return (
                <li key={p.id} data-slot="fila-instalacion">
                  <Link href={`/ops/instalaciones/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{p.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {de ?? "Sin cliente"} · {p.variables} {p.variables === 1 ? "variable" : "variables"} · token …{p.pista}, {TOKEN[p.token]} {fecha(p.caduca)}
                        {p.contacto ? ` · último contacto ${hace(p.contacto.t, ahora)}` : ""}
                      </span>
                    </span>
                    <Estado tono={e.tono} texto={e.texto} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
