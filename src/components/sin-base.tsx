import { TriangleAlert } from "lucide-react";

/** Aviso de que el servidor no tiene base de datos: lo que se apunte no queda guardado. */
export function SinBase() {
  return (
    <section className="gx-tarjeta gx-sin-base" role="alert">
      <TriangleAlert size={20} strokeWidth={1.6} aria-hidden="true" />
      <div>
        <h2>Aún no hay base de datos conectada</h2>
        <p className="gx-nota">Puedes probar la pantalla, pero lo que apuntes ahora se perderá. Para que quede guardado hay que conectar la base de datos de Supabase al servidor (variable POSTGRES_URL en Vercel).</p>
      </div>
    </section>
  );
}
