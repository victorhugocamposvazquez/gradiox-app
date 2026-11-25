import { redirect } from "next/navigation";

// La actuación es ahora el plan «Consignas por tarifa», en la pestaña «Planes» de cada instalación. Los enlaces antiguos siguen valiendo.
export default async function Actuacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await searchParams;
  redirect(typeof id === "string" && id ? `/ops/instalaciones/${encodeURIComponent(id)}?pestana=ahorro` : "/ops/instalaciones");
}
