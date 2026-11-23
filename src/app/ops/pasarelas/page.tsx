import { redirect } from "next/navigation";

// Pasarelas pasó a «Instalaciones»: cada una tiene su página con pestañas. Los enlaces antiguos siguen valiendo.
export default async function Pasarelas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await searchParams;
  redirect(typeof id === "string" && id ? `/ops/instalaciones/${encodeURIComponent(id)}` : "/ops/instalaciones");
}
