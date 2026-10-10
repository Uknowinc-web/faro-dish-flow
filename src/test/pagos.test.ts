import { describe, expect, it } from "vitest";
import { resumenPago } from "@/lib/pagos";

describe("resumenPago", () => {
  it("pago exacto en efectivo es válido", () => {
    const r = resumenPago(200, 0, [{ metodo: "efectivo", monto: 200 }]);
    expect(r.valido).toBe(true);
    expect(r.falta).toBe(0);
    expect(r.cambio).toBe(0);
    expect(r.mixto).toBe(false);
  });

  it("pago mixto efectivo + clip cubre el total", () => {
    const r = resumenPago(200, 0, [
      { metodo: "efectivo", monto: 120 },
      { metodo: "clip", monto: 80 },
    ]);
    expect(r.valido).toBe(true);
    expect(r.mixto).toBe(true);
  });

  it("pago insuficiente no es válido y reporta lo que falta", () => {
    const r = resumenPago(200, 0, [{ metodo: "efectivo", monto: 150 }]);
    expect(r.valido).toBe(false);
    expect(r.falta).toBe(50);
  });

  it("la propina se suma al objetivo del cobro", () => {
    const r = resumenPago(200, 30, [{ metodo: "clip", monto: 230 }]);
    expect(r.objetivo).toBe(230);
    expect(r.valido).toBe(true);
  });

  it("pago sin propina suficiente solo para el total no es válido", () => {
    const r = resumenPago(200, 30, [{ metodo: "clip", monto: 200 }]);
    expect(r.valido).toBe(false);
    expect(r.falta).toBe(30);
  });

  it("el excedente en efectivo se reporta como cambio", () => {
    const r = resumenPago(180, 0, [{ metodo: "efectivo", monto: 200 }]);
    expect(r.valido).toBe(true);
    expect(r.cambio).toBe(20);
  });

  it("sin pagos registrados no es válido", () => {
    expect(resumenPago(100, 0, []).valido).toBe(false);
    expect(resumenPago(100, 0, [{ metodo: "efectivo", monto: 0 }]).valido).toBe(false);
  });
});

import { efectivoNeto as _en } from "@/lib/pagos";
describe("dinero en caja", () => {
  it("descuenta el cambio entregado", () => {
    expect(_en([{ id: "a", total: 170, propina: 0 }], [{ cuenta_id: "a", metodo: "efectivo", monto: 200 }])).toBe(170);
  });
  it("en pago mixto solo cuenta la parte en efectivo", () => {
    expect(_en([{ id: "a", total: 300, propina: 20 }], [{ cuenta_id: "a", metodo: "efectivo", monto: 120 }, { cuenta_id: "a", metodo: "clip", monto: 200 }])).toBe(120);
  });
});
