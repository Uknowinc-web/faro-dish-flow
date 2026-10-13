import { describe, expect, it } from "vitest";
import { pinIngresoValido, pinNuevoValido } from "@/lib/pin";

describe("PIN", () => {
  it("un PIN nuevo debe tener exactamente 6 dígitos", () => {
    expect(pinNuevoValido("123456")).toBe(true);
    expect(pinNuevoValido("1234")).toBe(false);
    expect(pinNuevoValido("12345")).toBe(false);
    expect(pinNuevoValido("1234567")).toBe(false);
    expect(pinNuevoValido("12a456")).toBe(false);
  });
  it("para entrar se aceptan 4 a 6 dígitos mientras haya PIN anteriores", () => {
    expect(pinIngresoValido("1234")).toBe(true);
    expect(pinIngresoValido("123456")).toBe(true);
    expect(pinIngresoValido("123")).toBe(false);
  });
});
