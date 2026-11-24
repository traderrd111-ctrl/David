# Órdenes de pedido de motos y cuatriciclos

Página para cargar cantidades por modelo, año y color, y descargar la orden de pedido en PDF o Excel.

## Uso

Abrí `pedidos/index.html` en el navegador (necesita conexión a internet para cargar las librerías que generan el PDF y el Excel).

1. Buscá un modelo por nombre, código o color, o filtrá por categoría, año y mercado.
2. Abrí el modelo y cargá la cantidad de cada color con **+ / −** o escribiéndola.
3. Completá los datos del pedido (número, fecha, cliente, observaciones).
4. Descargá la orden en **PDF** o **Excel**.

El pedido en curso se guarda como borrador en el navegador. **Empezar un pedido nuevo** lo borra.

## Actualizar la planilla

Los datos salen de las planillas originales en `pedidos/fuentes/` (una fila por línea, columnas separadas con `|`).
Después de modificarlas, regenerá `datos.js`:

```bash
python3 pedidos/herramientas/generar_datos.py
```

El script traduce colores y mercados al español. Si aparece un color o un mercado nuevo sin traducción, se detiene e indica cuál agregar en los diccionarios del principio del script. También lista las inconsistencias de la planilla, que se ven en la página en **Observaciones sobre la planilla original**.
