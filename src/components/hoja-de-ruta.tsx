"use client";

// La hoja de ruta de un cliente en su ficha del panel: por dónde va el alta,
// cómo está lo que ya funciona y la entrada de soporte a su app.

import Link from "next/link";
import { Check, LifeBuoy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { conJson, pedir } from "@/clientes/navegador";
import type { Ruta } from "@/clientes/ruta";

type Estado = { ahora: number; ruta: Ruta; visitas: { t: number; motivo: string }[] };
const fecha = (t: number) => new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PUNTO = { bien: "", mirar: "mirar", mal: "mal" } as const;

export function HojaDeRuta({ cliente, nombre }: { cliente: string; nombre: string }) {
  const [e, setE] = useState<Estado | null>(null);
  const [fallo, setFallo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    pedir<Estado>(`/api/ops/clientes/${cliente}/ruta`).then(setE).catch((x: Error) => setFallo(x.message));
  }, [cliente]);

  const entrar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEntrando(true);
    setFallo("");
    try {
      await pedir(`/api/ops/clientes/${cliente}/soporte`, conJson("POST", { motivo }));
      // La app se abre en otra pestaña: el panel se queda donde estaba.
      window.open("/", "_blank", "noopener");
      setMotivo("");
      setE(await pedir<Estado>(`/api/ops/clientes/${cliente}/ruta`));
    } catch (x) {
      setFallo((x as Error).message);
    }
    setEntrando(false);
  };

  if (!e) return <section className="gx-tarjeta"><p className="gx-vacio">{fallo || "Cargando la hoja de ruta…"}</p></section>;
  const { ruta } = e;
  const mal = ruta.seguimiento.filter((x) => x.nivel === "mal").length;
  const mirar = ruta.seguimiento.filter((x) => x.nivel === "mirar").length;

  return (
    <>
      <section className="gx-tarjeta gx-ruta" aria-labelledby="ruta-alta">
        <div className="gx-fila">
          <div>
            <h2 id="ruta-alta">Hoja de ruta del alta · {ruta.hechos} de {ruta.alta.length}</h2>
            <p className="gx-sub">{ruta.siguiente ? `Ahora toca: ${ruta.siguiente.titulo.charAt(0).toLowerCase()}${ruta.siguiente.titulo.slice(1)}` : "Alta completa: el cliente está dentro y su instalación lee."}</p>
          </div>
          <span className={`gx-chip ${ruta.siguiente ? "azul" : "correcto"}`}>{ruta.siguiente ? "En curso" : "Completa"}</span>
        </div>
        <div className="gx-ruta-barra" role="img" aria-label={`${ruta.hechos} de ${ruta.alta.length} pasos hechos`}><i style={{ width: `${(ruta.hechos / ruta.alta.length) * 100}%` }} /></div>
        <ol className="gx-ruta-pasos">
          {ruta.alta.map((p, n) => (
            <li key={p.id} className={p.hecho ? "hecho" : p.id === ruta.siguiente?.id ? "ahora" : undefined}>
              <span className="marca" aria-hidden="true">{p.hecho ? <Check size={14} strokeWidth={2.4} /> : n + 1}</span>
              <span>
                <strong>{p.titulo}</strong>
                <small>{p.detalle}</small>
              </span>
              <Link href={p.donde} className="gx-volver" aria-label={`${p.hecho ? "Ver" : "Hacer"}: ${p.titulo}`}>{p.hecho ? "Ver" : "Hacerlo"}</Link>
            </li>
          ))}
        </ol>
        <p className="gx-nota">Los pasos se marcan solos al estar hecho lo que piden: no hay nada que tachar a mano.</p>
      </section>

      <div className="gx-dos igual">
        <section className="gx-tarjeta" aria-labelledby="ruta-seg">
          <h2 id="ruta-seg">Seguimiento{ruta.enMarcha ? ` · ${mal ? `${mal} ${mal === 1 ? "fallo" : "fallos"}` : mirar ? `${mirar} por mirar` : "todo bien"}` : ""}</h2>
          {ruta.seguimiento.length === 0 ? (
            <p className="gx-vacio">Empieza cuando su pasarela se estrene: aquí se verá si entrega, si llega al autómata y si el cliente usa la app.</p>
          ) : (
            <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
              {ruta.seguimiento.map((x) => (
                <li key={x.id}>
                  <span className={`gx-punto ${PUNTO[x.nivel]}`} role="img" aria-label={x.nivel === "mal" ? "Falla" : x.nivel === "mirar" ? "Por mirar" : "Bien"} />
                  <span>
                    <strong style={{ fontWeight: 500 }}>{x.titulo}</strong>
                    <small>{x.detalle}</small>
                  </span>
                  {x.nivel !== "bien" && <Link href={x.donde} className="gx-volver">Ver</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gx-tarjeta" aria-labelledby="ruta-soporte">
          <h2 id="ruta-soporte">Ver su app como soporte</h2>
          <p className="gx-nota" style={{ marginTop: 6 }}>Abre la app tal como la ve {nombre || "este cliente"}, una hora y sin poder cambiar nada. El motivo queda apuntado aquí y el cliente lo puede ver en su app, en Seguridad.</p>
          <form className="gx-formulario" onSubmit={entrar} style={{ marginTop: 10 }}>
            <label className="gx-campo">
              Motivo de la visita
              <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} maxLength={200} placeholder="Dice que no ve la cámara 12" required minLength={5} />
            </label>
            <button type="submit" className="gx-boton" disabled={entrando || motivo.trim().length < 5}><LifeBuoy size={16} strokeWidth={1.7} aria-hidden="true" /> {entrando ? "Abriendo…" : "Entrar a ver su app"}</button>
          </form>
          {fallo && <p className="gx-nota" role="alert" style={{ color: "var(--gx-error)" }}>{fallo}</p>}
          {e.visitas.length > 0 && (
            <>
              <h3 className="gx-subtitulo">Últimas visitas</h3>
              <ul className="gx-lista gx-compro">
                {e.visitas.map((v) => (
                  <li key={v.t}><span><strong style={{ fontWeight: 500 }}>{fecha(v.t)}</strong><small>{v.motivo}</small></span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}

type Resumen = { id: string; nombre: string; hechos: number; total: number; siguiente: string | null; enMarcha: boolean; mal: string[]; mirar: number };

/** En la portada del panel: por dónde va cada cliente. */
export function RutasDeTodos() {
  const [rutas, setRutas] = useState<Resumen[] | null>(null);
  useEffect(() => {
    pedir<{ rutas: Resumen[] }>("/api/ops/rutas").then((d) => setRutas(d.rutas)).catch(() => setRutas([]));
  }, []);
  if (!rutas?.length) return null;
  return (
    <section className="gx-tarjeta gx-ruta" aria-labelledby="rutas-todos">
      <h2 id="rutas-todos">Hoja de ruta de cada cliente</h2>
      <ul className="gx-lista gx-compro" style={{ marginTop: 8 }}>
        {rutas.map((r) => (
          <li key={r.id}>
            <span className={`gx-punto ${r.mal.length ? "mal" : r.siguiente || r.mirar ? "mirar" : ""}`} role="img" aria-label={r.mal.length ? "Falla" : r.siguiente || r.mirar ? "Por mirar" : "Bien"} />
            <span>
              <strong style={{ fontWeight: 500 }}>{r.nombre || "Cliente sin nombre"} · {r.hechos} de {r.total}</strong>
              <small>{r.mal[0] ?? (r.siguiente ? `Ahora toca: ${r.siguiente.charAt(0).toLowerCase()}${r.siguiente.slice(1)}` : r.mirar ? `Alta completa · ${r.mirar} por mirar en el seguimiento` : "Alta completa y todo bien")}</small>
              <span className="gx-ruta-barra" aria-hidden="true"><i style={{ width: `${(r.hechos / r.total) * 100}%` }} /></span>
            </span>
            <Link href={`/ops/clientes/${r.id}`} className="gx-volver" aria-label={`Abrir la hoja de ruta de ${r.nombre}`}>Ver</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
