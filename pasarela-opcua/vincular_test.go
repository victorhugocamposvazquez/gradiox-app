package main

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestCodigoDeConexion(t *testing.T) {
	a := &App{cfg: Config{Nube: "https://gradiox.com"}}
	for _, c := range []string{"", "12345", "1234567", "12a456"} {
		if _, err := a.vincular(context.Background(), c); err == nil || !strings.Contains(err.Error(), "6 cifras") {
			t.Fatalf("%q debería rechazarse por forma, no por la red: %v", c, err)
		}
	}
}

func TestEscrituraDePruebaPideLasDosAutorizaciones(t *testing.T) {
	a := &App{cfg: Config{Ordenes: true}}
	if _, err := a.escribirPrueba(context.Background(), "C1.Consigna", 2.5, 0); err == nil || !strings.Contains(err.Error(), "plataforma") {
		t.Fatalf("sin autorización de la plataforma no se escribe: %v", err)
	}
	a = &App{remota: &Remota{Escritura: Escritura{Activa: true}}}
	if _, err := a.escribirPrueba(context.Background(), "C1.Consigna", 2.5, 0); err == nil || !strings.Contains(err.Error(), "este equipo") {
		t.Fatalf("sin autorización en el equipo no se escribe: %v", err)
	}
}

func TestValorParaRetorno(t *testing.T) {
	casos := []struct {
		x  any
		ok bool
	}{{float32(2.5), true}, {int16(-3), true}, {true, true}, {"texto", false}, {nil, false}}
	for _, c := range casos {
		if _, ok := comoValorOrden(c.x); ok != c.ok {
			t.Fatalf("%v: esperaba %v", c.x, c.ok)
		}
	}
}

func TestVolverAlValorOriginalSoloSaltaLosLimites(t *testing.T) {
	min, max := -5.0, 10.0
	lista := []Escribible{{Nombre: "C1.Consigna", Min: &min, Max: &max}}
	vigentes := []Variable{{Nombre: "C1.Consigna"}}
	ahora := time.Now()
	o := ordenRecibida{Nombre: "C1.Consigna", Valor: 50.0, Pedida: ahora.UnixMilli()}
	if _, m := comprobarOrden(o, lista, vigentes, ahora); m != "Fuera de los límites" {
		t.Fatalf("una orden normal fuera de límites se rechaza: %q", m)
	}
	o.restaura = true
	if _, m := comprobarOrden(o, lista, vigentes, ahora); m != "" {
		t.Fatalf("volver al valor que tenía el autómata vale aunque esté fuera: %q", m)
	}
	o.Valor = true
	if _, m := comprobarOrden(o, lista, vigentes, ahora); m == "" {
		t.Fatal("aunque sea para volver, el tipo tiene que ser el de la variable")
	}
	o = ordenRecibida{Nombre: "Otra.Variable", Valor: 1.0, restaura: true}
	if _, m := comprobarOrden(o, lista, vigentes, ahora); m == "" {
		t.Fatal("aunque sea para volver, solo se tocan variables de la lista cerrada")
	}
}

func TestRestaurarSinPruebaPrevia(t *testing.T) {
	a := &App{cfg: Config{Ordenes: true}, remota: &Remota{Escritura: Escritura{Activa: true}}}
	if _, err := a.restaurarPrueba(context.Background(), "C1.Consigna"); err == nil {
		t.Fatal("sin escritura de prueba no hay nada que restaurar")
	}
}

func TestDemostracionSinListaTieneVariables(t *testing.T) {
	a := &App{}
	vars := a.paraSimular(nil)
	if len(vars) == 0 {
		t.Fatal("el modo demostración de una instalación nueva necesita variables de ejemplo")
	}
	for _, v := range vars {
		if sinNombreEnPLC(v) {
			t.Fatalf("%s no se publicaría en el simulador", v.Nombre)
		}
	}
}

func TestDemostracionLeeUnaListaDePlantaPorNombre(t *testing.T) {
	a := &App{locales: []Variable{{Nombre: "ENVIAR.ENVIAR BOOL[0]", Nodo: `ns=3;s="ENVIAR"."ENVIAR BOOL"[0]`}}}
	vars := a.paraSimular(nil)
	if len(vars) != 1 {
		t.Fatalf("se esperaba la variable de la lista, no %d", len(vars))
	}
	for _, v := range vars {
		if v.Nodo != "" {
			t.Fatalf("%s: en el simulado no existen los nodos del autómata real", v.Nombre)
		}
	}
}

func TestLaMismaVariablePorBloqueOPorInterfaz(t *testing.T) {
	lista := []Escribible{{Nombre: "ENVIAR.ENVIAR BOOL[0]", SiNo: true}}
	vigentes := []Variable{{Nombre: "ServerInterfaces.Interfaz del servidor_1.ENVIAR.ENVIAR BOOL[0]"}}
	o := ordenRecibida{Nombre: "ServerInterfaces.Interfaz del servidor_1.ENVIAR.ENVIAR BOOL[0]", Valor: true}
	if _, m := comprobarOrden(o, lista, vigentes, time.Now()); m != "" {
		t.Fatalf("es la misma variable: %q", m)
	}
	o.Nombre = "ServerInterfaces.Otra.ENVIAR.OTRA"
	if _, m := comprobarOrden(o, lista, vigentes, time.Now()); m == "" {
		t.Fatal("otra variable no vale")
	}
}

func TestLoQueSePuedeEscribirSeLeeSiempre(t *testing.T) {
	a := &App{remota: &Remota{
		Variables: []Variable{{Nombre: "ServerInterfaces.Interfaz del servidor_1.ENVIAR.ENVIAR REAL"}},
		Escritura: Escritura{Activa: true, Variables: []Escribible{{Nombre: "ENVIAR.ENVIAR REAL"}, {Nombre: "ENVIAR.ENVIAR BOOL[0]", SiNo: true}}},
	}}
	v := a.aLeer()
	if len(v.Variables) != 2 || v.Variables[1].Nombre != "ENVIAR.ENVIAR BOOL[0]" {
		t.Fatalf("se esperaba la lista más la escribible que faltaba: %+v", v.Variables)
	}
	if len(a.remota.Variables) != 1 {
		t.Fatal("no se toca la lista del panel")
	}
}

// Lo que Hugo vio el 24 nov: escribía, pero al volver a arrancar el simulador (cada vez
// que llegaba la configuración) el valor volvía al de antes. Y sin tipo en la lista, la
// variable de sí o no se simulaba como número y no se podía escribir.
func TestLoEscritoEnElSimuladoSeQueda(t *testing.T) {
	a := &App{datos: t.TempDir(), base: t.TempDir(), cfg: Config{Simulado: true, Ordenes: true}, remota: &Remota{
		Variables: []Variable{{Nombre: "ENVIAR.ENVIAR BOOL[0]"}, {Nombre: "ServerInterfaces.Interfaz del servidor_1.ENVIAR.ENVIAR REAL"}},
		Escritura: Escritura{Activa: true, Variables: []Escribible{{Nombre: "ENVIAR.ENVIAR BOOL[0]", SiNo: true}}},
	}}
	arrancar := func() {
		dir, err := a.arrancarSimulador(a.paraSimular(a.aLeer().Variables))
		if err != nil {
			t.Fatal(err)
		}
		a.plc.Direccion = dir
	}
	arrancar()
	defer a.pararSimulador()
	ctx := context.Background()
	r, err := a.escribirPrueba(ctx, "ENVIAR.ENVIAR BOOL[0]", true, 0)
	if err != nil || r.Estado != "hecha" {
		t.Fatalf("no se escribe: %+v %v", r, err)
	}
	time.Sleep(1200 * time.Millisecond) // el simulador mueve los valores cada segundo
	arrancar()
	r, err = a.escribirPrueba(ctx, "ENVIAR.ENVIAR BOOL[0]", false, 0)
	if err != nil || r.Estado != "hecha" || r.Antes != true {
		t.Fatalf("lo escrito se ha perdido: %+v %v", r, err)
	}
}

func TestLaPosicionConYSinPunto(t *testing.T) {
	if !mismaVariable("ENVIAR.ENVIAR BOOL[0]", "ServerInterfaces.Interfaz del servidor_1.ENVIAR.ENVIAR BOOL.[0]") {
		t.Fatal("BOOL[0] y BOOL.[0] son la misma variable")
	}
	if mismaVariable("ENVIAR.ENVIAR BOOL[0]", "ENVIAR.ENVIAR BOOL.[1]") {
		t.Fatal("otra posición no es la misma")
	}
}
