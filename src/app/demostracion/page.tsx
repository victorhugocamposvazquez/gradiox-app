"use client";

import Link from "next/link";
import { Play, Plug, Route, Unplug } from "lucide-react";
import { useState } from "react";
import { useGuion } from "@/components/guion";
import { ChipEstado } from "@/components/piezas";
import { AUTOMATAS, CAMARAS, PASARELA, leer, type Estado } from "@/lib/datos";
import { useDemo } from "@/lib/store";

const TEXTO: Record<Estado, string> = { correcto: "Bien", aviso: "Aviso", error: "Alarma", sindatos: "Sin datos" };

export default function Demostracion() {
  const { ahora, ajustes, simularAveria, quitarAveria, cortarConexion, restablecerConexion, reiniciar } = useDemo();
  const { empezar, recorrer, paso } = useGuion();
  const [seguro, setSeguro] = useState(false);
  if (ahora === null) return <p className="gx-sub">Preparando la demostración…</p>;

  const cortes = ajustes.cortes ?? {};
  const enlaces = [PASARELA, ...AUTOMATAS];
  const averias = Object.keys(ajustes.averias).length;
  const caidos = enlaces.filter((e) => cortes[e.id] !== undefined).length;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <Link href="/" className="gx-volver">Hoy</Link>
          <h1>Demostración</h1>
          <p className="gx-sub">Todo lo que es de prueba, en un solo sitio. Nada de esto toca una instalación real.</p>
        </div>
        {(averias > 0 || caidos > 0) && <span className="gx-chip aviso">{averias + caidos} {averias + caidos === 1 ? "prueba en marcha" : "pruebas en marcha"}</span>}
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div>
            <h2>Una avería contada paso a paso</h2>
            <p className="gx-sub">Se para un compresor y se ve qué hace Gradiox en cada pantalla, hasta que queda arreglado.</p>
          </div>
          <span className="gx-acciones" style={{ marginTop: 0 }}>
            <button type="button" className="gx-boton" disabled={paso !== null} onClick={empezar}>
              <Play size={18} strokeWidth={1.7} aria-hidden="true" /> Ver la avería paso a paso
            </button>
            <button type="button" className="gx-boton secundario" disabled={paso !== null} onClick={recorrer}>
              <Route size={18} strokeWidth={1.7} aria-hidden="true" /> Repetir el recorrido
            </button>
          </span>
        </section>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Provocar una avería</h2>
            <p className="gx-sub">La temperatura empieza a subir y saltan el aviso y la alarma.</p>
            <ul className="gx-lista gx-pruebas">
              {CAMARAS.map((c) => {
                const averia = ajustes.averias[c.id];
                const estado = leer(c, ahora, ajustes).estado;
                return (
                  <li key={c.id}>
                    <span>
                      <Link href={`/servicios/${c.id}`} className="gx-enlace">{c.nombre}</Link>
                      <small>{averia ? (averia.tipo === "compresor" ? "Compresor parado" : "Puerta abierta") : "Sin averías"}</small>
                    </span>
                    <ChipEstado estado={estado} texto={TEXTO[estado]} />
                    <span className="gx-acciones" style={{ marginTop: 0 }}>
                      {averia ? (
                        <button type="button" className="gx-boton" aria-label={`Arreglar: ${c.nombre}`} onClick={() => quitarAveria(c.id)}>Arreglar</button>
                      ) : (
                        <>
                          {!c.sinCompresor && <button type="button" className="gx-boton secundario" aria-label={`Parar el compresor: ${c.nombre}`} onClick={() => simularAveria(c.id, "compresor")}>Parar compresor</button>}
                          {!c.sinPuerta && <button type="button" className="gx-boton secundario" aria-label={`Dejar la puerta abierta: ${c.nombre}`} onClick={() => simularAveria(c.id, "puerta")}>Abrir puerta</button>}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="gx-pila">
            <section className="gx-tarjeta">
              <h2>Cortar una conexión</h2>
              <p className="gx-sub">Los servicios que cuelgan de ella se quedan sin datos.</p>
              <ul className="gx-lista gx-pruebas">
                {enlaces.map((e) => {
                  const cortado = cortes[e.id] !== undefined;
                  return (
                    <li key={e.id}>
                      <span>
                        {e.nombre}
                        <small>{cortado ? "Sin conexión" : "Conectado"}</small>
                      </span>
                      {cortado ? (
                        <button type="button" className="gx-boton" aria-label={`Restablecer: ${e.nombre}`} onClick={() => restablecerConexion(e.id)}>
                          <Plug size={18} strokeWidth={1.7} aria-hidden="true" /> Restablecer
                        </button>
                      ) : (
                        <button type="button" className="gx-boton secundario" aria-label={`Cortar: ${e.nombre}`} onClick={() => cortarConexion(e.id)}>
                          <Unplug size={18} strokeWidth={1.7} aria-hidden="true" /> Cortar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="gx-nota">Cómo queda se ve en <Link href="/sistema" className="gx-enlace">Sistema</Link> y en <Link href="/conexiones" className="gx-enlace">Conexiones</Link>.</p>
            </section>

            <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
              <div>
                <h2>Empezar de cero</h2>
                <p className="gx-sub">Borra lo apuntado en este navegador: averías, cortes, órdenes, notas, relevos, rondas y entradas. No se puede deshacer.</p>
              </div>
              {seguro ? (
                <span className="gx-acciones" style={{ marginTop: 0 }}>
                  <button type="button" className="gx-boton peligro" onClick={() => { reiniciar(); setSeguro(false); }}>Sí, borrarlo todo</button>
                  <button type="button" className="gx-boton secundario" onClick={() => setSeguro(false)}>Cancelar</button>
                </span>
              ) : (
                <span className="gx-acciones" style={{ marginTop: 0 }}>
                  <button type="button" className="gx-boton secundario" onClick={() => setSeguro(true)}>Empezar de cero</button>
                </span>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
