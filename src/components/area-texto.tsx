"use client";

import { useCallback, useEffect, useRef, type ComponentProps } from "react";

/** Un cuadro de texto que crece con lo escrito: nunca tapa parte del texto ni obliga a desplazarse dentro. */
export function AreaTexto({ onInput, ...resto }: ComponentProps<"textarea">) {
  const caja = useRef<HTMLTextAreaElement>(null);
  const ajustar = useCallback(() => {
    const el = caja.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, []);
  useEffect(ajustar, [ajustar, resto.value]);
  useEffect(() => {
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [ajustar]);
  return (
    <textarea
      {...resto}
      ref={caja}
      className={`gx-crece${resto.className ? ` ${resto.className}` : ""}`}
      onInput={(ev) => {
        ajustar();
        onInput?.(ev);
      }}
    />
  );
}
