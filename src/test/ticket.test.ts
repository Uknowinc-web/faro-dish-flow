import { describe, expect, it } from "vitest";
import { ticketDesdeComanda, ticketTexto } from "@/lib/ticket";

const base = { numero: 12, created_at: "2026-10-13T18:05:00Z", mesero: "Ana", mesa: "Mesa 3" };

describe("ticket de cocina", () => {
  it("incluye solo comida, nunca bebidas", () => {
    const d = ticketDesdeComanda({
      ...base,
      items: [
        { cantidad: 2, nombre: "Taco maíz", modificadores: ["Asada"], notas: "Sin lechuga", estacion: "cocina" },
        { cantidad: 1, nombre: "Topo Chico", modificadores: [], notas: null, estacion: "bebida" },
      ],
    });
    expect(d.lineas.map((l) => l.nombre)).toEqual(["Taco maíz"]);
    const t = ticketTexto(d, 32);
    expect(t).toContain("COMANDA #12");
    expect(t).toContain("Mesa: Mesa 3");
    expect(t).toContain("2 x Taco maíz");
    expect(t).toContain("Asada");
    expect(t).toContain("Sin lechuga");
    expect(t).not.toContain("Topo");
  });

  it("ningún renglón supera el ancho de la impresora", () => {
    const d = ticketDesdeComanda({
      ...base,
      items: [{
        cantidad: 1,
        nombre: "Gaonera con costra de queso y tortilla de harina",
        modificadores: ["Harina", "Costra de queso", "Con todo y mucha salsa de la casa"],
        notas: "Bien cocida, sin frijoles y sin cebolla por favor",
        estacion: "cocina",
      }],
    });
    ticketTexto(d, 32).split("\n").forEach((l) => expect(l.length).toBeLessThanOrEqual(32));
  });
});
