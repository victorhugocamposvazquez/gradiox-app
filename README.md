# Gradiox

Control de cámaras frigoríficas. **Demostración con datos simulados**: no hay ningún autómata ni instalación conectada.

## Qué hace

- **Cámaras**: estado de cada cámara (temperatura, consigna, compresor, puerta, desescarche) y su histórico de 24 horas.
- **Avisos**: alarmas y avisos de las últimas 24 horas, y reglas sencillas para anticiparse.
- **Luz**: precio por horas y un plan que enfría de más en las horas baratas y afloja en las caras.
- **Mantenimiento**: próximas revisiones de cada equipo y libro de intervenciones.

En la ficha de cada cámara se puede provocar una avería para ver cómo reacciona el programa.

## Qué es simulado

- Las lecturas salen de `src/lib/sim.ts`: una función del instante, sin estado.
- El precio de la luz sale de `src/lib/luz.ts`: una curva inventada, no la de Red Eléctrica.
- Las potencias, los plazos de revisión y el ahorro estimado son valores de ejemplo.
- Lo que se cambia (consignas, averías, plan, intervenciones) se guarda solo en el navegador.

## Arrancar

```
npm install
npm run dev      # http://127.0.0.1:3000
npm run check    # tipos, pruebas y compilación
```

## Marca

Logotipo «gradi°x» en Outfit seminegra; la o es un anillo azul (`src/components/marca.tsx`). Colores y letra en `src/app/globals.css` (variables `--gx-*`).
