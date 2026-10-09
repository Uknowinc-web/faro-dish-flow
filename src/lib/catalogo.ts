export type Estacion = "cocina" | "barra";
export type Opcion = { id: string; nombre: string; extra: number };
export type GrupoOpciones = { id: string; nombre: string; tipo: "uno" | "varios"; opciones: Opcion[]; requerido?: boolean };
export type Producto = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  estacion: Estacion;
  grupos?: GrupoOpciones[];
  /** Mixeable meats: tripa surcharge as main meat, and whether cheese is offered. */
  mixta?: { tripaExtra: number; queso: boolean };
};
export type ModSeleccionado = { grupo: string; nombre: string; extra: number };

export const CARNES = ["Asada", "Pastor", "Tripa"] as const;
export type Carne = (typeof CARNES)[number];
export const EXTRA_CARNE = 10;
export const EXTRA_QUESO = 5;
export const EXTRA_COSTRA = 15;

const gaoneraGrupos: GrupoOpciones[] = [
  { id: "tortilla", nombre: "Tortilla", tipo: "uno", requerido: true, opciones: [
    { id: "maiz", nombre: "Maíz", extra: 0 },
    { id: "harina", nombre: "Harina", extra: 0 },
  ] },
  { id: "costra", nombre: "Extras", tipo: "varios", opciones: [{ id: "costra", nombre: "Costra de queso", extra: EXTRA_COSTRA }] },
];

const taco = (id: string, nombre: string, precio: number): Producto =>
  ({ id, nombre, categoria: "Tacos", precio, estacion: "cocina", mixta: { tripaExtra: 5, queso: true } });
const platillo = (id: string, nombre: string, categoria: string, precio: number): Producto =>
  ({ id, nombre, categoria, precio, estacion: "cocina", mixta: { tripaExtra: 10, queso: false } });
const fijo = (id: string, nombre: string, categoria: string, precio: number, estacion: Estacion = "cocina"): Producto =>
  ({ id, nombre, categoria, precio, estacion });

export const CATEGORIAS = ["Tacos", "Quesadillas", "Especiales", "Papas y Frijoles", "Tortas", "Postres y Bebidas"] as const;

export const PRODUCTOS: Producto[] = [
  taco("taco-maiz", "Taco maíz", 40),
  taco("taco-harina", "Taco harina", 42),
  platillo("quesadilla-maiz", "Quesadilla maíz", "Quesadillas", 65),
  platillo("quesadilla-harina", "Quesadilla harina", "Quesadillas", 95),
  platillo("vampiro", "Vampiro", "Especiales", 75),
  platillo("chorreada", "Chorreada", "Especiales", 80),
  platillo("costra", "Costra de queso", "Especiales", 100),
  { id: "gaonera", nombre: "Gaonera", categoria: "Especiales", precio: 75, estacion: "cocina", grupos: gaoneraGrupos },
  fijo("chilaca", "Taco de Chile chilaca", "Especiales", 80),
  platillo("papa-especial", "Papa asada especial", "Papas y Frijoles", 180),
  fijo("papa-sencilla", "Papa sencilla", "Papas y Frijoles", 130),
  platillo("charros-especiales", "Charros especiales", "Papas y Frijoles", 75),
  fijo("charros-sencillos", "Charros sencillos", "Papas y Frijoles", 55),
  platillo("torta", "Torta", "Tortas", 130),
  fijo("hamburguesa", "Hamburguesa", "Tortas", 125),
  fijo("quasagloria", "Quasagloria", "Postres y Bebidas", 100),
  fijo("agua-natural", "Agua natural", "Postres y Bebidas", 15, "barra"),
  fijo("agua-sabor", "Agua de sabor 1 L", "Postres y Bebidas", 45, "barra"),
  fijo("horchata", "Agua de horchata y cebada 1 L", "Postres y Bebidas", 50, "barra"),
  fijo("topo-chico", "Topo Chico", "Postres y Bebidas", 35, "barra"),
  fijo("toni-col", "ToniCol", "Postres y Bebidas", 55, "barra"),
];

/** Modifiers for a mixeable product: main meat (tripa surcharge per product), extra meats +10 each, cheese only on tacos. */
export function modsMixta(p: Producto, principal: Carne, extras: Carne[], queso: boolean): ModSeleccionado[] {
  if (!p.mixta) return [];
  const mods: ModSeleccionado[] = [{ grupo: "carne", nombre: principal, extra: principal === "Tripa" ? p.mixta.tripaExtra : 0 }];
  [...new Set(extras)].filter((c) => c !== principal).forEach((c) => mods.push({ grupo: "extra", nombre: `+ ${c}`, extra: EXTRA_CARNE }));
  if (queso && p.mixta.queso) mods.push({ grupo: "queso", nombre: "Con queso", extra: EXTRA_QUESO });
  return mods;
}

export const NOTAS_RAPIDAS = ["Con todo", "Natural", "Sin salsa de tomate", "Sin lechuga", "Sin frijoles", "Bien cocida"];

/** Unit price snapshot: base price plus every selected modifier extra. */
export function precioUnitario(p: Producto, mods: ModSeleccionado[]): number {
  return p.precio + mods.reduce((s, m) => s + m.extra, 0);
}

export const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function hoyMonterrey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey" }).format(new Date());
}

export const horaMty = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "America/Monterrey", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
