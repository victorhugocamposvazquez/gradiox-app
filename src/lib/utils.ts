import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Junta clases de Tailwind sin que se pisen: lo usan las piezas de shadcn/ui.
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
