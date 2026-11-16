// Instalar Gradiox como app en este dispositivo. Solo se usa en el navegador.
// El navegador avisa una vez, pronto, de que la app se puede instalar: se guarda
// ese aviso para ofrecer el botón más tarde, cuando la persona lo pida.

type Aviso = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let aviso: Aviso | null = null;
let preparado = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** Se llama una vez al arrancar: deja listo el trabajador de servicio y escucha al navegador. */
export function prepararInstalacion(): void {
  if (typeof window === "undefined" || preparado) return;
  preparado = true;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as Aviso;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    avisar();
  });
}

export type EstadoInstalacion = "instalada" | "lista" | "iphone" | "manual";

export function estadoInstalacion(): EstadoInstalacion {
  const sola = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (sola) return "instalada";
  if (aviso) return "lista";
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iphone ? "iphone" : "manual";
}

export function alCambiarInstalacion(f: () => void): () => void {
  oyentes.add(f);
  return () => void oyentes.delete(f);
}

/** Abre la ventana de instalación del navegador. Devuelve si la persona aceptó. */
export async function instalar(): Promise<boolean> {
  if (!aviso) return false;
  const a = aviso;
  await a.prompt();
  const { outcome } = await a.userChoice;
  aviso = null;
  avisar();
  return outcome === "accepted";
}
