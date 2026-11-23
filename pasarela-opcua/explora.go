package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/id"
	"github.com/gopcua/opcua/ua"
)

// Recorre lo que publica el PLC y lo deja en un archivo: sirve para saber el
// nombre exacto de cada variable y cuáles deja leer o escribir. Solo mira.

const maxExplorados = 30_000

// Una variable de las que el PLC publica.
type Hallada struct {
	Ruta     string `json:"ruta"`
	Nodo     string `json:"nodo"`
	Nombre   string `json:"n"` // como se llamará en la lista
	Tipo     string `json:"tipo,omitempty"`
	Leer     bool   `json:"leer"`
	Escribir bool   `json:"escribir"`
	X        any    `json:"x"` // valor en el momento de buscar
	// El nodo se deduce del nombre (así la lista vale aunque cambie el orden de los espacios de nombres).
	Deducible bool `json:"deducible,omitempty"`
	// Por qué no se puede marcar (una estructura o una lista entera): se leen sus partes.
	Bloqueo string `json:"bloqueo,omitempty"`
	cadena  string
	id      *ua.NodeID
	// Los valores, si es una lista (array): se enseña cada elemento por separado.
	elementos reflect.Value
}

// Como mucho se despliegan tantos elementos de cada lista.
const maxElementos = 64

// Una lista de valores (array del PLC), salvo un texto o unos bytes.
func esLista(x any) bool {
	if x == nil {
		return false
	}
	v := reflect.ValueOf(x)
	return v.Kind() == reflect.Slice && v.Type().Elem().Kind() != reflect.Uint8
}

// Pone, detrás de cada lista, una fila por elemento con su nombre entre
// corchetes («Tabla.v[0]»), que es como lo lee el PLC. La lista entera no se
// puede marcar: el valor sería «[0 0]» y no sirve.
func desplegarListas(variables []Hallada) []Hallada {
	out := make([]Hallada, 0, len(variables))
	for _, h := range variables {
		if !h.elementos.IsValid() {
			out = append(out, h)
			continue
		}
		n := h.elementos.Len()
		tipo := h.Tipo
		h.Tipo = fmt.Sprintf("Lista de %d", n)
		h.Bloqueo = "Es una lista de valores: marque cada elemento, que sale debajo"
		if h.cadena == "" {
			// Sin nombre de texto no se sabe pedir un elemento suelto.
			h.Bloqueo = "Es una lista de valores y este PLC no deja pedir sus elementos por nombre"
		}
		vals := h.elementos
		h.elementos = reflect.Value{}
		out = append(out, h)
		if h.cadena == "" {
			continue
		}
		for i := 0; i < n && i < maxElementos; i++ {
			cadena := fmt.Sprintf("%s[%d]", h.cadena, i)
			id := ua.NewStringNodeID(h.id.Namespace(), cadena)
			e := Hallada{Ruta: fmt.Sprintf("%s[%d]", h.Ruta, i), Nodo: id.String(), Tipo: tipo, Leer: h.Leer, Escribir: h.Escribir, cadena: cadena, id: id}
			e.X, _ = simpleValor(vals.Index(i).Interface())
			out = append(out, e)
		}
	}
	return out
}

// Resultado de la última búsqueda.
type Exploracion struct {
	Cuando    int64     `json:"cuando"`
	PLC       string    `json:"plc"`
	Simulado  bool      `json:"simulado"`
	Archivo   string    `json:"archivo"`
	Variables []Hallada `json:"variables"`
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

// Lo contrario de claveSiemens: "Datos"."TT9" es «Datos.TT9». Vacío si no tiene esa forma.
func nombreDeClave(clave string) string {
	if !strings.HasPrefix(clave, `"`) {
		return ""
	}
	n := strings.NewReplacer(`"."`, ".", `"`, "").Replace(clave)
	if claveSiemens(n) != clave {
		return ""
	}
	return n
}

func (a *App) explorar(ctx context.Context) (*Exploracion, error) {
	v := a.vigente()
	if v.Simulado {
		a.mu.Lock()
		v.PLC = a.plc.Direccion
		a.mu.Unlock()
		if !strings.HasPrefix(v.PLC, "opc.tcp://127.0.0.1:") {
			return nil, errors.New("el PLC simulado todavía está arrancando; pruebe en unos segundos")
		}
		v.Usuario, v.Clave, v.Seguridad = "", "", "ninguna"
	}
	c, _, err := a.conectar(ctx, v)
	if err != nil {
		return nil, err
	}
	defer func() {
		cierre, cancelar := context.WithTimeout(context.Background(), 3*time.Second)
		_ = c.Close(cierre)
		cancelar()
	}()
	nsSiemens, espacios := -1, 0
	if lista, err := c.NamespaceArray(ctx); err == nil {
		espacios = len(lista)
		for i, n := range lista {
			if n == espacioSiemens {
				nsSiemens = i
			}
		}
	}
	var variables []Hallada
	vistos := map[string]bool{}
	type pendiente struct {
		id    *ua.NodeID
		ruta  string
		nivel int
	}
	cola := []pendiente{{ua.NewNumericNodeID(0, id.ObjectsFolder), "", 0}}
	if v.Simulado {
		// El PLC simulado cuelga sus variables de una carpeta por cada espacio de nombres.
		for i := 1; i < espacios; i++ {
			cola = append(cola, pendiente{ua.NewNumericNodeID(uint16(i), id.ObjectsFolder), "", 0})
		}
	}
	for len(cola) > 0 && len(vistos) < maxExplorados {
		p := cola[0]
		cola = cola[1:]
		refs, err := hijos(ctx, c, p.id)
		if err != nil {
			if ctx.Err() != nil {
				return nil, errors.New("se ha tardado demasiado")
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
				h := Hallada{Ruta: ruta, Nodo: clave, id: nid}
				if nid.Type() == ua.NodeIDTypeString {
					h.cadena = nid.StringID()
				}
				variables = append(variables, h)
			}
			if p.nivel < 10 && (r.NodeClass == ua.NodeClassObject || r.NodeClass == ua.NodeClassVariable) {
				cola = append(cola, pendiente{nid, ruta, p.nivel + 1})
			}
		}
	}
	for ini := 0; ini < len(variables); ini += 30 {
		fin := min(ini+30, len(variables))
		pet := &ua.ReadRequest{TimestampsToReturn: ua.TimestampsToReturnNeither}
		for _, h := range variables[ini:fin] {
			pet.NodesToRead = append(pet.NodesToRead,
				&ua.ReadValueID{NodeID: h.id, AttributeID: ua.AttributeIDDataType},
				&ua.ReadValueID{NodeID: h.id, AttributeID: ua.AttributeIDUserAccessLevel},
				&ua.ReadValueID{NodeID: h.id, AttributeID: ua.AttributeIDValue})
		}
		ctxL, cancelar := context.WithTimeout(ctx, 12*time.Second)
		resp, err := c.Read(ctxL, pet)
		cancelar()
		if err != nil || len(resp.Results) != 3*(fin-ini) {
			continue
		}
		for k := range variables[ini:fin] {
			h := &variables[ini+k]
			if d := resp.Results[3*k]; d.Status == ua.StatusOK && d.Value != nil {
				h.Tipo = tipoDato(d.Value.NodeID())
			}
			if d := resp.Results[3*k+1]; d.Status == ua.StatusOK && d.Value != nil {
				nivel, _ := d.Value.Value().(uint8)
				h.Leer, h.Escribir = nivel&1 != 0, nivel&2 != 0
			}
			if d := resp.Results[3*k+2]; d.Status == ua.StatusBadDataTypeIDUnknown {
				h.Tipo = "Estructura"
				h.Bloqueo = "Es una estructura: marque sus campos, que salen debajo"
			} else if calidad(d.Status) == "" && d.Value != nil && esLista(d.Value.Value()) {
				h.elementos = reflect.ValueOf(d.Value.Value())
				h.Leer = true
			} else if calidad(d.Status) == "" {
				h.X, _ = simple(d.Value)
				// Si el servidor no dice el tipo ni el permiso, se deduce de que el valor ha llegado.
				h.Leer = true
				if h.Tipo == "" {
					switch h.X.(type) {
					case bool:
						h.Tipo = "Bool"
					case float64:
						h.Tipo = "Real"
					case int64:
						h.Tipo = "Int"
					case string:
						h.Tipo = "String"
					}
				}
			}
		}
	}
	variables = desplegarListas(variables)
	// Nombre con el que cada una entrará en la lista, sin repetir.
	usados := map[string]bool{}
	for i := range variables {
		h := &variables[i]
		if n := nombreDeClave(h.cadena); n != "" {
			h.Nombre, h.Deducible = n, int(h.id.Namespace()) == nsSiemens
		} else if h.cadena != "" {
			h.Nombre = h.cadena
		} else {
			h.Nombre = strings.ReplaceAll(h.Ruta, " / ", ".")
		}
		h.Nombre = strings.NewReplacer(";", ",", "\n", " ", "\r", " ").Replace(h.Nombre)
		if len(h.Nombre) > 180 {
			h.Nombre = h.Nombre[:180]
		}
		for base, k := h.Nombre, 2; usados[h.Nombre]; k++ {
			h.Nombre = fmt.Sprintf("%s (%d)", base, k)
		}
		usados[h.Nombre] = true
	}
	var sb strings.Builder
	sb.WriteString("\xef\xbb\xbfruta;nodo;tipo;se puede leer;se puede escribir\r\n")
	for _, h := range variables {
		leer, escribir := "", ""
		if h.Tipo != "" {
			leer, escribir = siNo(h.Leer), siNo(h.Escribir)
		}
		fmt.Fprintf(&sb, "%s;%s;%s;%s;%s\r\n", celdaCSV(h.Ruta), celdaCSV(h.Nodo), h.Tipo, leer, escribir)
	}
	e := &Exploracion{Cuando: time.Now().UnixMilli(), PLC: v.PLC, Simulado: v.Simulado, Variables: variables}
	e.Archivo = a.ruta("exploracion-" + time.Now().Format("2006-01-02-150405") + ".csv")
	if err := os.WriteFile(e.Archivo, []byte(sb.String()), 0o644); err != nil {
		return nil, err
	}
	if b, err := json.Marshal(e); err == nil {
		_ = escribirEntero(a.ruta("exploracion.json"), b, 0o644)
	}
	a.mu.Lock()
	a.explorado = e
	a.mu.Unlock()
	a.registrar("Búsqueda en el PLC: %d variables publicadas. Guardado en %s", len(variables), e.Archivo)
	return e, nil
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
