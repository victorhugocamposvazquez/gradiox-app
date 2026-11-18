// Junta el programa de Mac para Apple Silicon y el de Intel en un solo archivo
// que vale para los dos (lo que en Mac se llama «universal»).
//
//	universal salida programa-arm64 programa-amd64
package main

import (
	"encoding/binary"
	"fmt"
	"os"
)

const alineacion = 14 // 2^14: lo que pide Apple Silicon

func main() {
	if len(os.Args) < 4 {
		fmt.Println("uso: universal salida programa…")
		os.Exit(2)
	}
	type trozo struct {
		datos        []byte
		cpu, subtipo uint32
		desde        uint32
	}
	var trozos []trozo
	pos := uint32(8 + 20*(len(os.Args)-2))
	for _, ruta := range os.Args[2:] {
		b, err := os.ReadFile(ruta)
		if err != nil || len(b) < 12 || binary.LittleEndian.Uint32(b) != 0xfeedfacf {
			fmt.Println("no es un programa de Mac de 64 bits:", ruta)
			os.Exit(1)
		}
		pos = (pos + 1<<alineacion - 1) &^ (1<<alineacion - 1)
		trozos = append(trozos, trozo{b, binary.LittleEndian.Uint32(b[4:]), binary.LittleEndian.Uint32(b[8:]), pos})
		pos += uint32(len(b))
	}
	salida := make([]byte, pos)
	binary.BigEndian.PutUint32(salida, 0xcafebabe)
	binary.BigEndian.PutUint32(salida[4:], uint32(len(trozos)))
	for i, t := range trozos {
		c := salida[8+20*i:]
		binary.BigEndian.PutUint32(c, t.cpu)
		binary.BigEndian.PutUint32(c[4:], t.subtipo)
		binary.BigEndian.PutUint32(c[8:], t.desde)
		binary.BigEndian.PutUint32(c[12:], uint32(len(t.datos)))
		binary.BigEndian.PutUint32(c[16:], alineacion)
		copy(salida[t.desde:], t.datos)
	}
	if err := os.WriteFile(os.Args[1], salida, 0o755); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
