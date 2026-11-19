package main

import (
	"math"
	"regexp"
	"strings"
	"time"
)

// Las cámaras del PLC simulado se comportan como cámaras: el aire se calienta
// por las paredes y por el género, el frío arranca al llegar a la consigna del
// tramo de tarifa en el que se está y para al bajar el diferencial. Así, si
// Gradiox cambia una consigna por una orden, la temperatura y las horas de
// marcha cambian de verdad y se puede medir el resultado.

const (
	simExterior    = 25.0  // °C fuera de la cámara
	simPerdida     = 0.067 // parte de la diferencia con el exterior que gana el aire cada hora
	simGenero      = 1.5   // lo que el género tira del aire, por hora y grado
	simHorasGenero = 6.0   // horas que tarda el género en seguir al aire
	simDiferencial = 1.5   // °C entre arrancar y parar
	simFrio        = 3.0   // veces que el frío puede con la pérdida a la consigna de partida
)

var tipoEnNombre = regexp.MustCompile(`(?i)_(REAL|BOOL|INT|WORD)$`)

// «Datos_C6_1_REAL.TT9» y «Datos_C6_1_BOOL.Refrigeracion» son de la cámara «Datos_C6_1».
func camaraDe(nombre string) (clave, campo string) {
	i := strings.LastIndex(nombre, ".")
	if i < 0 {
		return "", ""
	}
	return tipoEnNombre.ReplaceAllString(nombre[:i], ""), strings.ToLower(nombre[i+1:])
}

type camaraSim struct {
	base      float64 // consigna de partida
	frio      float64 // °C por hora que baja el aire con el frío en marcha
	aire      float64
	genero    float64
	enfriando bool
	campos    map[string]string // campo en minúsculas → clave del nodo
}

// Tramo de la tarifa a una hora del día: valle de noche y en fin de semana, punta a media mañana y a última hora de la tarde.
func tramoSim(t time.Time) string {
	if d := t.Weekday(); d == time.Saturday || d == time.Sunday {
		return "valle"
	}
	switch h := t.Hour(); {
	case h < 8:
		return "valle"
	case (h >= 10 && h < 14) || (h >= 18 && h < 22):
		return "punta"
	}
	return "llana"
}

// De la lista publicada, las cámaras que tienen temperatura y sus tres consignas por tarifa.
func camarasSim(vars []Variable) map[string]*camaraSim {
	todas := map[string]*camaraSim{}
	for _, v := range vars {
		clave, campo := camaraDe(v.Nombre)
		if clave == "" {
			continue
		}
		c := todas[clave]
		if c == nil {
			c = &camaraSim{campos: map[string]string{}}
			todas[clave] = c
		}
		c.campos[campo] = claveSiemens(v.Nombre)
	}
	for clave, c := range todas {
		completa := true
		for _, f := range []string{"tt9", "hora_punta_ac", "hora_llana_ac", "hora_valle_ac"} {
			if c.campos[f] == "" {
				completa = false
			}
		}
		if !completa {
			delete(todas, clave)
			continue
		}
		s := semilla(clave)
		c.base = -20 // congelado
		if s > 0.6 {
			c.base = 2 // fresco
		}
		c.frio = simFrio * simPerdida * (simExterior - c.base)
		c.aire = c.base - simDiferencial*s
		c.genero = c.base - simDiferencial/2
	}
	return todas
}

// Los nodos que lleva la cámara y no el generador de valores inventados.
func (c *camaraSim) lleva(k string) bool {
	for _, f := range []string{"tt9", "hora_punta_ac", "hora_llana_ac", "hora_valle_ac", "refrigeracion", "demanda", "marcha", "paro", "averia", "p_consigna_ac", "p_consigna_de", "t_muy_alta_ac", "t_muy_baja_ac"} {
		if c.campos[f] == k {
			return true
		}
	}
	return false
}

// Valores con los que arranca el PLC: las tres consignas iguales, como en una cámara que nadie ha ajustado a la tarifa.
func (c *camaraSim) iniciar(datos map[string]any) {
	for _, f := range []string{"hora_punta_ac", "hora_llana_ac", "hora_valle_ac"} {
		datos[c.campos[f]] = float32(c.base)
	}
	poner := func(f string, x any) {
		if k := c.campos[f]; k != "" {
			datos[k] = x
		}
	}
	poner("t_muy_alta_ac", float32(c.base+5))
	poner("t_muy_baja_ac", float32(c.base-8))
	poner("marcha", true)
	poner("paro", false)
	poner("averia", false)
	c.publicar(datos, c.base)
}

func (c *camaraSim) publicar(datos map[string]any, consigna float64) {
	poner := func(f string, x any) {
		if k := c.campos[f]; k != "" {
			datos[k] = x
		}
	}
	datos[c.campos["tt9"]] = float32(math.Round(c.aire*100) / 100)
	poner("refrigeracion", c.enfriando)
	poner("demanda", c.enfriando)
	poner("p_consigna_ac", float32(consigna))
	poner("p_consigna_de", float32(consigna-simDiferencial))
}

// Avanza la cámara `horas` y deja sus valores en el PLC. Las consignas se leen del propio PLC: valen las que se hayan escrito.
func (c *camaraSim) avanzar(datos map[string]any, ahora time.Time, horas float64) {
	consigna := c.base
	if x, ok := datos[c.campos["hora_"+tramoSim(ahora)+"_ac"]].(float32); ok {
		consigna = float64(x)
	}
	// Pasos de un minuto como mucho, por si el ordenador ha estado dormido.
	for queda := math.Min(horas, 12); queda > 0; {
		h := math.Min(queda, 1.0/60)
		queda -= h
		if c.aire >= consigna {
			c.enfriando = true
		} else if c.aire <= consigna-simDiferencial {
			c.enfriando = false
		}
		delta := simPerdida*(simExterior-c.aire) + simGenero*(c.genero-c.aire)
		if c.enfriando {
			delta -= c.frio
		}
		c.genero += (c.aire - c.genero) / simHorasGenero * h
		c.aire += delta * h
	}
	c.publicar(datos, consigna)
}
