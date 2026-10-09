import { describe, it, expect } from "vitest";
import { PRODUCTOS, precioUnitario } from "@/lib/catalogo";

const p = (id: string) => PRODUCTOS.find((x) => x.id === id)!;

describe("precios", () => {
  it("taco maíz con queso cuesta 45", () => {
    expect(precioUnitario(p("taco-maiz"), [{ grupo: "queso", nombre: "Con queso", extra: 5 }])).toBe(45);
  });
  it("taco harina con tripa extra +10 cuesta 52", () => {
    expect(precioUnitario(p("taco-harina"), [{ grupo: "carne", nombre: "Tripa", extra: 10 }])).toBe(52);
  });
  it("gaonera en costra cuesta 90", () => {
    expect(precioUnitario(p("gaonera"), [{ grupo: "tortilla", nombre: "Costra", extra: 15 }])).toBe(90);
  });
  it("bebidas van a barra", () => {
    expect(p("topo-chico").estacion).toBe("barra");
    expect(p("toni-col").precio).toBe(55);
  });
});
