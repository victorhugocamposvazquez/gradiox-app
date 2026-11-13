import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/outfit";
import "@fontsource-variable/inter";
import "./globals.css";
import { Armazon } from "@/components/armazon";
import { DemoProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Gradiox",
  icons: { icon: "/icono-192.png", apple: "/icono-192.png" },
  description: "Control de servicios de frío: cámaras, túneles, muelles y muebles. Demostración con datos simulados.",
};
export const viewport: Viewport = { themeColor: "#0b2540", width: "device-width", initialScale: 1 };

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
