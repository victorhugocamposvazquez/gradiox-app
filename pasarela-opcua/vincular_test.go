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
