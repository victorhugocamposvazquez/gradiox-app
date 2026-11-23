import { redirect } from "next/navigation";

// Lo guardado de cada instalación está en su pestaña «Datos guardados». Los enlaces antiguos siguen valiendo.
export default async function Datos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await searchParams;
  redirect(typeof id === "string" && id ? `/ops/instalaciones/${encodeURIComponent(id)}?pestana=datos` : "/ops/instalaciones");
}
