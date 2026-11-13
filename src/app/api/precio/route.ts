import { NextResponse } from "next/server";

// Precio de la luz de hoy por horas (PVPC), de los datos públicos de Red Eléctrica.
// Si no contesta o cambia el formato, la app sigue con el precio simulado y lo dice.
const diaMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

type Serie = { id?: string; type?: string; attributes?: { title?: string; values?: { value?: number; datetime?: string }[] } };

export async function GET() {
  const dia = diaMadrid();
  const url = `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${dia}T00:00&end_date=${dia}T23:59&time_trunc=hour`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Red Eléctrica respondió ${r.status}`);
    const datos = (await r.json()) as { included?: Serie[] };
    const series = datos.included ?? [];
    const serie = series.find((s) => s.id === "1001" || /pvpc/i.test(`${s.type ?? ""} ${s.attributes?.title ?? ""}`)) ?? series[0];
    const valores = (serie?.attributes?.values ?? []).map((v) => Math.round(Number(v.value)));
    if (valores.length !== 24 || valores.some((v) => !Number.isFinite(v))) throw new Error("Formato inesperado");
    return NextResponse.json({ dia, valores, fuente: "PVPC, Red Eléctrica" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin precio" }, { status: 502 });
  }
}
