# TallerOS 2.4.0 — comprobantes y factura final

Implementación sobre la versión local 2.3.0 (383c790). Conserva el origen de GitHub Pages, IndexedDB `talleros2` esquema 3 y los módulos operativos. No se publicó externamente.

## Datos reutilizados y ampliaciones

- Clientes/vehículos, configuración del taller, pagos, piezas físicas y procesos continúan en sus colecciones existentes.
- Nueva orden agrega condiciones del trabajo, observaciones de recepción, entrega estimada requerida, piezas con múltiples procesos y abono inicial con método/fecha. La fecha de recepción sigue siendo `entryDate`; la entrega se puede editar desde Editar orden.
- El guardado usa una única transacción: orden, piezas, procesos, pago y comprobante. Un token de creación evita duplicar una orden/abono al reintentar. Si falla una validación no queda guardada ninguna parte.
- El primer abono es un registro real en `payments`; el comprobante no genera cobros. Los cobros posteriores usan el mismo historial y cálculos existentes.
- `order.initialReceipt` conserva la instantánea inicial. Abrirla, imprimirla y compartirla no modifica pagos. Cambiar después la fecha prevista o corregir un pago no reescribe la constancia originalmente emitida.
- El cierre permite revisar garantía sí/no, duración, inicio, vencimiento, condiciones y observaciones finales. No se inventan condiciones. La factura y la garantía quedan asociadas al historial de la orden.
- Se guarda una instantánea `before-customer-documents-v1` al iniciar por primera vez. No se modifica el esquema ni se borran registros. Los documentos anteriores no se regeneran ni se completan con fechas inventadas.

## Presentación

`documents.mjs` y `documents-style.mjs` generan ambos documentos; `document-ui.mjs` conecta formularios y acciones. La estructura sigue la referencia: encabezado del taller, bloques cliente/vehículo, procesos agrupados, resumen económico, firma y pie. La factura agrega pagos y garantía.

Logo y colores provienen de configuración y quedan congelados al emitir. Colores claros u oscuros seleccionan texto negro/blanco con contraste mínimo 4.5:1 en las superficies configurables. El fondo del contenido permanece blanco. No se agregan fotografías de vehículos.

El contenido del cliente usa una lista explícita de propiedades. No incluye empleados, costos, devengos, salarios, utilidad, margen ni notas internas. Los documentos HTML descargados son autónomos, con estilos integrados. La vista de impresión solo contiene el documento, sin controles ni marca de agua TallerOS.

WhatsApp usa el selector nativo cuando admite compartir archivos. En otros navegadores descarga el documento y ofrece un enlace con mensaje preparado, aclarando que el usuario debe adjuntar el HTML o PDF. No se envían mensajes automáticamente.

La marca de agua de la interfaz es decorativa, sutil, no interactiva y aparece en zonas vacías o vistas principales con pocos registros.

## Verificación

Ocho suites: modelo operativo, interfaz operativa, migración 2.2.0, regresiones Fase 2, casos extremos, modelo de documentos, actualización real 2.3.0 y flujo de documentos.

Caso Mario Rodríguez: Honda Civic 2011 gris; recepción 01/10/2026; entrega prevista 08/10/2026; cinco piezas y cuatro procesos, incluidos varios procesos en una misma puerta. Total 60,000; abono inicial 20,000; balance 40,000. Producción terminada por la interfaz, pago final 40,000, garantía seis meses y cierre: exactamente dos pagos, total 60,000, balance cero y PAGADO.

También se prueban abono cero, pago inicial completo, pagos 20+10+30, edición/anulación/restauración, reintentos, rechazo atómico, conservación de instantáneas, respaldo/importación, contraste, escape HTML y agrupación sin repetir piezas.

Se comprobaron vistas 360/390/430 y escritorio, documentos carta mediante PDF del navegador, capturas y revisión de las páginas renderizadas con Poppler. El ejemplo cabe en una página por documento. Órdenes extensas pueden ocupar más páginas sin ocultar contenido.

La actualización desde 2.3.0 conserva exactamente todas las colecciones de negocio, documentos y propiedades desconocidas; agrega solo metadatos y respaldo. La factura histórica se abre sin conexión después de actualizar el service worker. También se mantiene la prueba de migración desde 2.2.0.

Evidencia sintética en `.test-results/`, ignorada por Git. No se usaron ni se modificaron datos de la instalación real. La prueba móvil se hizo en Chromium con anchos de teléfono; no se verificó en un iPhone físico ni en una impresora física.

## Entrega

Ejecutar `node prepare-release.mjs` para sincronizar `dist`. Los tres módulos nuevos forman parte del manifiesto de distribución y del cache offline. La publicación sigue pendiente de autorización expresa y debe conservar el mismo GitHub Pages.
