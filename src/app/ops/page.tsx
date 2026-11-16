"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SinBase } from "@/components/sin-base";
import { ESTADOS, TONO, clienteVacio, type Cliente, type ResumenCliente } from "@/clientes/modelo";
import { conJson, pedir } from "@/clientes/navegador";

const cuando = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function Clientes() {
  const ir = useRouter();
  const [lista, setLista] = useState<ResumenCliente[] | null>(null);
  const [guardado, setGuardado] = useState<"memoria" | "base">("base");
  const [fallo, setFallo] = useState("");
  const [nombre, setNombre] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    pedir<{ guardado: "memoria" | "base"; clientes: ResumenCliente[] }>("/api/ops/clientes")
      .then((d) => {
        if (!vivo) return;
        setLista(d.clientes);
        setGuardado(d.guardado);
      })
      .catch((e: Error) => vivo && setFallo(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const alta = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    setFallo("");
    try {
      const d = await pedir<{ cliente: Cliente }>("/api/ops/clientes", conJson("POST", { ...clienteVacio(), nombre }));
      ir.push(`/ops/clientes/${d.cliente.id}`);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se ha podido dar de alta");
      setOcupado(false);
    }
  };

  const q = busca.trim().toLowerCase();
  const vistos = (lista ?? []).filter((c) => !q || `${c.nombre} ${c.direccion} ${ESTADOS[c.estado]}`.toLowerCase().includes(q));

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Clientes</h1>
          <p className="gx-sub">Zona interna de Gradiox: las empresas que se visitan y se instalan, con sus datos, sus puntos de frío y sus fotos.</p>
        </div>
        <div className="gx-acciones-cabecera">
          <Link href="/ops/visita" className="gx-boton secundario">
            <ClipboardList size={18} strokeWidth={1.6} aria-hidden="true" /> Guía de visita
          </Link>
        </div>
      </header>

      <div className="gx-pila">
        {guardado === "memoria" && <SinBase />}

        <form className="gx-tarjeta gx-alta" onSubmit={alta}>
          <label className="gx-campo">
            Cliente nuevo
            <input value={nombre} maxLength={120} onChange={(ev) => setNombre(ev.target.value)} placeholder="Nombre de la empresa" autoComplete="off" />
          </label>
          <button type="submit" className="gx-boton" disabled={ocupado || !nombre.trim()}>
            <Plus size={18} strokeWidth={1.7} aria-hidden="true" /> Dar de alta
          </button>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
        </form>

        <section className="gx-tarjeta">
          <div className="gx-lista-cabeza">
            <h2>{lista === null ? "Clientes" : `Clientes · ${lista.length}`}</h2>
            {lista && lista.length > 5 && (
              <label className="gx-campo gx-filtro">
                <span className="gx-solo-lector">Buscar cliente</span>
                <Search size={15} aria-hidden="true" />
                <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" />
              </label>
            )}
          </div>
          {lista === null ? (
            <p className="gx-vacio">{fallo ? "No se han podido leer los clientes." : "Leyendo los clientes…"}</p>
          ) : lista.length === 0 ? (
            <p className="gx-vacio">Todavía no hay ningún cliente. Escribe arriba el nombre de la empresa y pulsa «Dar de alta»: después podrás añadir sus datos, sus cámaras y las fotos de la visita.</p>
          ) : vistos.length === 0 ? (
            <p className="gx-vacio">Ningún cliente coincide con «{busca}».</p>
          ) : (
            <ul className="gx-tareas gx-clientes">
              {vistos.map((c) => (
                <li key={c.id}>
                  <Link href={`/ops/clientes/${c.id}`}>
                    <span>
                      <strong>{c.nombre}</strong>
                      <small>
                        {[c.direccion, cuenta(c.puntos, "punto de frío", "puntos de frío"), cuenta(c.fotos, "foto", "fotos"), `cambiado el ${cuando(c.actualizado)}`].filter(Boolean).join(" · ")}
                      </small>
                    </span>
                    <span className={`gx-chip ${TONO[c.estado]}`}>{ESTADOS[c.estado]}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
