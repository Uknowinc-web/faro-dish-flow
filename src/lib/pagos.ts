export type MetodoPago = "efectivo" | "clip";

export interface PagoParcial {
  metodo: MetodoPago;
  monto: number;
}

export interface ResumenPago {
  suma: number;
  objetivo: number;
  falta: number;
  cambio: number;
  valido: boolean;
  mixto: boolean;
}

/** Valida un cobro: los pagos deben cubrir total + propina. El excedente es cambio. */
export function resumenPago(total: number, propina: number, pagos: PagoParcial[]): ResumenPago {
  const limpios = pagos.filter((p) => p.monto > 0);
  const suma = limpios.reduce((s, p) => s + p.monto, 0);
  const objetivo = total + Math.max(propina, 0);
  const falta = Math.max(objetivo - suma, 0);
  return {
    suma,
    objetivo,
    falta,
    cambio: Math.max(suma - objetivo, 0),
    valido: limpios.length > 0 && suma >= objetivo,
    mixto: new Set(limpios.map((p) => p.metodo)).size > 1,
  };
}
