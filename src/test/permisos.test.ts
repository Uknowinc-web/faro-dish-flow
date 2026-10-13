import { describe, expect, it } from "vitest";
import { bitacoraCsv, tienePermiso } from "@/lib/permisos";

const conf = [{ rol: "caja", permisos: ["estacion.caja", "caja.cobrar"] }];

describe("permisos por rol", () => {
  it("el administrador siempre tiene permiso", () => {
    expect(tienePermiso("admin", [], "admin.empleados")).toBe(true);
  });
  it("un rol solo tiene los permisos configurados", () => {
    expect(tienePermiso("caja", conf, "caja.cobrar")).toBe(true);
    expect(tienePermiso("caja", conf, "caja.anular")).toBe(false);
  });
  it("un rol sin configuración no tiene permisos", () => {
    expect(tienePermiso("mesero", conf, "estacion.mesero")).toBe(false);
  });
});

describe("exportar bitácora", () => {
  it("usa hora de Monterrey y escapa comas y comillas", () => {
    const csv = bitacoraCsv([{ created_at: "2026-10-13T06:30:00Z", empleado_nombre: "Ana", accion: "Cuenta cobrada", detalle: 'Mesa 3, "VIP"' }]);
    const linea = csv.split("\n")[1];
    expect(linea).toBe('2026-10-13,00:30:00,Ana,Cuenta cobrada,"Mesa 3, ""VIP"""');
  });
});
