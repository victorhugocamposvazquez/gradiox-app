"use client";

// El alta de un cliente, en una pantalla para ella sola: arriba lo que se está haciendo y
// debajo solo el nombre. Nada de otros clientes ni pendientes alrededor que distraigan.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { clienteVacio, instalacionVacia, type Cliente } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";
import { BarraMovil } from "@/components/ops/movil";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Lo que viene después, para que se sepa desde el principio cuánto queda. Son los pasos de la hoja de ruta. */
const DESPUES = ["Apuntar el contacto", "Apuntar las cámaras en la visita", "Completar la ficha técnica: cómo se conecta", "Marcar la propuesta aceptada", "Conectar la instalación", "Poner el programa a leer", "Darle acceso a la app"];

export default function ClienteNuevo() {
  const ir = useRouter();
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => campo.current?.focus(), []);

  const alta = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ cliente: Cliente }>("/api/ops/clientes", conJson("POST", { ...clienteVacio(), nombre, instalaciones: [instalacionVacia()] }));
      ir.replace(`/ops/clientes/${d.cliente.id}?nuevo=1`);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido dar de alta");
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <BarraMovil arriba="/ops/clientes" titulo="Cliente nuevo" sub="Alta de cliente" />
      <header className="flex flex-col gap-1">
        <p className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">Alta de cliente</p>
        <h1 className="m-0 text-xl font-semibold tracking-tight">Cliente nuevo</h1>
        <p className="m-0 text-[13px] text-muted-foreground">Empieza por el nombre de la empresa. Lo demás se rellena después, paso a paso, en su ficha.</p>
      </header>

      <Card className="py-4">
        <CardContent className="px-4">
          <form onSubmit={alta} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="gx-cliente-nuevo">
              Nombre de la empresa
              <Input ref={campo} id="gx-cliente-nuevo" value={nombre} maxLength={120} onChange={(ev) => setNombre(ev.target.value)} placeholder="Por ejemplo, Frigoríficos del Norte" autoComplete="off" className="h-10 font-normal" />
            </label>
            {fallo && <p role="alert" className="m-0 text-[13px] text-mal">{fallo}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={ocupado || !nombre.trim()}>
                {ocupado ? "Dando de alta…" : "Dar de alta y seguir"} <ArrowRight aria-hidden="true" />
              </Button>
              <Button asChild variant="ghost" className="max-md:hidden">
                <Link href="/ops/clientes"><X aria-hidden="true" /> Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="titulo-despues" className="flex flex-col gap-2">
        <h2 id="titulo-despues" className="m-0 text-sm font-semibold">Después, siete pasos</h2>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {DESPUES.map((t, n) => (
            <li key={t} className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums">{n + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <p className="m-0 text-xs text-muted-foreground">No hace falta hacerlo todo hoy: la ficha guarda por dónde vas y te dice el paso siguiente.</p>
      </section>
    </div>
  );
}
