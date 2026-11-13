// Notificaciones del sistema en este dispositivo (ordenador o móvil). Solo se
// usa en el navegador.

export type Permiso = "sinsoporte" | "default" | "granted" | "denied";

export const permiso = (): Permiso => (typeof window === "undefined" || !("Notification" in window) ? "sinsoporte" : Notification.permission);

async function trabajador(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  } catch {
    return null;
  }
}

/** Pide permiso al navegador y deja listo el trabajador de servicio. */
export async function pedirPermiso(): Promise<Permiso> {
  if (permiso() === "sinsoporte") return "sinsoporte";
  const r = await Notification.requestPermission();
  if (r === "granted") await trabajador();
  return r;
}

export async function mostrar(n: { id: string; titulo: string; texto: string; href: string }): Promise<boolean> {
  if (permiso() !== "granted") return false;
  const opciones = { body: n.texto, tag: n.id, icon: "/icono-192.png", badge: "/icono-192.png", data: { href: n.href } };
  try {
    const reg = await trabajador();
    if (reg) {
      await reg.showNotification(n.titulo, opciones);
      return true;
    }
    const aviso = new Notification(n.titulo, opciones);
    aviso.onclick = () => {
      window.focus();
      window.location.assign(n.href);
    };
    return true;
  } catch {
    return false;
  }
}

/** Dos tonos cortos. El navegador puede callarlo si aún no se ha tocado la página. */
export function pitar() {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.22].forEach((inicio, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 660 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + inicio + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + inicio);
      o.stop(ctx.currentTime + inicio + 0.2);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Sin sonido la notificación llega igual.
  }
}
