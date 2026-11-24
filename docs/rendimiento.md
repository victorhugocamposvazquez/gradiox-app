# Rendimiento (COP) · fórmulas y reglas

Documento de referencia para programar la optimización por COP de Gradiox. Quien cambie una regla, una fórmula o un umbral lo cambia aquí **en el mismo PR**. La explicación para clientes y técnicos vive en la app (`/como-funciona/rendimiento`) y sale de `src/cop/indicadores.ts`. El porqué de cada decisión está en el plan: https://claude.ai/artifact/HSnhTUUwT4jQ1cLFf43GLT

Estado: diseño cerrado el 24 nov 2026. Nada de esto está probado aún con datos reales de una planta; los umbrales son valores de partida y se marcan así.

## 1. Las reglas que no se saltan

1. **El COP tiene tres niveles y manda el de la instalación.** Un ajuste se decide y se verifica con el COP de la instalación entera, no con el de un compresor.
2. **Cada equipo tiene su indicador.** Lo que produce frío tiene COP. Lo que no produce frío se mide en vatios por kW de frío (W/kW). Sumados dan 1000 / COP de la instalación.
3. **Cada número lleva su calidad: medido, calculado o estimado**, y su margen. Nunca se enseña un número sin ella.
4. **Lo que no se puede calcular no se inventa.** Se muestra «Faltan datos: X. Para verlo: Y. Da: Z, con esta precisión».
5. **El objetivo es el menor coste con el género seguro**, no el COP más alto.
6. **No se escribe en una planta real sin el visto bueno de Hugo.** Cada ajuste: se estima antes, se aplica con guardas y se verifica con días alternos.
7. **Las curvas de fabricante se guardan por instalación**, en la base de datos, nunca en este repositorio (es público).

## 2. Los tres niveles

| Nivel | Fórmula | Electricidad que entra | Para qué |
|---|---|---|---|
| Instalación (el que manda) | frío entregado a todos los servicios ÷ toda la electricidad del frío | compresores + ventiladores y bomba del condensador + bombas de glicol + ventiladores de evaporadores y climatizadoras + desescarches | objetivo del autoajuste, euros del cliente, línea base, CAE, comparar instalaciones |
| Compresor | frío del compresor ÷ su potencia eléctrica | solo su motor | averías, secuencia |
| Servicio | frío que pide ese servicio ÷ electricidad que le toca | su parte de sala de máquinas y condensador (repartida por el frío que pide) + sus ventiladores y desescarches | coste por cámara, puertas, desescarches, informe por servicio |

Precisión esperada: instalación ±3–8 % con analizadores y caudalímetro de glicol; compresor igual con su curva o su balance; servicio ±10–20 % (el reparto es un cálculo).

En cada nivel hay tres números:

- **Real**: lo que da ahora.
- **Esperado**: lo que daría el equipo sano a las presiones de ahora (curva del fabricante o su propia historia).
- **Alcanzable**: el esperado con las mejores consignas permitidas.

Real − esperado = pérdida por **estado del equipo**. Esperado − alcanzable = pérdida por **consignas**.

## 3. Indicador por equipo

| Equipo | Indicador | Unidad |
|---|---|---|
| Compresor | COP y desvío frente a su historia (D) | kW/kW, % |
| Sala de máquinas | COP de los compresores juntos | kW/kW |
| Condensador | potencia de ventiladores y bomba por kW de frío; aproximación al bulbo húmedo | W/kW, K |
| Bombas de glicol | potencia por kW de frío transportado; salto térmico | W/kW, K |
| Ventiladores de evaporadores y climatizadoras | potencia por kW de frío de su servicio | W/kW |
| Desescarches | energía al día por kW de frío; número al día | W/kW, n |
| Recuperación de calor | calor aprovechado ÷ electricidad de más | kW/kW |
| Servicio | COP atribuido; kWh al día (por m³ o por kg) | kW/kW, kWh |
| Túnel | kWh por tonelada congelada y por ciclo | kWh/t |

Identidad que se comprueba en pruebas: `Σ W/kW de todos los equipos = 1000 / COP_instalación` (ver `repartoPorKwFrio` en `src/cop/indicadores.ts`).

## 4. Base propia (sin fabricante) · por compresor y por minuto

Remuestreo con el último valor; un dato de más de 2 min se da por viejo. Propiedades del refrigerante: tablas precalculadas con CoolProp (licencia MIT); en producción no hace falta CoolProp.

| # | Salida | Fórmula |
|---|---|---|
| 1 | Presión absoluta | `P_abs = P_rel + P_atm`; `P_atm = 1,01325·(1 − 2,25577e-5·altitud)^5,25588` bar |
| 2 | Evaporación, condensación | `Te = Tsat(Ps_abs)`, `Tc = Tsat(Pd_abs)` |
| 3 | Recalentamiento de aspiración | `SHa = T_asp − Te` |
| 4 | Recalentamiento de descarga | `SHd = T_d − Tc` |
| 5 | Relación y salto de presión | `π = Pd_abs / Ps_abs`; `ΔP = Pd − Ps` |
| 6 | Potencia eléctrica | analizador; si no hay: `√3·V·I·cosφ` (cosφ 0,85 sin placa) etiquetada **estimada** (±7 % a plena carga, ±15 % bajo el 60 % de I_n, ±20 % con variador) |
| 7 | Estado de aspiración | `h1, s1, ρ1 = f(Ps_abs, T_asp)` |
| 8 | Trabajo isentrópico | `w_is = h(Pd_abs, s1) − h1` |
| 9 | Efecto frigorífico | `q = h1 − h_liq` (líquido saturado a Pd, o T de líquido medida) |
| 10 | COP de Carnot | `Te_K / (Tc_K − Te_K)` |
| 11 | COP de ciclo ideal | `q / w_is` |
| 12 | **Índice de consumo** | `IC = P_el / (ρ1 · w_is)` |
| 13 | Potencia esperada | `P_esp = IC_ref(casilla) · ρ1 · w_is` |
| 14 | **Desvío** | `D = P_el / P_esp − 1` |
| 15 | Frío estimado | `Q = η_tot · η_motor · P_el · q / w_is`, con η_motor 0,95 y η_tot 0,70 (banda 0,60–0,78) |
| 16 | COP estimado | `Q / P_el`, siempre como banda |
| 17 | Bulbo húmedo | fórmula de Stull con T y HR exterior |
| 18 | Aproximación del condensador | `Tc(P_cond) − T_bh` |

**En tornillos con inyección de aceite no se calcula el rendimiento isentrópico con la temperatura de descarga**: el aceite se lleva parte del calor y sale por encima del 100 %. Ahí se usa el índice de consumo. El rendimiento isentrópico solo se enseña con potencia medida y caudal de la curva o del balance.

**Relativa o absoluta.** Antes de enseñar ningún COP se comprueba: `Tsat(P_asp + P_atm)` debe coincidir a ±1 K con la temperatura de aspiración que ya calcula el autómata. Si no pasa, la pestaña no muestra COP.

**Régimen estable.** La muestra vale si en los 10 min anteriores: en marcha continua y 10 min desde el arranque; rango de Te y Tc ≤ 1 K; rango de carga ≤ 5 puntos (variador ≤ 2 Hz); rango de intensidad ≤ 5 %; ningún arranque o paro en la misma aspiración; SHa ≥ −1 K y SHd ≥ 5 K; ningún dato viejo. Se guarda una fila por ventana de 10 min con medianas.

**Casillas.** compresor × aspiración × π (pasos de 0,5 hasta 6, de 1 por encima) × carga (pasos de 10 puntos; variador, también Hz en pasos de 5). Referencia = mediana del IC de los primeros 30 días, con ≥ 30 muestras por casilla. Sin referencia: «sin historia», no se compara.

## 5. Avisos (valores de partida)

| Id | Aviso | Condición | Persistencia |
|---|---|---|---|
| A1 | Compresor gasta más que antes | D ≥ +8 % (grave ≥ +15 %) | 7 días |
| A2 | Posible arrastre de líquido | SHd < 20 K (crítico < 12 K) | 5 min / 2 min |
| A3 | Aspiración húmeda | SHa < 0 y T_d cae > 5 K en 10 min, o nivel alto del separador | 2 min |
| A4 | Descarga demasiado caliente | T_d > T_d,bloqueo − 5 K, o +10 K sobre su mediana en la casilla | 10 min |
| A5 | Filtro de aceite cargado | ΔP filtro > 1,0 bar (grave 1,5) | 30 min |
| A6 | Presión diferencial de aceite baja | P_dif < Pdif_ac + 0,3 bar, o −20 % sobre su mediana | 5 min |
| A7 | Aceite caliente | T_ac > Tac_ac − 3 K | 10 min |
| A8 | Condensador rinde menos | ventilador ≥ 45 Hz, bomba en marcha y aproximación +3 K sobre su referencia (grave +5 K) | 3 días |
| A9 | Probable aire en el circuito | A8 y purgador el doble de su mediana, o purgador parado 7 días con aspiración en vacío | 3 días |
| A9b | Aire confirmado | Tsat(P_cond) − T_líquido > 3 K (necesita PT100 de líquido) | 1 h |
| A10 | Arranques seguidos | ≥ 4 en 1 h (grave 6), o 3 marchas de < 10 min al día | — |
| A11 | Dos tornillos a media carga | ≥ 2 en la misma aspiración con carga < 70 % y Σ carga ≤ (n−1)·100 % | 30 min |
| A12 | Consigna cambiada a mano | distinta de la registrada y no cambiada por Gradiox; con su coste | 24 h |
| A13 | Condensación más alta de lo que permite el tiempo | Tc > max(T_bh + AP_ref, Tc_min) + 3 K con ventilador < 45 Hz | 2 h |
| A14 | Sonda dudosa | P_a difiere > 0,3 bar entre compresores de la misma aspiración, SHa < −2 K mantenido, o Tsat(P_b) < Tsat(P_cond) − 1 K | 1 h |
| A15 | Intensidad cerca del límite | I > I_bloq − 5 % | 10 min |

Con datos añadidos: A16 sonda exterior dudosa (previsión), A17 baja el nivel de amoniaco (recipiente), A18 amoniaco en el ambiente (repite el detector, no fija umbrales), A19 puerta abierta de más, A20–A21 vibración (ISO 20816-3), A22 aceite degradado (laboratorio), A23 da menos frío que su curva (−8 %), A24 glicol con poco salto.

Cada aviso se presenta con: qué pasa, la prueba (los datos) y qué revisar por orden.

## 6. Ajustes

Patrón común: **estimar** (potencia nueva con `IC_ref` en la casilla destino a igual frío; restar el extra de ventilador con la ley de afinidad) → **aplicar con guardas** (por las órdenes de doble llave) → **verificar** con días alternos 2 semanas sobre kWh medidos. Si el ahorro medido no supera el doble de su incertidumbre, no se da por bueno. Todo se decide con el COP de la instalación.

| Id | Ajuste | Ley | Guardas |
|---|---|---|---|
| J1 | Condensación flotante | `Tc_cons = clamp(T_bh + AP_obj, Tc_min, Tc_actual)`; AP_obj 10 K de partida; Tc_min 22 °C (20 °C tras 2 semanas sin A2/A4/A6); paso 0,5 K cada 15 min | SHd < 22 K; P_dif < Pdif_ac + 0,5 bar; ΔP < 5 bar; nivel alto; desescarche por gas caliente con P_cond < 8 bar; recuperación de calor demandando; ventilador a 50 Hz 30 min sin llegar: +1 K |
| J2 | Aspiración flotante | +0,5 K de saturación cada 30 min si todas las cámaras del nivel van sobradas; tope +4 K; en −40 solo propuesta | bajar nunca más rápido de 0,5 K cada 10 min; SHa ≥ 0; margen ≥ 1 K a la alarma de cada cámara; I < I_bloq − 10 %; vuelta inmediata −1 K si una cámara se calienta |
| J3 | Secuencia de compresores | como mucho uno regulando (el de variador), los demás al 100 % o parados; cambio solo si ahorra ≥ 5 % 20 min | solo propuesta mientras la secuencia no sea escribible; ≤ 3 arranques/h |
| J4 | Devolver consignas movidas | volver al valor registrado | sin riesgo nuevo |
| J5 | Desescarche por necesidad | iniciar por pérdida de rendimiento (+20 % de tiempo de marcha), terminar por sonda de fin | intervalo máximo el del reloj; un evaporador a la vez por cámara |
| J6 | Bombas de glicol por salto térmico | bajar 1 Hz cada 10 min hasta el salto de diseño (4 K de partida) | mínimo 30 Hz; válvulas < 90 %; vuelta si un servicio se sale |
| J7 | Recuperación de calor | priorizar aceite y gas caliente; no subir la condensación salvo que el calor valga más que el 2–3 %/K | T_ac en límites; SHd ≥ 20 K |
| J8 | Desplazar frío a horas baratas | `src/actua/optimiza.ts` con precios reales | las de `optimiza.ts` |
| J9 | Potencia contratada | proyectar el cuarto de hora; al 95 %: aplazar desescarches, subir 0,5–1 K cámaras con margen, impedir otro arranque | ninguna cámara a menos de 1 K de su alarma; 15 min máximo |
| J10 | Condensación óptima con auxiliares | minimizar compresores + ventilador + bomba | las de J1 |
| J11 | Presión intermedia | partida `√(Ps·Pd)` absolutas, afinar a 0,1 bar | límites del fabricante; SHd ≥ 20 K |

Ahorro de referencia comprobado con CoolProp en R717: bajar 1 K la condensación ahorra 2,6–3,7 % a −10 °C de aspiración y 1,8–2,3 % a −32/−40 °C. Subir 1 K la aspiración, 3,0–4,1 % y 2,3–2,8 %.

## 7. Calidad del dato

| Etiqueta | Cuándo |
|---|---|
| Medido | sale de una medida directa con su precisión (analizador, caudalímetro) |
| Calculado | sale de medidas más un modelo documentado (curva del fabricante, balance) |
| Estimado | depende de supuestos (potencia por intensidad, η supuesto, reparto) |

Escalera de datos (qué desbloquea qué): variables del autómata sin leer → ficha (placas, modelos, relativa/absoluta, altitud) → facturas y tarifa → previsión meteorológica → **analizadores de red** (la bisagra: sin kWh medidos no hay ahorro demostrable) → PT100 de líquido → curva del fabricante → caudalímetro de glicol → caudal del enfriador de aceite → niveles, detectores, puertas, fin de desescarche → vibración y análisis de aceite.

## 8. Ahorro verificado y CAE

- Línea base **antes** de activar ningún ajuste (12 meses ideal, 3 mínimo), IPMVP opción B: consumo = f(carga, T exterior húmeda), con CV(RMSE), NMBE e incertidumbre.
- Registro inalterable de cada cambio de consigna: quién, cuándo, antes, después, modo.
- CAE: vía actuación singular por un gestor (sujeto delegado), verificada por entidad ENAC; se cobra una vez. La ficha IND210 no cubre la condensación flotante por software. Sin confirmar que un ajuste de consignas cuente como inversión.
