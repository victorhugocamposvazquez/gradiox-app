import { ErrorClientes, cuerpoJson } from "@/clientes/rutas";
import { esId } from "@/clientes/modelo";
import { CODIGO_MS, aplicarCambios, cambiarLista, dias, huellaCodigo, huellaToken, nuevaRevision, nuevoCodigo, nuevoToken, pistaToken } from "@/pasarelas/modelo";
import { inexistentes, pasosPuesta } from "@/pasarelas/puesta";
import { conPasarelas } from "@/pasarelas/rutas";
import { escribiblesDeTexto, escrituraVacia, nuevaOrden, validarValor } from "@/pasarelas/ordenes";
import { nuevaPrueba, pararPrueba, recortar } from "@/pasarelas/pruebas";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Contexto) {
  const { id } = await params;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa pasarela no existe", 404);
    const ahora = Date.now();
    // Lo que nadie recogió a tiempo se enseña ya como caducado.
    await a.caducarOrdenes(id, ahora);
    const lecturas = await a.ultimas(id);
    const ordenes = await a.ordenes(id, { limite: 30 });
    const { codigo: _c, ...sinCodigo } = p;
    return { ahora, pasarela: sinCodigo, lecturas, ordenes, pasos: pasosPuesta(p, lecturas, ordenes, ahora), inexistentes: inexistentes(p, lecturas).length };
  });
}

export async function POST(peticion: Request, { params }: Contexto) {
  const { id } = await params;
  const b = ((await cuerpoJson(peticion)) ?? {}) as Record<string, unknown>;
  return conPasarelas(async (a) => {
    const p = esId(id) ? await a.leer(id) : null;
    if (!p) throw new ErrorClientes("Esa pasarela no existe", 404);
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const ahora = Date.now();
    switch (b.accion) {
      case "guardar": {
        const d = aplicarCambios(datos, b, ahora);
        if ("error" in d) throw new ErrorClientes(d.error);
        return { pasarela: await a.guardar(id, d) };
      }
      case "aceptar-propuesta": {
        // La lista que el programa propone pasa a ser la de la instalación.
        if (!datos.propuesta) throw new ErrorClientes("Ya no hay ninguna lista propuesta");
        const pr = datos.propuesta;
        return { pasarela: await a.guardar(id, cambiarLista(datos, pr.variables, pr.origen === "elegidas" ? "Elegidas en la planta" : datos.perfil, "Aceptada la lista que proponía el programa", ahora)) };
      }
      case "lista-anterior": {
        // Deshacer el último cambio de lista hecho sin el panel: se intercambian, y se puede volver otra vez.
        const ant = datos.anterior;
        if (!ant) throw new ErrorClientes("No hay una lista anterior a la que volver");
        return { pasarela: await a.guardar(id, cambiarLista(datos, ant.variables, ant.perfil, "Vuelta a la lista anterior desde el panel", ahora)) };
      }
      case "quitar-inexistentes": {
        // Fuera de la lista las variables que el PLC dice no tener (p. ej. una lista de prueba o de otra instalación).
        const fuera = new Set(inexistentes(datos, await a.ultimas(id)));
        if (!fuera.size) throw new ErrorClientes("El PLC tiene todas las variables de la lista");
        const quedan = datos.variables.filter((v) => !fuera.has(v.n));
        return { pasarela: await a.guardar(id, cambiarLista(datos, quedan, datos.perfil, `Quitadas ${fuera.size} variables que no existen en el PLC`, ahora)), quitadas: fuera.size };
      }
      case "descartar-propuesta":
        return { pasarela: await a.guardar(id, { ...datos, propuesta: undefined, revision: nuevaRevision() }) };
      case "escritura": {
        // Activar o apagar las órdenes y fijar qué variables se pueden cambiar y entre qué límites.
        const e = datos.escritura ?? escrituraVacia();
        const nueva = { ...e };
        if (typeof b.texto === "string") {
          const r = escribiblesDeTexto(b.texto);
          if ("error" in r) throw new ErrorClientes(r.error);
          const leibles = new Set(datos.variables.map((v) => v.n));
          // Una que ya estaba y ha salido de la lista de lectura no impide guardar: el panel la señala para quitarla.
          const previas = new Set((datos.escritura?.variables ?? []).map((v) => v.n));
          const fuera = r.variables.filter((v) => !leibles.has(v.n) && !previas.has(v.n)).map((v) => v.n);
          if (fuera.length) throw new ErrorClientes(`No están en la lista de lectura: ${fuera.slice(0, 5).join(", ")}`);
          nueva.variables = r.variables;
        }
        if (typeof b.activa === "boolean") {
          if (b.activa && !nueva.variables.length) throw new ErrorClientes("Primero di qué variables se pueden cambiar");
          nueva.activa = b.activa;
          // Al apagarlas, lo que estuviera esperando no se ejecuta.
          if (!b.activa) for (const o of await a.ordenesAbiertas(id)) await a.cambiarOrden(id, o.id, { estado: "anulada", motivo: "Órdenes apagadas", cambio: ahora }, ["pendiente"]);
        }
        return { pasarela: await a.guardar(id, { ...datos, escritura: nueva, revision: nuevaRevision() }) };
      }
      case "ordenar": {
        const e = datos.escritura;
        if (!e?.activa) throw new ErrorClientes("Las órdenes no están activadas en esta instalación");
        const n = typeof b.n === "string" ? b.n : "";
        const v = validarValor(e.variables.find((x) => x.n === n), b.valor);
        if ("error" in v) throw new ErrorClientes(v.error);
        await a.caducarOrdenes(id, ahora);
        if ((await a.ordenesAbiertas(id)).some((o) => o.n === n)) throw new ErrorClientes("Ya hay una orden en curso para esa variable");
        const ultima = (await a.ultimas(id)).find((l) => l.v === n);
        const orden = nuevaOrden(n, v.valor, ultima ? ultima.x : undefined, ahora, "Panel interno");
        await a.ponerOrden(id, orden);
        return { pasarela: p, orden };
      }
      case "programar-prueba": {
        // Un valor a una hora, durante unos minutos, y vuelta sola al valor de ahora.
        const ultima = (await a.ultimas(id)).find((l) => l.v === b.n);
        // Una lectura de hace más de 15 minutos no vale para saber a qué valor volver.
        const reciente = ultima && ahora - ultima.t < 15 * 60_000 ? ultima.x : undefined;
        const pr = nuevaPrueba(datos.escritura, datos.pruebas ?? [], b, reciente, ahora, "Panel interno");
        if ("error" in pr) throw new ErrorClientes(pr.error);
        return { pasarela: await a.guardar(id, { ...datos, pruebas: recortar([pr, ...(datos.pruebas ?? [])]) }), prueba: pr };
      }
      case "parar-prueba": {
        const r = pararPrueba(datos.pruebas ?? [], typeof b.prueba === "string" ? b.prueba : "", ahora);
        if ("error" in r) throw new ErrorClientes(r.error);
        return { pasarela: await a.guardar(id, { ...datos, pruebas: r }) };
      }
      case "anular-orden": {
        const hecha = typeof b.orden === "string" ? await a.cambiarOrden(id, b.orden, { estado: "anulada", motivo: "Anulada desde el panel", cambio: ahora }, ["pendiente"]) : null;
        if (!hecha) throw new ErrorClientes((await a.ordenesAbiertas(id)).some((o) => o.id === b.orden) ? "Ya la ha recogido el programa: no se puede anular" : "Esa orden ya ha terminado o no existe");
        return { pasarela: p };
      }
      case "anular":
        return { pasarela: await a.guardar(id, { ...datos, anulada: true }) };
      case "renovar": {
        // Token nuevo: el anterior deja de valer en el acto.
        const token = nuevoToken();
        const d = { ...datos, anulada: false, caduca: ahora + dias(b.dias) * 86_400_000, pista: pistaToken(token), revision: nuevaRevision() };
        return { pasarela: await a.guardar(id, d, huellaToken(token)), token };
      }
      case "codigo": {
        // Código de un solo uso para vincular la pasarela en planta sin copiar el token. Se enseña solo ahora.
        const codigo = nuevoCodigo();
        await a.guardar(id, { ...datos, codigo: { huella: huellaCodigo(codigo), caduca: ahora + CODIGO_MS, fallos: 0 } });
        return { pasarela: p, codigo, caduca: ahora + CODIGO_MS };
      }
      case "borrar":
        await a.borrar(id);
        return { borrada: true };
      default:
        throw new ErrorClientes("No se entiende la orden");
    }
  });
}
