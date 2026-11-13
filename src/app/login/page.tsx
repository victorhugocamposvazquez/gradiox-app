import type { Metadata } from "next";
import { credenciales } from "@/lib/sesion";
import { Entrada } from "./entrada";

export const metadata: Metadata = { title: "Entrar · Gradiox" };
export const dynamic = "force-dynamic";

export default function Login() {
  return <Entrada configurado={credenciales() !== null} />;
}
