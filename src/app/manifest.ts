import type { MetadataRoute } from "next";

// Permite instalar Gradiox en el móvil como una app. En iPhone hace falta para
// que el sistema deje enseñar notificaciones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gradiox",
    short_name: "Gradiox",
    description: "Control de servicios de frío. Demostración con datos simulados.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3f6",
    theme_color: "#0b2540",
    lang: "es",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
