"use client";

import type { ReactNode } from "react";
import { ComoFuncionaVivo, EnlacesDocs } from "@/components/conexion-viva";
import { useNaveViva } from "@/vivo/cliente";

/** Con una ubicación conectada elegida, se cuenta cómo funciona allí; con la nave de demostración, la explicación general. */
export function ComoFuncionaSegun({ cabecera, general, nota }: { cabecera: ReactNode; general: ReactNode; nota: ReactNode }) {
  const nave = useNaveViva();
  if (nave.cargando) return <p className="gx-sub">Cargando…</p>;
  if (nave.viva) return <ComoFuncionaVivo u={nave.viva} general={general} />;
  return (
    <>
      {cabecera}
      <div className="gx-pila">
        <EnlacesDocs />
        {general}
        {nota}
      </div>
    </>
  );
}
