import type { Metadata } from "next";
import { Entrada } from "@/app/login/entrada";
import { credencialesOps } from "@/lib/sesion";

export const metadata: Metadata = { title: "Panel interno · Gradiox" };
export const dynamic = "force-dynamic";

export default function EntrarAlPanel() {
  return <Entrada interno configurado={credencialesOps() !== null} />;
}
