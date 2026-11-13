"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { ChipEstado, Grafica } from "@/components/piezas";
import { duracion, grados, gradosC, hora } from "@/lib/formato";
import { CAMARAS, eventos, leer, serie } from "@/lib/sim";
import { useDemo } from "@/lib/store";

export default function FichaCamara() {
  const { id } = useParams<{ id: string }>();
  const { ahora, ajustes, simularAveria, quitarAveria, cambiarConsigna } = useDemo();
  const camara = CAMARAS.find((c) => c.id === id);
  const minuto = ahora === null ? null : Math.floor(ahora / 60_000);

  const historico = useMemo(
    () => (camara && minuto !== null ? serie(camara, minuto * 60_000, ajustes) : []),
    [camara, minuto, ajustes],
  );
  const sucesos = useMemo(
    () => (camara && minuto !== null ? eventos(minuto * 60_000, ajustes).filter((e) => e.camaraId === camara.id).slice(0, 8) : []),
    [camara, minuto, ajustes],
  );

  if (!camara) return <p className="gx-sub">Esa cámara no existe. <Link href="/" className="gx-volver">Volver a las cámaras</Link></p>;
  if (ahora === null) return <p className="gx-sub">Leyendo la cámara…</p>;

  const l = leer(camara, ahora, ajustes);
  const averia = ajustes.averias[camara.id];
  const base = ajustes.consignas[camara.id] ?? camara.consigna;
  const tope = camara.limite - 3;

  return (
    <>
      <Link href="/" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Cámaras
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>{camara.nombre}</h1>
          <p className="gx-sub">{camara.tipo === "congelado" ? "Congelado" : "Fresco"} · el género no debe pasar de {gradosC(camara.limite)}</p>
        </div>
        <ChipEstado estado={l.estado} texto={l.motivo} />
      </header>

      <div className="gx-dos">
        <div className="gx-pila">
          <section className="gx-tarjeta gx-pila">
            <div className="gx-fila">
              <div className={`gx-temp grande${l.estado === "error" ? " error" : ""}`}>{grados(l.temp)}</div>
              <p className="gx-sub">consigna ahora {gradosC(l.consigna)}</p>
            </div>
            <div className="gx-datos">
              <div className="gx-dato"><span>Compresor</span><strong>{l.compresor ? "En marcha" : "Parado"}</strong></div>
              <div className="gx-dato"><span>Puerta</span><strong>{l.puerta ? `Abierta ${l.puertaMin} min` : "Cerrada"}</strong></div>
              <div className="gx-dato"><span>Desescarche</span><strong>{camara.desescarche ? (l.desescarche ? "En curso" : `${camara.desescarche} min`) : "No lleva"}</strong></div>
            </div>
          </section>

          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <h2>Últimas 24 horas</h2>
            <Grafica lecturas={historico} limite={camara.limite} />
            <div className="gx-leyenda">
              <span><i style={{ background: "var(--gx-azul)" }} />Temperatura</span>
              <span><i style={{ background: "var(--gx-gris)" }} />Consigna</span>
              <span><i style={{ background: "var(--gx-error)" }} />Límite del género</span>
            </div>
          </section>

          <section className="gx-tarjeta">
            <h2>Avisos de esta cámara</h2>
            {sucesos.length === 0 ? (
              <p className="gx-vacio">Sin avisos en las últimas 24 horas.</p>
            ) : (
              <ul className="gx-lista">
                {sucesos.map((e) => (
                  <li key={e.desde}>
                    <span>
                      {e.motivo}
                      <small>A las {hora(e.desde)} · duró {duracion(e.hasta - e.desde)}</small>
                    </span>
                    <ChipEstado estado={e.estado} texto={e.estado === "error" ? "Alarma" : "Aviso"} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="gx-pila">
          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <h2>Consigna</h2>
            <div className="gx-fila">
              <button type="button" className="gx-boton secundario" aria-label="Bajar un grado" onClick={() => cambiarConsigna(camara.id, base - 1)}>
                <Minus size={18} aria-hidden="true" />
              </button>
              <strong style={{ fontFamily: "var(--gx-letra-marca)", fontSize: 28, fontWeight: 600 }}>{gradosC(base)}</strong>
              <button type="button" className="gx-boton secundario" aria-label="Subir un grado" disabled={base + 1 > tope} onClick={() => cambiarConsigna(camara.id, base + 1)}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="gx-nota">No deja subir de {gradosC(tope)}, tres grados por debajo del límite del género.</p>
            {base !== camara.consigna && (
              <button type="button" className="gx-boton secundario" onClick={() => cambiarConsigna(camara.id, camara.consigna)}>
                Volver a {gradosC(camara.consigna)}
              </button>
            )}
          </section>

          <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
            <h2>Probar una avería</h2>
            <p className="gx-nota">Solo para la demostración: provoca un fallo y mira cómo reacciona el programa.</p>
            {averia ? (
              <button type="button" className="gx-boton" onClick={() => quitarAveria(camara.id)}>Arreglar la avería</button>
            ) : (
              <>
                <button type="button" className="gx-boton peligro" onClick={() => simularAveria(camara.id, "compresor")}>Parar el compresor</button>
                <button type="button" className="gx-boton peligro" onClick={() => simularAveria(camara.id, "puerta")}>Dejar la puerta abierta</button>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
