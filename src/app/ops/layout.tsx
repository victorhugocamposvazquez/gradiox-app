import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PanelInterno } from "@/components/panel-interno";
import "../ui.css";

// El panel se puede instalar como app aparte, con su propio icono: la g con «ops» bajo el anillo.
export const metadata: Metadata = {
  title: "Panel interno · Gradiox",
  applicationName: "Gradiox Ops",
  manifest: "/panel.webmanifest",
  icons: { icon: [{ url: "/ops-64.png", sizes: "64x64" }, { url: "/ops-192.png", sizes: "192x192" }], apple: "/ops-180.png" },
  appleWebApp: { capable: true, title: "Gradiox Ops", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export default function CapaDelPanel({ children }: { children: ReactNode }) {
  return <PanelInterno>{children}</PanelInterno>;
}
