// Trabajador de servicio de Gradiox. Enseña las notificaciones del sistema y abre
// la pantalla que toca al pulsarlas. El oyente «push» está preparado para cuando
// haya un servidor que envíe avisos con la app cerrada; hoy nadie los envía.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = {};
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || "Gradiox", {
      body: d.texto || "",
      tag: d.id,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { href: d.href || "/notificaciones" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || "/notificaciones";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          if ("navigate" in v) v.navigate(href).catch(() => null);
          return v.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
