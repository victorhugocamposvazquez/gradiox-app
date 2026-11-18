// Herramienta de publicación: crea la clave de firma y firma cada programa
// compilado. La clave privada no está en el repositorio ni viaja con el programa.
//
//	firmar clave <archivo>                         crea una clave nueva y enseña la pública
//	firmar publica <archivo>                       enseña la clave pública
//	firmar firma <archivo> <plataforma> <versión> <binario>   enseña sha256, tamaño y firma en JSON
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func salir(formato string, args ...any) {
	fmt.Fprintf(os.Stderr, formato+"\n", args...)
	os.Exit(1)
}

func leerClave(archivo string) ed25519.PrivateKey {
	b, err := os.ReadFile(archivo)
	if err != nil {
		salir("No se puede leer la clave: %v", err)
	}
	semilla, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
	if err != nil || len(semilla) != ed25519.SeedSize {
		salir("El archivo no contiene una clave de firma válida")
	}
	return ed25519.NewKeyFromSeed(semilla)
}

func publica(k ed25519.PrivateKey) string {
	return base64.StdEncoding.EncodeToString(k.Public().(ed25519.PublicKey))
}

func main() {
	a := os.Args[1:]
	switch {
	case len(a) == 2 && a[0] == "clave":
		if _, err := os.Stat(a[1]); err == nil {
			salir("Ya existe %s: no se pisa una clave", a[1])
		}
		semilla := make([]byte, ed25519.SeedSize)
		if _, err := rand.Read(semilla); err != nil {
			salir("%v", err)
		}
		if err := os.WriteFile(a[1], []byte(base64.StdEncoding.EncodeToString(semilla)+"\n"), 0o600); err != nil {
			salir("%v", err)
		}
		fmt.Println(publica(ed25519.NewKeyFromSeed(semilla)))
	case len(a) == 2 && a[0] == "publica":
		fmt.Println(publica(leerClave(a[1])))
	case len(a) == 5 && a[0] == "firma":
		k := leerClave(a[1])
		b, err := os.ReadFile(a[4])
		if err != nil {
			salir("%v", err)
		}
		h := sha256.Sum256(b)
		sha := hex.EncodeToString(h[:])
		// El mismo texto que comprueba el programa: plataforma, versión y huella.
		texto := []byte("gradiox-pasarela\n" + a[2] + "\n" + a[3] + "\n" + sha + "\n")
		out, _ := json.Marshal(map[string]any{"version": a[3], "tamano": len(b), "sha256": sha, "firma": base64.StdEncoding.EncodeToString(ed25519.Sign(k, texto))})
		fmt.Println(string(out))
	default:
		salir("Uso: firmar clave|publica <archivo> · firmar firma <archivo> <plataforma> <versión> <binario>")
	}
}
