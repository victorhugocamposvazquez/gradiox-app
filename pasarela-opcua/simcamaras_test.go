package main

import (
	"testing"
	"time"
)

func camaraDePrueba() (*camaraSim, map[string]any) {
	vars := []Variable{}
	for _, n := range []string{"Datos_C6_1_REAL.TT9", "Datos_C6_1_REAL.Hora_punta_ac", "Datos_C6_1_REAL.Hora_llana_ac", "Datos_C6_1_REAL.Hora_valle_ac", "Datos_C6_1_BOOL.Refrigeracion", "Datos_C6_1_REAL.P_consigna_ac", "Datos_C6_1_REAL.P_consigna_de", "Otra_REAL.TT9"} {
		vars = append(vars, Variable{Nombre: n, Tipo: "Real", Unidad: "°C"})
	}
	cs := camarasSim(vars)
	c := cs["Datos_C6_1"]
	datos := map[string]any{}
	if c != nil {
		c.iniciar(datos)
	}
	return c, datos
}

// Un día entero, paso a paso de diez segundos. Devuelve las horas de marcha en punta y la temperatura más alta.
func diaSimulado(c *camaraSim, datos map[string]any) (punta, maxima float64) {
	t := time.Date(2026, 11, 18, 0, 0, 0, 0, time.Local) // miércoles
	maxima = -100
	for i := 0; i < 2*24*360; i++ {
		c.avanzar(datos, t, 10.0/3600)
		if i >= 24*360 { // el segundo día, ya asentada
			if c.enfriando && tramoSim(t) == "punta" {
				punta += 10.0 / 3600
			}
			if c.aire > maxima {
				maxima = c.aire
			}
		}
		t = t.Add(10 * time.Second)
	}
	return
}

func TestCamaraSimulada(t *testing.T) {
	c, datos := camaraDePrueba()
	if c == nil {
		t.Fatal("no se ha detectado la cámara")
	}
	if len(camarasSim([]Variable{{Nombre: "Otra_REAL.TT9"}})) != 0 {
		t.Fatal("una cámara sin consignas por tarifa no se simula")
	}
	puntaAntes, maxAntes := diaSimulado(c, datos)
	if maxAntes > c.base+0.3 || maxAntes < c.base-1 {
		t.Fatalf("con las consignas de partida la temperatura debe rondar la consigna: máxima %.2f, consigna %.1f", maxAntes, c.base)
	}
	if puntaAntes < 1 || puntaAntes > 6 {
		t.Fatalf("horas de marcha en punta fuera de lo razonable: %.2f", puntaAntes)
	}
	// Más frío de noche y más margen en punta: menos marcha en las horas caras.
	c2, datos2 := camaraDePrueba()
	datos2[c2.campos["hora_valle_ac"]] = float32(c2.base - 2)
	datos2[c2.campos["hora_punta_ac"]] = float32(c2.base + 2)
	puntaDespues, maxDespues := diaSimulado(c2, datos2)
	if puntaDespues >= puntaAntes*0.9 {
		t.Fatalf("con las consignas por tarifa debe marchar menos en punta: antes %.2f h, después %.2f h", puntaAntes, puntaDespues)
	}
	if maxDespues > c2.base+2.3 {
		t.Fatalf("la temperatura no debe pasar de la consigna de punta: %.2f", maxDespues)
	}
	if x := datos2[c2.campos["p_consigna_de"]].(float32); x > datos2[c2.campos["p_consigna_ac"]].(float32) {
		t.Fatal("el frío para por debajo de donde arranca")
	}
	t.Logf("punta: %.2f h → %.2f h; máxima %.2f → %.2f", puntaAntes, puntaDespues, maxAntes, maxDespues)
}
