export type Permiso = { key: string; label: string };
export type GrupoPermisos = { nombre: string; permisos: Permiso[] };

export const GRUPOS_PERMISOS: GrupoPermisos[] = [
  { nombre: "Estaciones", permisos: [
    { key: "estacion.mesero", label: "Entrar a Mesero" },
    { key: "estacion.cocina", label: "Entrar a Cocina" },
    { key: "estacion.caja", label: "Entrar a Caja" },
    { key: "estacion.admin", label: "Entrar a Administración" },
  ] },
  { nombre: "Caja", permisos: [
    { key: "caja.cobrar", label: "Cobrar cuentas" },
    { key: "caja.por_cobrar", label: "Marcar por cobrar" },
    { key: "caja.anular", label: "Anular cuentas" },
    { key: "caja.agregar_mesa", label: "Agregar mesas" },
    { key: "caja.corte", label: "Ver corte de caja" },
  ] },
  { nombre: "Administración", permisos: [
    { key: "admin.resumen", label: "Ver resumen y ventas" },
    { key: "admin.fondo", label: "Capturar fondo de caja" },
    { key: "admin.cuentas", label: "Cancelar productos y reabrir cuentas" },
    { key: "admin.productos", label: "Cambiar precios y agotados" },
    { key: "admin.mesas", label: "Editar mesas" },
    { key: "admin.empleados", label: "Editar empleados" },
    { key: "admin.turnos", label: "Ver turnos" },
    { key: "admin.bitacora", label: "Ver y exportar bitácora" },
  ] },
];

export const ROLES_CONFIGURABLES = ["mesero", "cocina", "caja"] as const;

/** Admin always has every permission; other roles only what is configured for them. */
export function tienePermiso(rol: string, configurados: { rol: string; permisos: string[] }[], key: string): boolean {
  if (rol === "admin") return true;
  return configurados.find((c) => c.rol === rol)?.permisos.includes(key) ?? false;
}

export type FilaBitacora = { created_at: string; empleado_nombre: string | null; accion: string; detalle: string | null };

const celda = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV with Monterrey local date/time; BOM so Excel reads accents correctly. */
export function bitacoraCsv(filas: FilaBitacora[]): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const lineas = filas.map((b) => {
    const [fecha, hora] = f.format(new Date(b.created_at)).split(", ");
    return [fecha ?? "", hora ?? "", b.empleado_nombre ?? "", b.accion, b.detalle ?? ""].map(celda).join(",");
  });
  return "\uFEFF" + ["Fecha,Hora,Empleado,Acción,Detalle", ...lineas].join("\n");
}
