// Ilustraciones animadas de los pasos de una avería. Dibujadas a mano: no son iconos de librería.
// Se animan con CSS cuando su paso está activo (li.hecho) y quedan fijas con «reducir movimiento».

export type Paso = "detecta" | "avisa" | "actua" | "constancia";

export function Dibujo({ paso }: { paso: Paso }) {
  return (
    <svg className={`gw-dibujo ${paso}`} viewBox="0 0 200 140" aria-hidden="true" focusable="false">
      {paso === "detecta" && (
        <>
          <g className="d-rejilla">
            <path d="M20 112H180M20 84H180M20 56H180" />
          </g>
          <path className="d-limite" d="M20 34H180" />
          <rect className="d-etiqueta" x="144" y="13" width="36" height="10" rx="5" />
          <path className="d-curva" pathLength={1} d="M20 100C34 96 40 104 54 100S76 92 88 98S108 100 118 90S136 70 150 58" />
          <path className="d-margen" d="M150 54V38" />
          <circle className="d-onda" cx="150" cy="58" r="7" />
          <circle className="d-punto" cx="150" cy="58" r="5" />
        </>
      )}
      {paso === "avisa" && (
        <>
          <rect className="d-movil" x="34" y="14" width="64" height="112" rx="12" />
          <path className="d-movil-linea" d="M58 24H74" />
          <g className="d-aviso">
            <rect x="42" y="40" width="48" height="26" rx="7" />
            <circle cx="52" cy="53" r="4" />
            <path d="M61 49H82M61 57H76" />
          </g>
          <path className="d-escala" pathLength={1} d="M104 53C122 53 126 86 142 86" />
          <g className="d-persona">
            <circle cx="160" cy="76" r="8" />
            <path d="M144 106C144 95 151 90 160 90S176 95 176 106" />
          </g>
          <circle className="d-onda" cx="90" cy="40" r="6" />
          <circle className="d-onda dos" cx="90" cy="40" r="6" />
        </>
      )}
      {paso === "actua" && (
        <>
          <rect className="d-automata" x="18" y="40" width="58" height="60" rx="9" />
          <circle className="d-led a" cx="32" cy="56" r="3.5" />
          <circle className="d-led b" cx="44" cy="56" r="3.5" />
          <circle className="d-led c" cx="56" cy="56" r="3.5" />
          <path className="d-automata-linea" d="M30 72H64M30 84H54" />
          <path className="d-cable" d="M76 70H122" />
          <path className="d-orden" d="M76 70H122" />
          <circle className="d-equipo" cx="152" cy="70" r="30" />
          <g className="d-aspas">
            <path d="M152 70C148 58 152 48 160 46C162 56 158 64 152 70ZM152 70C164 66 174 70 176 78C166 80 158 76 152 70ZM152 70C156 82 152 92 144 94C142 84 146 76 152 70ZM152 70C140 74 130 70 128 62C138 60 146 64 152 70Z" />
          </g>
          <circle className="d-eje" cx="152" cy="70" r="4.5" />
        </>
      )}
      {paso === "constancia" && (
        <>
          <path className="d-hoja" d="M52 14H122L148 40V126H52Z" />
          <path className="d-doblez" d="M122 14V40H148" />
          <path className="d-renglon r1" pathLength={1} d="M66 58H134" />
          <path className="d-renglon r2" pathLength={1} d="M66 74H134" />
          <path className="d-renglon r3" pathLength={1} d="M66 90H112" />
          <circle className="d-sello" cx="140" cy="106" r="19" />
          <path className="d-visto" pathLength={1} d="M131 106L138 113L150 100" />
        </>
      )}
    </svg>
  );
}
