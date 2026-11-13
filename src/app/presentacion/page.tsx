import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bell, ClipboardList, Thermometer, Wrench, Zap } from "lucide-react";
import { Marca } from "@/components/marca";

export const metadata: Metadata = {
  title: "Gradiox · Telegestión de cámaras frigoríficas",
  description: "Gradiox vigila a distancia cámaras frigoríficas y otros servicios de frío: temperaturas, alarmas, mantenimiento y consumo. Versión de demostración con datos simulados.",
};
export const dynamic = "force-dynamic";

const PUNTOS = [
  { Icono: Thermometer, titulo: "Cada servicio, en vivo", texto: "Temperatura, puerta, compresor y desescarche de cámaras, túneles, muelles y muebles, con su histórico." },
  { Icono: Bell, titulo: "Avisa antes del límite", texto: "Dice cuánto tiempo queda hasta el límite del género, qué hay que revisar y a quién se ha avisado." },
  { Icono: Wrench, titulo: "Mantenimiento al día", texto: "Revisiones, órdenes de trabajo y el libro de intervenciones de cada equipo." },
  { Icono: Zap, titulo: "Enfría cuando la luz es barata", texto: "Un plan diario con el precio por horas que nunca se acerca al límite del género." },
  { Icono: ClipboardList, titulo: "Registro de temperaturas", texto: "Mínimas, máximas y ratos fuera de límite por días, listos para una inspección." },
  { Icono: Activity, titulo: "Todo bien conectado", texto: "Una pantalla que comprueba la cadena entera, de la sonda al teléfono de guardia." },
];

export default function Presentacion() {
  // Solo se enseña un contacto si quien despliega lo ha puesto; no se inventa ninguno.
  const contacto = process.env.GRADIOX_CONTACTO?.trim();
  return (
    <div className="gx-presenta">
      <header className="gx-presenta-cabeza">
        <span className="gx-aros" aria-hidden="true"><i /><i /><i /></span>
        <div className="gx-presenta-barra">
          <Marca size={30} oscuro />
          <Link href="/login" className="gx-boton">Entrar</Link>
        </div>
        <div className="gx-presenta-lema">
          <h1>El frío, bajo control.</h1>
          <p>Gradiox es un programa para vigilar a distancia instalaciones frigoríficas: naves con cámaras de congelado y de fresco, túneles, muelles y muebles. Pensado para quien las instala, las mantiene y las usa cada día.</p>
        </div>
      </header>

      <main className="gx-presenta-cuerpo">
        <section>
          <h2>Qué hace</h2>
          <ul className="gx-presenta-puntos">
            {PUNTOS.map(({ Icono, titulo, texto }) => (
              <li key={titulo}>
                <Icono size={24} strokeWidth={1.6} aria-hidden="true" />
                <strong>{titulo}</strong>
                {texto}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>En qué punto está</h2>
          <div className="gx-presenta-texto">
            <p>Lo que hay en esta dirección es una demostración. Los datos son simulados: no hay ninguna instalación conectada, no se manda ninguna orden a ningún equipo y no se guarda nada de quien la usa fuera de su propio navegador.</p>
            <p>Se entra con un usuario y una contraseña que da quien enseña la demostración. Aquí no se pide ningún dato personal ni de pago.</p>
          </div>
        </section>

        <section>
          <h2>Contacto</h2>
          <div className="gx-presenta-texto">
            {contacto ? (
              <p>Para verlo funcionando o hablar de una instalación: <a href={`mailto:${contacto}`} style={{ color: "var(--gx-azul)", textDecoration: "underline" }}>{contacto}</a>.</p>
            ) : (
              <p>Si te han pasado esta dirección, quien lo ha hecho puede darte acceso a la demostración.</p>
            )}
          </div>
        </section>

        <p className="gx-presenta-pie">Gradiox · gradiox.com · Demostración con datos simulados.</p>
      </main>
    </div>
  );
}
