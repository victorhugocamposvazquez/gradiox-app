// Recepción de mercancía: la temperatura a la que llega el género y en qué servicio entra.
// Todo lo que hay aquí lo escribe una persona; Gradiox solo lo compara con el límite del servicio.

export type Recepcion = { id: string; cuando: number; camaraId: string; producto: string; proveedor: string; temp: number; nota: string };

/** Lee una temperatura escrita con coma o con punto. Devuelve null si no es un número creíble. */
export function leerTemperatura(texto: string): number | null {
  const limpio = texto.trim().replace("−", "-").replace(",", ".");
  if (!/^-?\d{1,2}(\.\d)?$/.test(limpio)) return null;
  return Number(limpio);
}

/** El género llega bien si no pasa del límite del servicio en el que entra. */
export const llegaBien = (temp: number, limite: number) => temp <= limite;

const celda = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function recepcionesCsv(lista: Recepcion[], servicio: (id: string) => { nombre: string; limite: number } | undefined): string {
  const filas = [["Fecha", "Hora", "Producto", "Proveedor", "Temperatura (°C)", "Entra en", "Límite (°C)", "Dentro del límite", "Nota"].join(";")];
  for (const r of lista) {
    const s = servicio(r.camaraId);
    const d = new Date(r.cuando);
    filas.push([
      d.toLocaleDateString("es-ES"),
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      celda(r.producto),
      celda(r.proveedor),
      r.temp.toFixed(1).replace(".", ","),
      celda(s?.nombre ?? r.camaraId),
      s ? String(s.limite).replace(".", ",") : "",
      s ? (llegaBien(r.temp, s.limite) ? "Sí" : "No") : "",
      celda(r.nota),
    ].join(";"));
  }
  return filas.join("\r\n");
}
