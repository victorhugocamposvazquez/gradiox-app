import { redirect } from "next/navigation";

// La actuación es ahora la pestaña «Ahorro» de cada instalación. Los enlaces antiguos siguen valiendo.
export default async function Actuacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await searchParams;
  redirect(typeof id === "string" && id ? `/ops/instalaciones/${encodeURIComponent(id)}?pestana=ahorro` : "/ops/instalaciones");
}
