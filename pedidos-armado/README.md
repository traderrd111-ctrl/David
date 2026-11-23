# Pedidos de Armado

Plataforma web para el control mensual de los pedidos de armado de motocicletas Yamaha.

## Qué hace

- **Pedido del mes**: un pedido por mes (N.º `PA-AAAA-MM`). Se elige el modelo y se escriben las cantidades por color. Los totales por modelo y el total general se calculan solos.
- **Firmas**: el gerente de tienda y el encargado de almacén firman en pantalla (con el dedo o el ratón) o a mano sobre el PDF impreso.
- **Procesar pedido**: registra la fecha de procesado, bloquea las cantidades y descarga el PDF «Solicitud de pedido de armado» para enviarlo al Departamento de Armado.
- **Recepción**: registro de cada entrega (fecha, conduce o factura y unidades por color). Muestra cantidad pedida, recibida y restante.
- **Cumplimiento**: indicadores por mes y por año, cumplimiento por modelo y por color, días promedio de entrega desde el procesado, gráfico mensual y reporte en PDF o CSV.
- **Reclamaciones**: reporte de daños o defectos con modelo, color, chasis, motor, descripción del fallo y correo de quien reporta. El botón abre el programa de correo con el mensaje listo para `dsais@sdm.com.do` (la dirección se cambia en Ajustes).
- **Catálogo**: 59 modelos Yamaha con sus colores. Se pueden agregar modelos y colores, renombrar, ocultar o eliminar los que no se usan.
- **Ajustes**: datos de la tienda, nombres por defecto de quienes firman, correos y respaldo en JSON.

## Cómo se usa

- **Publicada en claude.ai** (Artifact): los datos se guardan en una base de datos compartida; todas las personas con acceso ven lo mismo.
- **Abriendo `index.html` en un navegador**: funciona igual, pero los datos se guardan solo en ese navegador (usa *Ajustes → Descargar respaldo* con regularidad).

El PDF usa `jsPDF` y `jspdf-autotable` desde cdn.jsdelivr.net, así que necesita conexión a internet.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos (tema claro y oscuro) |
| `app.js` | Lógica de la aplicación |
| `catalogo.js` | Catálogo base de modelos y colores |
| `build-artifact.mjs` | Empaqueta todo en un solo HTML para publicarlo como Artifact |

```bash
node build-artifact.mjs            # genera dist/pedidos-armado.html
```
