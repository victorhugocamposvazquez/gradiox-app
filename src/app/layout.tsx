import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/outfit";
import "@fontsource-variable/inter";
import "./globals.css";
import { Armazon } from "@/components/armazon";
import { DemoProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Gradiox",
  description: "Control de servicios de frío: cámaras, túneles, muelles y muebles. Demostración con datos simulados.",
};
export const viewport: Viewport = { themeColor: "#0b2540", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <DemoProvider>
          <Armazon>{children}</Armazon>
        </DemoProvider>
      </body>
    </html>
  );
}
