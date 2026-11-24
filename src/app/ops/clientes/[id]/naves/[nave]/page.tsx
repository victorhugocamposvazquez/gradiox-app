import { redirect } from "next/navigation";

// Las naves pasaron a llamarse instalaciones (24 nov 2026): los enlaces guardados siguen valiendo.
export default async function NaveAntigua({ params, searchParams }: { params: Promise<{ id: string; nave: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, nave } = await params;
  const q = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : (v ?? []).map((x) => [k, x]))));
  redirect(`/ops/clientes/${encodeURIComponent(id)}/instalaciones/${encodeURIComponent(nave)}${q.size ? `?${q}` : ""}`);
}
