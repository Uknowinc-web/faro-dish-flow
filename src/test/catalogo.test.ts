import { describe, it, expect } from "vitest";
import { PRODUCTOS, precioUnitario, modsMixta } from "@/lib/catalogo";

const p = (id: string) => PRODUCTOS.find((x) => x.id === id)!;
const mixta = (id: string, principal: "Asada" | "Pastor" | "Tripa", extras: ("Asada" | "Pastor" | "Tripa")[] = [], queso = false) =>
  precioUnitario(p(id), modsMixta(p(id), principal, extras, queso));

describe("tacos", () => {
  it("taco maíz base $40", () => expect(mixta("taco-maiz", "Asada")).toBe(40));
  it("taco maíz con queso $45", () => expect(mixta("taco-maiz", "Pastor", [], true)).toBe(45));
  it("taco maíz tripa + 2 extras + queso $70", () => expect(mixta("taco-maiz", "Tripa", ["Asada", "Pastor"], true)).toBe(70));
  it("taco harina base $42", () => expect(mixta("taco-harina", "Asada")).toBe(42));
  it("taco harina con queso $47", () => expect(mixta("taco-harina", "Asada", [], true)).toBe(47));
  it("taco harina tripa + 2 extras + queso $72", () => expect(mixta("taco-harina", "Tripa", ["Asada", "Pastor"], true)).toBe(72));
  it("tripa agregada como extra cuesta solo $10", () => expect(mixta("taco-maiz", "Asada", ["Tripa"])).toBe(50));
});

describe("platillos mixtos", () => {
  it.each([
    ["quesadilla-maiz", 65], ["quesadilla-harina", 95], ["vampiro", 75], ["chorreada", 80],
    ["costra", 100], ["papa-especial", 180], ["torta", 130], ["charros-especiales", 75],
  ])("%s con tripa principal suma $10", (id, base) => {
    expect(mixta(id, "Asada")).toBe(base);
    expect(mixta(id, "Tripa")).toBe(base + 10);
    expect(mixta(id, "Pastor", ["Asada"])).toBe(base + 10);
  });
  it("queso no se cobra fuera de tacos", () => expect(mixta("vampiro", "Asada", [], true)).toBe(75));
});

describe("gaonera", () => {
  it("no es mixeable", () => expect(p("gaonera").mixta).toBeUndefined());
  it("base $75 y con costra $90", () => {
    expect(precioUnitario(p("gaonera"), [{ grupo: "tortilla", nombre: "Harina", extra: 0 }])).toBe(75);
    const costra = p("gaonera").grupos!.find((g) => g.id === "costra")!.opciones[0]!;
    expect(precioUnitario(p("gaonera"), [{ grupo: "costra", nombre: costra.nombre, extra: costra.extra }])).toBe(90);
  });
});

describe("productos fijos", () => {
  it.each([
    ["chilaca", 80, "cocina"], ["hamburguesa", 125, "cocina"], ["papa-sencilla", 130, "cocina"],
    ["charros-sencillos", 55, "cocina"], ["quesagloria", 100, "cocina"], ["agua-natural", 15, "barra"],
    ["agua-sabor", 45, "barra"], ["horchata", 50, "barra"], ["topo-chico", 35, "barra"], ["toni-col", 55, "barra"],
  ])("%s cuesta $%i sin variantes", (id, precio, estacion) => {
    expect(p(id).precio).toBe(precio);
    expect(p(id).estacion).toBe(estacion);
    expect(p(id).mixta).toBeUndefined();
    expect(p(id).grupos).toBeUndefined();
  });
});
