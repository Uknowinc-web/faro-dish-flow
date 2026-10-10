# Faro Dish Flow

Crear la aplicación web Smart Restaurant Pro para Tacos el Faro (taquería de carne asada en Monterrey) con arquitectura profesional multi-dispositivo y separación estricta de funciones:

1. Perfiles de usuario y accesos:
- Mesero (interfaz móvil a una mano): selección de mesa, registro ágil de comandas con modificaciones (carnes, extras, tortilla, costra, queso, notas de preparación rápidas), envío a cocina y consulta de estado de sus órdenes. Restricción estricta: no muestra precios, subtotales ni datos financieros.
- Cocina (pantalla KDS de alto contraste): comanda digital en tiempo real con número consecutivo, mesa, hora de envío, productos con cantidades, modificaciones destacadas y notas. Botones de estado (Pendiente -> En preparación -> Listo). Alerta acústica/visual al recibir pedidos. Sin datos de precios ni bebidas de barra.
- Caja (iPad / tablet): monitor de mesas activas, consolidación automática de todas las comandas de una misma mesa en una sola cuenta activa, detalle de consumos, cobro total con registro de método de pago (Efectivo o Clip), anulación controlada y corte de caja diario (filtrado por fecha operativa Monterrey, total vendido, desglose por método, ticket promedio y top productos vendidos).

2. Catálogo completo migrado de Tacos el Faro:
- Tacos: Taco maíz ($40), Taco harina ($42), carnes (Asada, Pastor, Tripa con extra +$5 o +$10), queso opcional (+$5).
- Quesadillas: Quesadilla maíz ($65), Quesadilla harina ($95).
- Especiales: Vampiro ($75), Chorreada ($80), Costra de queso ($100), Gaonera ($75, opciones maíz/harina/costra +$15), Chile chilaca ($80).
- Papas y Frijoles: Papa asada especial ($180), Papa sencilla ($130), Charros especiales ($75), Charros sencillos ($55).
- Tortas: Torta ($130), Hamburguesa ($125).
- Postres y Bebidas: Quasagloria ($100), Agua natural ($15, barra), Agua de sabor 1L ($45, barra), Horchata y cebada 1L ($50, barra), Topo Chico ($35, barra), Toni Col ($55, barra).
- Notas de cocina rápidas: Con todo, Natural, Sin salsa de tomate, Sin lechuga, Sin frijoles, Bien cocida.
- Mesas predeterminadas: Barra, Mesa 1 a Mesa 12, Para Llevar, con capacidad de agregar mesas adicionales dinámicamente.

3. Reglas de negocio y consistencia:
- Ciclo de vida de mesa: Disponible -> Ocupada (cuenta abierta acumulativa) -> Por cobrar -> Pagada / Cerrada.
- Snapshot de precio unitario por cada línea al momento de ordenar.
- Prevención de duplicados en envío de comandas.
- Interfaz en español con diseño dark mode premium adaptado a ambiente de cocina y salón.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4401508c-5ebc-4cff-838f-5e6f2d4748fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
