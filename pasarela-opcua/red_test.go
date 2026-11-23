package main

import (
	"net"
	"reflect"
	"strings"
	"testing"

	"github.com/gopcua/opcua/ua"
)

func TestPistaRed(t *testing.T) {
	_, wifi, _ := net.ParseCIDR("192.168.1.34/24")
	if p := pistaRed("opc.tcp://70.70.70.1:4840", []*net.IPNet{wifi}); !strings.Contains(p, "70.70.70.200") || !strings.Contains(p, "70.70.70.x") {
		t.Fatalf("sin la IP que hay que poner: %q", p)
	}
	_, cable, _ := net.ParseCIDR("70.70.70.5/24")
	if p := pistaRed("opc.tcp://70.70.70.1:4840", []*net.IPNet{wifi, cable}); p != "" {
		t.Fatalf("en la misma red no hay pista: %q", p)
	}
	if p := pistaRed("opc.tcp://plc.local:4840", nil); p != "" {
		t.Fatalf("con un nombre no hay pista: %q", p)
	}
	if p := pistaRed("10.0.0.200", nil); !strings.Contains(p, "10.0.0.201") {
		t.Fatalf("no evita la del PLC: %q", p)
	}
}

func TestDesplegarListas(t *testing.T) {
	cadena := `"RECIBIR"."RECIBIR REAL"`
	id := ua.NewStringNodeID(3, cadena)
	h := Hallada{Ruta: "RECIBIR / RECIBIR REAL", Nodo: id.String(), Tipo: "Real", Leer: true, cadena: cadena, id: id, elementos: reflect.ValueOf([]float32{1.5, 2})}
	out := desplegarListas([]Hallada{h, {Ruta: "Otra", Nodo: "ns=3;s=x"}})
	if len(out) != 4 {
		t.Fatalf("esperaba lista + 2 elementos + otra, hay %d", len(out))
	}
	if out[0].Bloqueo == "" {
		t.Fatal("la lista entera debe quedar sin poder marcarse")
	}
	if out[1].cadena != `"RECIBIR"."RECIBIR REAL"[0]` || out[1].X != 1.5 || out[1].Bloqueo != "" {
		t.Fatalf("elemento mal: %+v", out[1])
	}
	if n := nombreDeClave(out[2].cadena); n != "RECIBIR.RECIBIR REAL[1]" {
		t.Fatalf("nombre del elemento: %q", n)
	}
}
