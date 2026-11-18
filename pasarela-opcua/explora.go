package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/id"
	"github.com/gopcua/opcua/ua"
)

// Recorre lo que publica el PLC y lo deja en un archivo: sirve para saber el
// nombre exacto de cada variable y cuáles deja leer o escribir. Solo mira.

const maxExplorados = 30_000

type hallado struct {
	ruta, nodo string
	id         *ua.NodeID
}

func tipoDato(n *ua.NodeID) string {
	if n == nil {
		return ""
	}
	if n.Namespace() == 0 {
		nombres := map[uint32]string{1: "Bool", 2: "SByte", 3: "Byte", 4: "Int", 5: "UInt/Word", 6: "DInt", 7: "UDInt/DWord", 8: "LInt", 9: "ULInt", 10: "Real", 11: "LReal", 12: "String", 13: "DateTime"}
		if t, ok := nombres[n.IntID()]; ok {
			return t
		}
	}
	return n.String()
}

func (a *App) explorar(ctx context.Context) (string, int, error) {
	v := a.vigente()
	if v.Simulado {
		a.mu.Lock()
		v.PLC = a.plc.Direccion
		a.mu.Unlock()
		v.Usuario, v.Clave, v.Seguridad = "", "", "ninguna"
	}
	c, _, err := a.conectar(ctx, v)
	if err != nil {
		return "", 0, err
	}
	defer func() {
		cierre, cancelar := context.WithTimeout(context.Background(), 3*time.Second)
		_ = c.Close(cierre)
		cancelar()
	}()
	var variables []hallado
	vistos := map[string]bool{}
	type pendiente struct {
		id    *ua.NodeID
		ruta  string
		nivel int
	}
	cola := []pendiente{{ua.NewNumericNodeID(0, id.ObjectsFolder), "", 0}}
	for len(cola) > 0 && len(vistos) < maxExplorados {
		p := cola[0]
		cola = cola[1:]
		refs, err := hijos(ctx, c, p.id)
		if err != nil {
			if ctx.Err() != nil {
				return "", 0, errors.New("se ha tardado demasiado")
			}
			continue
		}
		for _, r := range refs {
			nid := r.NodeID.NodeID
			clave := nid.String()
			// Lo propio del estándar (diagnósticos del servidor y demás) no interesa.
			if vistos[clave] || (nid.Namespace() == 0 && p.nivel > 0) || (nid.Namespace() == 0 && nid.IntID() == id.Server) {
				continue
			}
			vistos[clave] = true
			nombre := r.BrowseName.Name
			ruta := nombre
			if p.ruta != "" {
				ruta = p.ruta + " / " + nombre
			}
			if r.NodeClass == ua.NodeClassVariable {
				variables = append(variables, hallado{ruta: ruta, nodo: clave, id: nid})
			}
			if p.nivel < 10 && (r.NodeClass == ua.NodeClassObject || r.NodeClass == ua.NodeClassVariable) {
				cola = append(cola, pendiente{nid, ruta, p.nivel + 1})
			}
		}
	}
	var sb strings.Builder
	sb.WriteString("\xef\xbb\xbfruta;nodo;tipo;se puede leer;se puede escribir\r\n")
	for ini := 0; ini < len(variables); ini += 50 {
		fin := min(ini+50, len(variables))
		pet := &ua.ReadRequest{TimestampsToReturn: ua.TimestampsToReturnNeither}
		for _, h := range variables[ini:fin] {
			pet.NodesToRead = append(pet.NodesToRead,
				&ua.ReadValueID{NodeID: h.id, AttributeID: ua.AttributeIDDataType},
				&ua.ReadValueID{NodeID: h.id, AttributeID: ua.AttributeIDUserAccessLevel})
		}
		ctxL, cancelar := context.WithTimeout(ctx, 12*time.Second)
		resp, err := c.Read(ctxL, pet)
		cancelar()
		for k, h := range variables[ini:fin] {
			tipo, leer, escribir := "", "", ""
			if err == nil && len(resp.Results) == 2*(fin-ini) {
				if d := resp.Results[2*k]; d.Status == ua.StatusOK && d.Value != nil {
					tipo = tipoDato(d.Value.NodeID())
				}
				if d := resp.Results[2*k+1]; d.Status == ua.StatusOK && d.Value != nil {
					nivel, _ := d.Value.Value().(uint8)
					leer, escribir = siNo(nivel&1 != 0), siNo(nivel&2 != 0)
				}
			}
			fmt.Fprintf(&sb, "%s;%s;%s;%s;%s\r\n", celdaCSV(h.ruta), celdaCSV(h.nodo), tipo, leer, escribir)
		}
	}
	archivo := a.ruta("exploracion-" + time.Now().Format("2006-01-02-150405") + ".csv")
	if err := os.WriteFile(archivo, []byte(sb.String()), 0o644); err != nil {
		return "", 0, err
	}
	a.registrar("Exploración del PLC: %d variables publicadas. Guardado en %s", len(variables), archivo)
	return archivo, len(variables), nil
}

// Una celda de CSV: si lleva punto y coma o comillas, va entre comillas, para que el nodo se pueda copiar tal cual.
func celdaCSV(s string) string {
	s = strings.NewReplacer("\n", " ", "\r", " ").Replace(s)
	if strings.ContainsAny(s, ";\"") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

func siNo(b bool) string {
	if b {
		return "sí"
	}
	return "no"
}

func hijos(ctx context.Context, c *opcua.Client, nodo *ua.NodeID) ([]*ua.ReferenceDescription, error) {
	ctxB, cancelar := context.WithTimeout(ctx, 12*time.Second)
	defer cancelar()
	pet := &ua.BrowseRequest{
		RequestedMaxReferencesPerNode: 1000,
		NodesToBrowse: []*ua.BrowseDescription{{
			NodeID:          nodo,
			BrowseDirection: ua.BrowseDirectionForward,
			ReferenceTypeID: ua.NewNumericNodeID(0, id.HierarchicalReferences),
			IncludeSubtypes: true,
			NodeClassMask:   uint32(ua.NodeClassObject | ua.NodeClassVariable),
			ResultMask:      uint32(ua.BrowseResultMaskAll),
		}},
	}
	resp, err := c.Browse(ctxB, pet)
	if err != nil {
		return nil, err
	}
	if len(resp.Results) == 0 {
		return nil, nil
	}
	out := resp.Results[0].References
	punto := resp.Results[0].ContinuationPoint
	for len(punto) > 0 {
		mas, err := c.BrowseNext(ctxB, &ua.BrowseNextRequest{ContinuationPoints: [][]byte{punto}})
		if err != nil || len(mas.Results) == 0 {
			break
		}
		out = append(out, mas.Results[0].References...)
		punto = mas.Results[0].ContinuationPoint
	}
	return out, nil
}
