package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math"
	"math/big"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/ua"
)

const espacioSiemens = "http://www.siemens.com/simatic-s7-opcua"
const uriAplicacion = "urn:gradiox:pasarela"

// Nombre de una variable tal como lo publica un S7-1500: cada tramo entre
// comillas. «Datos_C6_1_REAL.TT9» es "Datos_C6_1_REAL"."TT9"; «Tabla.v[3]» es "Tabla"."v"[3].
func claveSiemens(nombre string) string {
	tramos := strings.Split(nombre, ".")
	for i, t := range tramos {
		indice := ""
		if p := strings.Index(t, "["); p > 0 && strings.HasSuffix(t, "]") {
			t, indice = t[:p], t[p:]
		}
		tramos[i] = `"` + t + `"` + indice
	}
	return strings.Join(tramos, ".")
}

// Las variables que el panel del operador lee por dirección absoluta (sin punto
// en el nombre) no tienen nombre propio en el PLC: hay que darles el nodo a mano.
func sinNombreEnPLC(v Variable) bool {
	return v.Nodo == "" && !strings.Contains(v.Nombre, ".")
}

func nodoDe(v Variable, ns uint16) (*ua.NodeID, error) {
	if v.Nodo != "" {
		return ua.ParseNodeID(v.Nodo)
	}
	return ua.NewStringNodeID(ns, claveSiemens(v.Nombre)), nil
}

// Certificado propio de esta instalación, para cuando el PLC exige conexión cifrada.
func (a *App) certificado() ([]byte, *rsa.PrivateKey, error) {
	rc, rk := a.ruta("certificado", "gradiox-pasarela.pem"), a.ruta("certificado", "gradiox-pasarela.key")
	if par, err := tls.LoadX509KeyPair(rc, rk); err == nil {
		if k, ok := par.PrivateKey.(*rsa.PrivateKey); ok {
			return par.Certificate[0], k, nil
		}
	}
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}
	serie, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	equipo, _ := os.Hostname()
	uri, _ := url.Parse(uriAplicacion)
	plantilla := x509.Certificate{
		SerialNumber:          serie,
		Subject:               pkix.Name{CommonName: "Gradiox pasarela", Organization: []string{"Gradiox"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		KeyUsage:              x509.KeyUsageContentCommitment | x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageDataEncipherment | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		URIs:                  []*url.URL{uri},
		BasicConstraintsValid: true,
	}
	if equipo != "" {
		plantilla.DNSNames = []string{equipo}
	}
	der, err := x509.CreateCertificate(rand.Reader, &plantilla, &plantilla, &k.PublicKey, k)
	if err != nil {
		return nil, nil, err
	}
	_ = os.MkdirAll(a.ruta("certificado"), 0o700)
	_ = os.WriteFile(rc, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o644)
	_ = os.WriteFile(rk, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k)}), 0o600)
	_ = os.WriteFile(a.ruta("certificado", "gradiox-pasarela.der"), der, 0o644)
	return der, k, nil
}

func nombrePolitica(uri string) string {
	if i := strings.LastIndex(uri, "#"); i >= 0 {
		return uri[i+1:]
	}
	return uri
}

// Abre la sesión con el PLC eligiendo la forma de conexión que el PLC ofrece.
func (a *App) conectar(ctx context.Context, v Vigente) (*opcua.Client, string, error) {
	ctxE, cancelar := context.WithTimeout(ctx, 8*time.Second)
	defer cancelar()
	ofertas, err := opcua.GetEndpoints(ctxE, v.PLC, opcua.DialTimeout(6*time.Second))
	if err != nil {
		return nil, "", fmt.Errorf("no se llega al PLC en %s: %s", v.PLC, explicar(err))
	}
	quiere := ua.UserTokenTypeAnonymous
	if v.Usuario != "" {
		quiere = ua.UserTokenTypeUserName
	}
	admite := func(e *ua.EndpointDescription) bool {
		for _, t := range e.UserIdentityTokens {
			if t.TokenType == quiere {
				return true
			}
		}
		return false
	}
	// Políticas que este programa sabe hablar, de más a menos recomendable.
	orden := map[string]int{"Aes256_Sha256_RsaPss": 5, "Aes128_Sha256_RsaOaep": 4, "Basic256Sha256": 3, "Basic256": 2, "Basic128Rsa15": 1}
	var abierta, cifrada *ua.EndpointDescription
	for _, e := range ofertas {
		if !admite(e) {
			continue
		}
		if e.SecurityMode == ua.MessageSecurityModeNone {
			abierta = e
			continue
		}
		p := orden[nombrePolitica(e.SecurityPolicyURI)]
		if p == 0 {
			continue
		}
		if cifrada == nil || e.SecurityMode > cifrada.SecurityMode || (e.SecurityMode == cifrada.SecurityMode && p > orden[nombrePolitica(cifrada.SecurityPolicyURI)]) {
			cifrada = e
		}
	}
	var elegida *ua.EndpointDescription
	switch v.Seguridad {
	case "ninguna":
		elegida = abierta
	case "cifrada":
		elegida = cifrada
	default:
		// Con usuario y contraseña, mejor cifrada si el PLC la ofrece; sin ellos, la más sencilla.
		if v.Usuario != "" && cifrada != nil {
			elegida = cifrada
		} else if abierta != nil {
			elegida = abierta
		} else {
			elegida = cifrada
		}
	}
	if elegida == nil {
		if v.Usuario == "" {
			return nil, "", errors.New("el PLC no admite entrar sin usuario con esa seguridad. Ponga usuario y contraseña, o cambie la seguridad")
		}
		return nil, "", errors.New("el PLC no ofrece una conexión con esa seguridad para entrar con usuario")
	}
	opciones := []opcua.Option{
		opcua.ApplicationName("Gradiox pasarela"),
		opcua.ApplicationURI(uriAplicacion),
		opcua.ProductURI(uriAplicacion),
		opcua.SessionName("gradiox-pasarela"),
		opcua.DialTimeout(6 * time.Second),
		opcua.RequestTimeout(10 * time.Second),
		opcua.AutoReconnect(false),
		opcua.SecurityFromEndpoint(elegida, quiere),
	}
	if v.Usuario != "" {
		opciones = append(opciones, opcua.AuthUsername(v.Usuario, v.Clave))
	} else {
		opciones = append(opciones, opcua.AuthAnonymous())
	}
	como := "sin cifrar"
	// El certificado hace falta para cifrar el canal y también para mandar la contraseña protegida.
	if elegida.SecurityMode != ua.MessageSecurityModeNone || v.Usuario != "" {
		der, k, err := a.certificado()
		if err != nil {
			return nil, "", fmt.Errorf("no se ha podido crear el certificado: %v", err)
		}
		opciones = append(opciones, opcua.Certificate(der), opcua.PrivateKey(k))
	}
	if elegida.SecurityMode != ua.MessageSecurityModeNone {
		como = "cifrada (" + nombrePolitica(elegida.SecurityPolicyURI) + ")"
	}
	// Se entra por la dirección escrita, no por la que anuncia el PLC, que a veces es un nombre que este ordenador no conoce.
	c, err := opcua.NewClient(v.PLC, opciones...)
	if err != nil {
		return nil, "", err
	}
	ctxC, cancelarC := context.WithTimeout(ctx, 15*time.Second)
	defer cancelarC()
	if err := c.Connect(ctxC); err != nil {
		_ = c.Close(context.Background())
		return nil, "", errors.New(explicar(err))
	}
	return c, como, nil
}

// Pasa los errores más habituales a una frase que diga qué hacer.
func explicar(err error) string {
	t := err.Error()
	switch {
	case errors.Is(err, context.DeadlineExceeded), strings.Contains(t, "i/o timeout"), strings.Contains(t, "deadline"):
		return "no contesta: revise el cable, la dirección y que este ordenador esté en la misma red que el PLC"
	case strings.Contains(t, "connection refused"), strings.Contains(t, "actively refused"):
		return "hay equipo en esa dirección pero no acepta OPC UA: falta activar el servidor OPC UA en el PLC o el puerto no es ese"
	case strings.Contains(t, "no route to host"), strings.Contains(t, "network is unreachable"), strings.Contains(t, "unreachable"):
		return "este ordenador no tiene camino hasta esa dirección: revise la red y la dirección IP de este ordenador"
	case strings.Contains(t, "no such host"):
		return "esa dirección no existe"
	case strings.Contains(t, "BadSecurityChecksFailed"), strings.Contains(t, "BadCertificate"):
		return "el PLC no se fía todavía del certificado de este programa: hay que aceptarlo en el PLC (archivo en gradiox-datos/certificado)"
	case strings.Contains(t, "BadUserAccessDenied"), strings.Contains(t, "BadIdentityTokenRejected"), strings.Contains(t, "BadIdentityTokenInvalid"):
		return "el PLC rechaza el usuario o la contraseña"
	case strings.Contains(t, "BadTooManySessions"):
		return "el PLC no admite más sesiones OPC UA a la vez"
	case strings.Contains(t, "EOF"), strings.Contains(t, "reset by peer"), strings.Contains(t, "forcibly closed"), strings.Contains(t, "broken pipe"):
		return "se ha cortado la conexión"
	}
	return t
}

func calidad(s ua.StatusCode) string {
	switch s {
	case ua.StatusOK:
		return ""
	case ua.StatusBadNodeIDUnknown, ua.StatusBadNodeIDInvalid:
		return "No existe en el PLC con ese nombre"
	case ua.StatusBadNotReadable, ua.StatusBadUserAccessDenied:
		return "El PLC no deja leerla"
	case ua.StatusBadWaitingForInitialData, ua.StatusBadNoCommunication, ua.StatusBadCommunicationError:
		return "El PLC aún no tiene el dato"
	case ua.StatusBadDataTypeIDUnknown:
		// Una estructura (struct/UDT) entera: no se sabe deshacer; sí sus campos uno a uno.
		return "Es una estructura: lea sus campos sueltos"
	}
	if s&0x80000000 == 0 {
		return "" // bueno o dudoso: el valor sirve
	}
	return strings.TrimPrefix(s.Error(), "Status")
}

// Deja el valor en algo que se pueda enseñar y enviar: sí/no, número o texto.
func simple(v *ua.Variant) (any, string) {
	if v == nil {
		return nil, "Sin valor"
	}
	switch x := v.Value().(type) {
	case nil:
		return nil, "Sin valor"
	case bool:
		return x, ""
	case float32:
		if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) {
			return nil, "Valor no numérico"
		}
		f, _ := strconv.ParseFloat(strconv.FormatFloat(float64(x), 'g', -1, 32), 64)
		return f, ""
	case float64:
		if math.IsNaN(x) || math.IsInf(x, 0) {
			return nil, "Valor no numérico"
		}
		return x, ""
	case int8:
		return int64(x), ""
	case int16:
		return int64(x), ""
	case int32:
		return int64(x), ""
	case int64:
		return x, ""
	case uint8:
		return int64(x), ""
	case uint16:
		return int64(x), ""
	case uint32:
		return int64(x), ""
	case uint64:
		return float64(x), ""
	case string:
		if len(x) > 200 {
			x = x[:200]
		}
		return x, ""
	case time.Time:
		return x.UTC().Format(time.RFC3339), ""
	default:
		t := fmt.Sprint(x)
		if len(t) > 200 {
			t = t[:200]
		}
		return t, ""
	}
}

func (a *App) ponerPLC(f func(*EstadoPLC)) {
	a.mu.Lock()
	f(&a.plc)
	a.mu.Unlock()
}

// Ciclo principal: conecta, lee todas las variables cada cierto tiempo y, si se
// corta, vuelve a intentarlo. Un cambio de configuración lo reinicia.
func (a *App) cicloLectura(ctx context.Context) {
	espera := 2 * time.Second
	for ctx.Err() == nil {
		v := a.vigente()
		sesion, cancelar := context.WithCancel(ctx)
		go func() {
			select {
			case <-a.cambio:
				a.registrar("Ha cambiado la configuración: se vuelve a conectar.")
				cancelar()
			case <-sesion.Done():
			}
		}()
		inicio := time.Now()
		err := a.sesionLectura(sesion, v)
		cambiada := sesion.Err() != nil && ctx.Err() == nil
		cancelar()
		if ctx.Err() != nil {
			return
		}
		if cambiada {
			espera = 2 * time.Second
			continue
		}
		if err != nil {
			a.ponerPLC(func(e *EstadoPLC) { e.Estado, e.Detalle = "error", mayuscula(err.Error()) })
			a.registrar("PLC: %s. Se reintenta en %d s.", err, int(espera.Seconds()))
		}
		if time.Since(inicio) > time.Minute {
			espera = 2 * time.Second
		}
		select {
		case <-ctx.Done():
			return
		case <-a.cambio:
			espera = 2 * time.Second
		case <-time.After(espera):
			if espera < 30*time.Second {
				espera *= 2
			}
		}
	}
}

func mayuscula(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

func (a *App) sesionLectura(ctx context.Context, v Vigente) error {
	if v.Simulado {
		dir, err := a.arrancarSimulador(a.paraSimular(v.Variables))
		if err != nil {
			return fmt.Errorf("no se ha podido arrancar el PLC simulado: %v", err)
		}
		v.PLC, v.Usuario, v.Clave, v.Seguridad = dir, "", "", "ninguna"
	} else {
		a.pararSimulador()
	}
	a.ponerPLC(func(e *EstadoPLC) {
		*e = EstadoPLC{Estado: "conectando", Direccion: v.PLC, Total: len(v.Variables), Ultima: e.Ultima}
	})
	if len(v.Variables) == 0 {
		a.ponerPLC(func(e *EstadoPLC) {
			e.Estado, e.Detalle = "error", "No hay lista de variables: falta variables.csv junto al programa o el token de Gradiox"
		})
		<-ctx.Done()
		return nil
	}
	c, como, err := a.conectar(ctx, v)
	if err != nil {
		return err
	}
	defer func() {
		cierre, cancelar := context.WithTimeout(context.Background(), 3*time.Second)
		_ = c.Close(cierre)
		cancelar()
	}()

	// En qué espacio de nombres están las variables del PLC.
	var ns uint16 = 3
	if lista, err := c.NamespaceArray(ctx); err == nil {
		encontrado := false
		for i, n := range lista {
			if n == espacioSiemens {
				ns, encontrado = uint16(i), true
			}
		}
		if !encontrado {
			a.registrar("El servidor no anuncia el espacio de nombres de Siemens; se prueba con ns=3. Espacios: %s", strings.Join(lista, " | "))
		}
	}
	nodos := make([]*ua.NodeID, len(v.Variables))
	for i, x := range v.Variables {
		n, err := nodoDe(x, ns)
		if err == nil {
			nodos[i] = n
		}
	}
	if v.Simulado {
		como = "PLC simulado en este ordenador"
	}
	a.ponerPLC(func(e *EstadoPLC) { e.Estado, e.Seguridad, e.Detalle = "conectado", como, "" })
	a.registrar("Conectado a %s, conexión %s. %d variables en la lista.", v.PLC, como, len(v.Variables))

	primera := true
	for {
		leidas, err := a.leerTodas(ctx, c, v.Variables, nodos)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return errors.New(explicar(err))
		}
		if primera {
			a.registrar("Primera lectura: %d de %d variables con valor.", leidas, len(v.Variables))
			primera = false
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(time.Duration(v.CadaSegundos) * time.Second):
		}
	}
}

// Los PLC limitan cuántas variables se piden de una vez.
const porPeticion = 100

func (a *App) leerTodas(ctx context.Context, c *opcua.Client, vars []Variable, nodos []*ua.NodeID) (int, error) {
	ahora := time.Now().UnixMilli()
	nuevos := make([]Valor, len(vars))
	for i := range nuevos {
		nuevos[i] = Valor{T: ahora, C: "Nodo mal escrito"}
		if sinNombreEnPLC(vars[i]) {
			nuevos[i].C = "Falta su nombre en el PLC (el panel del operador la lee por dirección)"
		}
	}
	var pedir []int
	for i, n := range nodos {
		if n != nil && !sinNombreEnPLC(vars[i]) {
			pedir = append(pedir, i)
		}
	}
	for ini := 0; ini < len(pedir); ini += porPeticion {
		fin := min(ini+porPeticion, len(pedir))
		pet := &ua.ReadRequest{MaxAge: 0, TimestampsToReturn: ua.TimestampsToReturnNeither}
		for _, i := range pedir[ini:fin] {
			pet.NodesToRead = append(pet.NodesToRead, &ua.ReadValueID{NodeID: nodos[i], AttributeID: ua.AttributeIDValue})
		}
		ctxL, cancelar := context.WithTimeout(ctx, 12*time.Second)
		resp, err := c.Read(ctxL, pet)
		cancelar()
		if err != nil {
			return 0, err
		}
		if len(resp.Results) != fin-ini {
			return 0, fmt.Errorf("el PLC ha devuelto %d valores de %d pedidos", len(resp.Results), fin-ini)
		}
		for k, r := range resp.Results {
			i := pedir[ini+k]
			if q := calidad(r.Status); q != "" {
				nuevos[i].C = q
				continue
			}
			nuevos[i].X, nuevos[i].C = simple(r.Value)
		}
	}
	leidas := 0
	for _, n := range nuevos {
		if n.C == "" {
			leidas++
		}
	}
	a.anotar(vars, nuevos, ahora, leidas)
	return leidas, nil
}
