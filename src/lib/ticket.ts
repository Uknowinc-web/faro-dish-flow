import { horaMty } from "@/lib/catalogo";

export type LineaTicket = { cantidad: number; nombre: string; mods: string[]; notas: string | null };
export type DatosTicket = { numero: number; mesa: string; mesero: string | null; hora: string; lineas: LineaTicket[] };

export type ComandaTicket = {
  numero: number;
  created_at: string;
  mesero: string | null;
  mesa: string;
  items: { cantidad: number; nombre: string; modificadores: unknown; notas: string | null; estacion: string }[];
};

/** Convierte una comanda en datos de ticket. Cocina solo imprime comida: las bebidas se excluyen aquí. */
export function ticketDesdeComanda(c: ComandaTicket): DatosTicket {
  return {
    numero: c.numero,
    mesa: c.mesa,
    mesero: c.mesero,
    hora: horaMty(c.created_at),
    lineas: c.items
      .filter((i) => i.estacion === "cocina")
      .map((i) => ({
        cantidad: i.cantidad,
        nombre: i.nombre,
        mods: Array.isArray(i.modificadores) ? (i.modificadores as unknown[]).map(String) : [],
        notas: i.notas,
      })),
  };
}

/** Parte un texto en renglones de `ancho` caracteres. `primera` y `resto` son los prefijos de cada renglón. */
function envolver(texto: string, ancho: number, primera: string, resto: string = primera): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let actual = "";
  let prefijo = primera;
  for (const p of palabras) {
    const candidato = actual ? `${actual} ${p}` : p;
    if (candidato.length > ancho - prefijo.length && actual) {
      out.push(prefijo + actual);
      prefijo = resto;
      actual = p;
    } else {
      actual = candidato;
    }
  }
  if (actual || out.length === 0) out.push(prefijo + actual);
  return out;
}

/**
 * Ticket de comanda en texto plano, para impresora térmica (58 mm ≈ 32 caracteres, 80 mm ≈ 42).
 * Mismo formato que usará la impresión automática en el futuro.
 */
export function ticketTexto(d: DatosTicket, ancho = 42): string {
  const linea = "-".repeat(ancho);
  const centro = (t: string) => " ".repeat(Math.max(0, Math.floor((ancho - t.length) / 2))) + t;
  const out: string[] = [centro("TACOS EL FARO"), centro(`COMANDA #${d.numero}`), linea];
  out.push(...envolver(`Mesa: ${d.mesa}`, ancho, ""));
  if (d.mesero) out.push(...envolver(`Mesero: ${d.mesero}`, ancho, ""));
  out.push(`Hora: ${d.hora}`, linea);
  for (const l of d.lineas) {
    out.push(...envolver(`${l.cantidad} x ${l.nombre}`, ancho, "", "    "));
    if (l.mods.length) out.push(...envolver(l.mods.join(", "), ancho, "   ", "   "));
    if (l.notas) out.push(...envolver(l.notas, ancho, "  ! ", "    "));
  }
  out.push(linea);
  return out.join("\n") + "\n";
}
