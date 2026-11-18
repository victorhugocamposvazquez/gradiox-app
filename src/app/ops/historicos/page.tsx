import { PantallaHistoricos } from "@/components/pantalla-historicos";

// Los históricos de cualquier instalación, vistos desde el panel interno.
export default function HistoricosDelPanel() {
  return <PantallaHistoricos api="/api/ops/historicos" conDemo={false} />;
}
