/** Logotipo «gradi°x»: Outfit seminegra con la o hecha anillo. */
export function Marca({ size = 28, oscuro = false }: { size?: number; oscuro?: boolean }) {
  const d = size * 0.59;
  return (
    <span className={`gx-marca${oscuro ? " oscuro" : ""}`} style={{ fontSize: size }} role="img" aria-label="Gradiox">
      <span aria-hidden="true">gradi</span>
      <span
        aria-hidden="true"
        className="gx-anillo"
        style={{ width: d, height: d, borderWidth: size * 0.145, margin: `0 ${size * 0.05}px ${size * 0.105}px ${size * 0.08}px` }}
      />
      <span aria-hidden="true">x</span>
    </span>
  );
}
