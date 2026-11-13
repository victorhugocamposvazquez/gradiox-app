export const grados = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",")}°`;
export const gradosC = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toString().replace(".", ",")} °C`;
export const hora = (t: number) => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
export const dia = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
export const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
export const duracion = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
