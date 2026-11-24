"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** La ficha técnica es ahora una pestaña de cada nave: los enlaces antiguos llevan allí. */
export default function FichaTecnicaAntigua() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    const nave = new URLSearchParams(window.location.search).get("i");
    router.replace(nave ? `/ops/clientes/${id}/instalaciones/${nave}?pestana=tecnica` : `/ops/clientes/${id}?paso=instalaciones`);
  }, [id, router]);
  return <p className="py-2 text-sm text-muted-foreground">Abriendo la ficha técnica…</p>;
}
