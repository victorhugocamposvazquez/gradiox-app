"use client";

import Link from "next/link";
import { BellRing, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ICONOS } from "@/components/vigia";
import { mostrar, pedirPermiso, permiso, type Permiso } from "@/lib/dispositivo";
import { hora } from "@/lib/formato";
import { TIPOS, type TipoNoti } from "@/lib/notificaciones";
import { useDemo } from "@/lib/store";

const ORDEN: TipoNoti[] = ["alarma", "conexion", "fallo", "aviso", "recuperado"];
const ESTADO_PERMISO: Record<Permiso, { chip: string; clase: string; texto: string }> = {
  granted: { chip: "Activadas", clase: "correcto", texto: "Este dispositivo enseña las notificaciones de Gradiox aunque estés en otra pestaña o en otra app." },
  default: { chip: "Sin activar", clase: "neutro", texto: "Actívalas para que el ordenador o el móvil te avisen aunque estés en otra pestaña o en otra app." },
  denied: { chip: "Bloqueadas", clase: "aviso", texto: "El navegador las tiene bloqueadas para Gradiox. Se cambia en los permisos del sitio, junto a la dirección." },
  sinsoporte: { chip: "No disponibles", clase: "neutro", texto: "Este navegador no enseña notificaciones. En iPhone, añade antes Gradiox a la pantalla de inicio desde el menú de compartir." },
};

export default function Notificaciones() {
  const { ahora, notis, preferencias, marcarLeidas, vaciarNotis, preferir } = useDemo();
  const [vista, setVista] = useState<"recibidas" | "ajustes">("recibidas");
  const [estado, setEstado] = useState<Permiso>("default");
  const [prueba, setPrueba] = useState("");
  useEffect(() => setEstado(permiso()), []);

  if (ahora === null) return <p className="gx-sub">Cargando las notificaciones…</p>;

  const sinLeer = notis.filter((n) => !n.leida).length;
  const cuando = (t: number) => {
    const d = new Date(t);
    const hoy = new Date(ahora).toDateString() === d.toDateString();
    return hoy ? hora(t) : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, ${hora(t)}`;
  };
  const probar = async () => {
    const ok = await mostrar({ id: `prueba:${Date.now()}`, titulo: "Prueba de Gradiox", texto: "Así llegan las notificaciones a este dispositivo.", href: "/notificaciones" });
    setPrueba(ok ? "Enviada. Si no la ves, mira el modo No molestar del dispositivo." : "No se ha podido enviar desde este navegador.");
  };
  const info = ESTADO_PERMISO[estado];

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Notificaciones</h1>
          <p className="gx-vivo">
            <span className="gx-punto vivo" />
            {sinLeer ? `${sinLeer} sin leer` : "Vigilando en directo · todo leído"}
          </p>
        </div>
        <div className="gx-pestanas" role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista === "recibidas"} onClick={() => setVista("recibidas")}>Recibidas</button>
          <button type="button" aria-pressed={vista === "ajustes"} onClick={() => setVista("ajustes")}>Ajustes</button>
        </div>
      </header>

      {vista === "recibidas" ? (
        <section className="gx-tarjeta">
          <div className="gx-fila" style={{ marginBottom: 8 }}>
            <h2>Lo último</h2>
            {sinLeer > 0 && (
              <button type="button" className="gx-boton secundario" onClick={() => marcarLeidas()}>
                <CheckCheck size={18} strokeWidth={1.7} aria-hidden="true" /> Marcar todo como leído
              </button>
            )}
          </div>
          {notis.length === 0 ? (
            <p className="gx-vacio">
              Aún no ha pasado nada desde que abriste Gradiox. Para ver cómo llega una, <Link href="/conexiones" className="gx-enlace">corta una conexión de prueba</Link>.
            </p>
          ) : (
            <>
              <ul className="gx-notis">
                {notis.map((n) => {
                  const Icono = ICONOS[n.tipo];
                  return (
                    <li key={n.id} className={n.leida ? "leida" : undefined}>
                      <Link href={n.href} onClick={() => marcarLeidas(n.id)}>
                        <span className={`gx-noti-icono ${n.tipo}`}>
                          <Icono size={18} strokeWidth={1.7} aria-hidden="true" />
                        </span>
                        <span className="gx-noti-texto">
                          <strong>{n.titulo}</strong>
                          <small>{n.texto}</small>
                        </span>
                        <time dateTime={new Date(n.cuando).toISOString()}>{cuando(n.cuando)}</time>
                        {!n.leida && <span className="gx-noti-nueva" aria-label="Sin leer" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="gx-boton secundario" style={{ marginTop: 12 }} onClick={vaciarNotis}>Vaciar la lista</button>
            </>
          )}
        </section>
      ) : (
        <div className="gx-pila">
          <section className="gx-tarjeta">
            <div className="gx-fila">
              <h2>En este dispositivo</h2>
              <span className={`gx-chip ${info.clase}`}>{info.chip}</span>
            </div>
            <p className="gx-sub" style={{ margin: "8px 0 14px" }}>{info.texto}</p>
            <div className="gx-fila" style={{ justifyContent: "flex-start" }}>
              {estado === "default" && (
                <button type="button" className="gx-boton" onClick={async () => setEstado(await pedirPermiso())}>
                  <BellRing size={18} strokeWidth={1.7} aria-hidden="true" /> Activar notificaciones
                </button>
              )}
              {estado === "granted" && <button type="button" className="gx-boton secundario" onClick={probar}>Enviar una de prueba</button>}
            </div>
            {prueba && <p className="gx-nota" role="status" style={{ marginTop: 10 }}>{prueba}</p>}
            <p className="gx-nota" style={{ marginTop: 14 }}>
              Hoy Gradiox vigila desde este navegador, así que avisa mientras esté abierto, aunque sea en segundo plano. Con la app cerrada del todo aún no llega nada: para eso hace falta un servidor que vigile.
            </p>
          </section>

          <section className="gx-tarjeta">
            <h2>Qué me interrumpe</h2>
            <p className="gx-sub" style={{ margin: "4px 0 8px" }}>Todo queda apuntado en la lista. Aquí eliges qué salta en pantalla y en el dispositivo.</p>
            <ul className="gx-lista">
              {ORDEN.map((t) => (
                <li key={t}>
                  <label className="gx-interruptor">
                    <span>
                      {TIPOS[t].nombre}
                      <small>{TIPOS[t].detalle}</small>
                    </span>
                    <input type="checkbox" role="switch" checked={preferencias[t]} onChange={(e) => preferir({ [t]: e.target.checked })} />
                    <i aria-hidden="true" />
                  </label>
                </li>
              ))}
              <li>
                <label className="gx-interruptor">
                  <span>
                    Sonido
                    <small>Dos tonos con las alarmas y los cortes de conexión</small>
                  </span>
                  <input type="checkbox" role="switch" checked={preferencias.sonido} onChange={(e) => preferir({ sonido: e.target.checked })} />
                  <i aria-hidden="true" />
                </label>
              </li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
