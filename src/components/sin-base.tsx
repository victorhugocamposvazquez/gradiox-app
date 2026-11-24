import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Aviso de que el servidor no tiene base de datos: lo que se apunte no queda guardado. */
export function SinBase() {
  return (
    <Alert variant="aviso">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Aún no hay base de datos conectada</AlertTitle>
      <AlertDescription>Puedes probar la pantalla, pero lo que apuntes ahora se perderá. Para que quede guardado hay que conectar la base de datos de Supabase al servidor (variable POSTGRES_URL en Vercel).</AlertDescription>
    </Alert>
  );
}
