import type { MetadataRoute } from "next";

// Permite instalar Gradiox como una app en el móvil y en el ordenador. En iPhone hace falta para
// que el sistema deje enseñar notificaciones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gradiox",
    short_name: "Gradiox",
    description: "Control de servicios de frío. Demostración con datos simulados.",
    id: "/",
    // Sin sesión, /login enseña la entrada; con sesión, lleva a Hoy.
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#e9ebf7",
    theme_color: "#e9ebf7",
    categories: ["business", "productivity"],
    shortcuts: [
      { name: "Avisos", url: "/avisos" },
      { name: "Servicios", url: "/servicios" },
    ],
    lang: "es",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-mascara-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
