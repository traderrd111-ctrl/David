# Órdenes de pedido de motos y cuatriciclos

Página para cargar cantidades por modelo, año y color, y descargar la orden de pedido en PDF o Excel.

## Uso

Abrí `pedidos/index.html` en el navegador (necesita conexión a internet para cargar las librerías que generan el PDF y el Excel).

1. Buscá un modelo por nombre, código o color, o filtrá por categoría, año y mercado.
2. Abrí el modelo y escribí la cantidad de cada color en la columna del destino:
   - **Sucursal Yamaha JFK**: pedido de sucursal.
   - **Red de dealers** (preventa): Jarabacoa, Higüey, Santiago y Barahona.
3. Completá los datos del pedido (número, fecha, empresa, observaciones).
4. En **Ver y descargar** elegí qué parte del pedido querés ver y descargar:
   - **Pedido completo**: resumen por destino, resumen por modelo, detalle consolidado con una columna por destino y el pedido de cada destino por separado, con el total general.
   - **Sucursal Yamaha JFK**, **Red de dealers** o un dealer en particular: solo esa parte.
5. Descargá la orden en **PDF** o **Excel**. El Excel trae una hoja de resumen, una consolidada y una por destino.

Para sumar, quitar o renombrar un dealer, editá la lista `DESTINOS` al principio de `app.js`.

El pedido en curso se guarda como borrador en el navegador. **Empezar un pedido nuevo** lo borra.

## Actualizar la planilla

Los datos salen de las planillas originales en `pedidos/fuentes/` (una fila por línea, columnas separadas con `|`).
Después de modificarlas, regenerá `datos.js`:

```bash
python3 pedidos/herramientas/generar_datos.py
```

El script traduce colores y mercados al español. Si aparece un color o un mercado nuevo sin traducción, se detiene e indica cuál agregar en los diccionarios del principio del script. También lista las inconsistencias de la planilla, que se ven en la página en **Observaciones sobre la planilla original**.
