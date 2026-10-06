# Familia de documentos TallerOS 3.0
Build: 3.0.0-documents-20261006. Rama: codex/documents-3-0.
Estado: implementación y pruebas locales; resultado remoto se registra al finalizar.

## Auditoría y causa
Antes, customerQuote copiaba settings.warranty y quoteConditions; work-ui tenía plantilla/impresión propias.
customerReception forzaba garantía none. closeOrder/closingForm solo leían orders.warranty (copiada al confirmar cotización) o texto del cierre. Sin ese acuerdo no heredaban la garantía general. Duración 6 se guardaba como texto custom sin unidad.
Las tres instantáneas ya existían: quotations, orders.initialReceipt e invoices. No se reconstruyó ese sistema.

## Flujo vigente
Configuración → resolveWarranty + workshopSnapshot → snapshot del documento → renderer compartido.
La garantía válida de la orden/acuerdo prevalece sobre Configuración; un documento nuevo sin acuerdo personalizado toma la garantía vigente. Un acuerdo confirmado no pierde su garantía al cambiar Configuración.
La entrega usa su fecha real (today/deliveryDate), duración y unidad. Los meses/años usan calendario con ajuste al último día, no bloques de 30/180 días. La garantía textual personalizada requiere vencimiento.
Cada snapshot nuevo (documentVersion 2) incluye branding y preferencias de presentación. No se cambia IndexedDB esquema 3 ni se migra/reescribe el historial. Un 6 histórico solo se muestra como 6 meses si sus fechas guardadas prueban ese plazo; sin evidencia se señala unidad no registrada, sin inventarla.
Garantías, condiciones, importes, trabajos, pagos y fechas antiguos conservan los datos guardados. La presentación común evoluciona sin consultar ajustes actuales al abrir históricos.

## Presentación y branding
Cotización resumida predeterminada; detallada solo lee prices de venta ya guardados (legacy parts.price). Asignaciones nuevas no contienen desglose de venta: se explica su ausencia y nunca se divide el total ni se usan salarios/costos.
Los tres documentos comparten documents.mjs/document-style, blanco con acentos, encabezado compacto, piezas en columnas, saldo/total destacados y firma según finalidad. Sin observaciones/WhatsApp/VIN no hay filas vacías.
Configuración de Identidad reutiliza logo/nombre/teléfono/WhatsApp/dirección/email/colores y añade Instagram y web. Sin geolocalización. Footer común con logo pequeño, contacto/redes/dirección/web disponibles. Teléfono y WhatsApp iguales se agrupan.
Logos mantienen proporción con límites y object-fit contain; datos embebidos del logo quedan en el snapshot. Las referencias URL heredadas se conservan, pero un archivo remoto reemplazado en esa URL no puede ser congelado por TallerOS; los logos subidos por Configuración se almacenan como data URL.
Documentos permite Clásico/Moderno/Compacto, color del taller/personalizado, logo/firma/piezas y cotización resumida/detallada. No se pueden ocultar importes ni identidad del vehículo/cliente con esas preferencias.
No se implementó firma electrónica; solo estructura semántica para aceptación/entrega.

## Archivos
document-policy.mjs nuevo: garantía, meses calendario, presentación y branding compartidos.
domain.mjs: ampliar listas públicas permitidas de snapshots (email/VIN/branding/preferencias).
service.mjs: cierre con fuente común y validación; preferencias/Instagram/web; correo opcional del cliente.
work-service.mjs: modo de cotización guardado.
documents.mjs, documents-style.mjs, document-ui.mjs: familia compartida, impresión, configuración y cierre.
work-ui.mjs: elimina la plantilla/impresión de cotización separadas y reutiliza la familia.
app.js: campos de identidad/correo, integración de preferencias y fechas calculadas.
Build, caché, manifest y pruebas actualizados; storage, backup, cálculo de piezas/asignaciones y módulos del asistente sin cambios.

## Pruebas y límites
21 suites + build/check:release/runtime independiente. Prueba de 6 → 12 meses, factura final con/sin acuerdo, personalizada 2 años/90 días, febrero bisiesto, fecha real de entrega y snapshot histórico.
Móvil 320/390, escritorio 816 y regresión general hasta1440; los tres estilos, tres tipos de documento, cotización detallada con/sin precios guardados, pagos múltiples, 13 piezas, procesos distintos, notas opcionales y ausencia de datos internos.
Branding A/B/C con logos horizontal/cuadrado/vertical, cambios de WhatsApp/redes/dirección/web, contactos ausentes, encabezado/footer y snapshots independientes. Solo perfiles sintéticos; ningún dato real alterado.
PDFs mediante impresión nativa HTML (no captura): nueve variantes y uno de cuatro páginas; páginas renderizadas e inspeccionadas, última pieza/cláusula/firma presentes. La prueba adicional exporta/restaura con confirmación y cierra/reabre un navegador persistente.
Límites: prueba física de Safari/iPhone e impresora del propietario; documentos heredados no reciben contactos/fechas inexistentes. Un desglose de venta no guardado permanece ausente. IA externa/Vercel no forman parte de esta tarea.
