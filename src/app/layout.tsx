import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/outfit";
import "@fontsource-variable/onest";
import "./globals.css";
import { Armazon } from "@/components/armazon";
import { DemoProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Gradiox",
  applicationName: "Gradiox",
  icons: { icon: [{ url: "/icono-64.png", sizes: "64x64" }, { url: "/icono-192.png", sizes: "192x192" }], apple: "/icono-180.png" },
  appleWebApp: { capable: true, title: "Gradiox", statusBarStyle: "default" },
  description: "Control de servicios de frío: cámaras, túneles, muelles y muebles. Demostración con datos simulados.",
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#e9ebf7" }, { media: "(prefers-color-scheme: dark)", color: "#0c0d20" }],
  width: "device-width",
  initialScale: 1,
};

const TEMA = `try{var t=localStorage.getItem("gradiox-tema");if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Pone el tema antes de pintar, para que no parpadee en claro. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body>
        <DemoProvider>
          <Armazon>{children}</Armazon>
        </DemoProvider>
      </body>
    </html>
  );
}
