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
};
export type ModSeleccionado = { grupo: string; nombre: string; extra: number };

const carnes: GrupoOpciones = {
  id: "carne",
  nombre: "Carne",
  tipo: "uno",
  requerido: true,
  opciones: [
    { id: "asada", nombre: "Asada", extra: 0 },
    { id: "pastor", nombre: "Pastor", extra: 0 },
    { id: "tripa", nombre: "Tripa", extra: 0 },
    { id: "tripa5", nombre: "Tripa extra (+5)", extra: 5 },
    { id: "tripa10", nombre: "Tripa extra (+10)", extra: 10 },
  ],
};
const queso: GrupoOpciones = {
  id: "queso",
  nombre: "Extras",
  tipo: "varios",
  opciones: [{ id: "queso", nombre: "Con queso", extra: 5 }],
};
const tortillaGaonera: GrupoOpciones = {
  id: "tortilla",
  nombre: "Tortilla",
  tipo: "uno",
  requerido: true,
  opciones: [
    { id: "maiz", nombre: "Maíz", extra: 0 },
    { id: "harina", nombre: "Harina", extra: 0 },
    { id: "costra", nombre: "Costra de queso (+15)", extra: 15 },
  ],
};

export const CATEGORIAS = ["Tacos", "Quesadillas", "Especiales", "Papas y Frijoles", "Tortas", "Postres y Bebidas"] as const;

export const PRODUCTOS: Producto[] = [
  { id: "taco-maiz", nombre: "Taco maíz", categoria: "Tacos", precio: 40, estacion: "cocina", grupos: [carnes, queso] },
  { id: "taco-harina", nombre: "Taco harina", categoria: "Tacos", precio: 42, estacion: "cocina", grupos: [carnes, queso] },
  { id: "quesadilla-maiz", nombre: "Quesadilla maíz", categoria: "Quesadillas", precio: 65, estacion: "cocina", grupos: [carnes] },
  { id: "quesadilla-harina", nombre: "Quesadilla harina", categoria: "Quesadillas", precio: 95, estacion: "cocina", grupos: [carnes] },
  { id: "vampiro", nombre: "Vampiro", categoria: "Especiales", precio: 75, estacion: "cocina", grupos: [carnes] },
  { id: "chorreada", nombre: "Chorreada", categoria: "Especiales", precio: 80, estacion: "cocina", grupos: [carnes] },
  { id: "costra", nombre: "Costra de queso", categoria: "Especiales", precio: 100, estacion: "cocina", grupos: [carnes] },
  { id: "gaonera", nombre: "Gaonera", categoria: "Especiales", precio: 75, estacion: "cocina", grupos: [tortillaGaonera] },
  { id: "chilaca", nombre: "Chile chilaca", categoria: "Especiales", precio: 80, estacion: "cocina", grupos: [carnes] },
  { id: "papa-especial", nombre: "Papa asada especial", categoria: "Papas y Frijoles", precio: 180, estacion: "cocina" },
  { id: "papa-sencilla", nombre: "Papa sencilla", categoria: "Papas y Frijoles", precio: 130, estacion: "cocina" },
  { id: "charros-especiales", nombre: "Charros especiales", categoria: "Papas y Frijoles", precio: 75, estacion: "cocina" },
  { id: "charros-sencillos", nombre: "Charros sencillos", categoria: "Papas y Frijoles", precio: 55, estacion: "cocina" },
  { id: "torta", nombre: "Torta", categoria: "Tortas", precio: 130, estacion: "cocina", grupos: [carnes] },
  { id: "hamburguesa", nombre: "Hamburguesa", categoria: "Tortas", precio: 125, estacion: "cocina" },
  { id: "quasagloria", nombre: "Quasagloria", categoria: "Postres y Bebidas", precio: 100, estacion: "cocina" },
  { id: "agua-natural", nombre: "Agua natural", categoria: "Postres y Bebidas", precio: 15, estacion: "barra" },
  { id: "agua-sabor", nombre: "Agua de sabor 1L", categoria: "Postres y Bebidas", precio: 45, estacion: "barra" },
  { id: "horchata", nombre: "Horchata y cebada 1L", categoria: "Postres y Bebidas", precio: 50, estacion: "barra" },
  { id: "topo-chico", nombre: "Topo Chico", categoria: "Postres y Bebidas", precio: 35, estacion: "barra" },
  { id: "toni-col", nombre: "Toni Col", categoria: "Postres y Bebidas", precio: 55, estacion: "barra" },
];

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
