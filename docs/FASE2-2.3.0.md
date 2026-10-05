# TallerOS 2.3.0 — entrega local de Fase 2

Fecha: 2026-10-01. Base: 2.2.0, commit `b857f702a3d32a4c075ac49adc42cc495a3c4b69`.

Se amplió el proyecto existente. No se reconstruyó, cambió de URL ni publicó. La última instrucción exige conservar el resultado dentro del proyecto. No se accedió a datos privados del teléfono; las verificaciones se hicieron con datos sintéticos y el código real anterior.

## 1. Archivos modificados

| Grupo | Archivos | Cambio |
| --- | --- | --- |
| Modelo y almacenamiento | `domain.mjs`, `storage.mjs`, `service.mjs` | Relaciones nuevas, migración aditiva, cálculos sin duplicación, acuerdos y entrega |
| Nuevos módulos | `work-model.mjs`, `work-service.mjs`, `work-ui.mjs`, `logo-palette.mjs` | Piezas/procesos, operaciones, interfaz y paleta del logo |
| Interfaz | `app.js`, `styles.css`, `index.html` | Órdenes, producción, empleados, documentos, configuración y diseño móvil |
| Versión y paquete | `package.json`, `version.json`, `sw.js`, `prepare-release.mjs` | Versión 2.3.0, caché nueva, 19 archivos públicos y scripts de pruebas |
| Pruebas | `tests/phase2.mjs`, `tests/harness.mjs`, `tests/work-model.mjs`, `tests/work-ui.mjs`, `tests/work-migration.mjs` | Regresiones y nuevos escenarios |
| Documentación | `README.md`, `AGENTS.md`, `CHANGELOG.md`, `CONTINUIDAD.md`, este informe, `.gitignore` | Operación, límites, recuperación y continuidad |

`dist` es generado e ignorado por Git. Los archivos no relacionados, incluidos los métodos existentes para pagar empleados, se reutilizan.

## 2. Modelo de piezas, procesos y asignaciones

`vehiclePieces` representa piezas físicas de una orden. `workAssignments` representa un proceso concreto con `orderId`, `process`, `employeeId`, `selectedPieceIds`, `mode`, `rate`, `quantity`, `total`, `status` y `sourceAssignmentId`. `quotations` conserva documentos del cliente.

Cada proceso tiene selección y estado independientes. La orden solo considera trabajos activos, y verifica que todas sus piezas activas estén cubiertas por trabajos. Un trabajo terminado no representa automáticamente toda la producción. Los registros antiguos `parts` permanecen por compatibilidad y costos históricos.

## 3. Migración de órdenes anteriores

IndexedDB `talleros2` pasa de esquema 2 a 3 creando stores adicionales. Se guarda `before-work-model-v3` antes de migrar. La marca `work-model-v3` impide repetir la transformación. Todo se confirma transaccionalmente; no hay borrado de bases.

Cada asignación antigua se relaciona con su original. Cantidad, tarifa, total, devengos, pagos y campos desconocidos se conservan. Si no existen nombres inequívocos, se muestra “5 piezas sin especificar” y “Trabajo anterior”, manteniendo la descripción/proceso anterior como información histórica. No se inventan piezas ni se distribuyen importes retrospectivamente.

Configuración permite descargar la copia previa a 2.3. Los backups nuevos son formato 3; se validan importaciones anteriores. Importar otra copia no reemplaza silenciosamente la instantánea original de migración.

## 4. Carro completo

El catálogo inicial incluye 13 piezas. La opción utiliza `settings.fullCarPieceIds`, editable en Configuración. Se puede agregar pieza personalizada, seleccionar el conjunto, quitar o agregar piezas. El contador y cálculo usan la selección efectiva. Cambiar la plantilla no cambia órdenes anteriores.

## 5. Selección por empleado y proceso

Primero se definen piezas de la orden. Asignar trabajo reúne proceso, empleado, selección, forma de pago y tarifa. No exige repetir una cantidad ni otro responsable de producción. Las tarjetas muestran proceso, empleado, piezas y estado, con lista ampliable y Terminar visible. Producción y Empleados reutilizan esas relaciones.

Las piezas retiradas no cuentan como activas. Los trabajos retirados no cuentan como pendientes. Una pieza usada requiere primero actualizar o retirar el trabajo relacionado, evitando referencias huérfanas. Se conserva restauración controlada.

## 6. Pagos existentes y correcciones

La fórmula monetaria se conserva: piezas seleccionadas × tarifa, o monto fijo. Los pagos a empleados siguen usando el libro existente. El devengo usa una clave estable; terminar, reabrir, retirar y restaurar no lo repite ni crea otro pago.

Asignaciones históricas o ya devengadas protegen empleado, cantidad, tarifa e importe. Identificar nombres históricos conserva la cantidad original. Las nuevas asignaciones aún no devengadas pueden editarse normalmente. Cancelar no borra deudas ni costos que ya existían.

También se corrigieron: doble conteo potencial de asignaciones migradas; cierre prematuro con piezas sin trabajo; reapertura que no aparecía como trabajo pendiente; posible sustitución del snapshot al importar; secuencia de cotizaciones tras recuperación; contraste y altura del modal en móvil.

## 7. Cotización y WhatsApp

Cotizaciones numeradas con logo, taller, cliente, vehículo, piezas, procesos, precio, fecha, condiciones y garantía. Los datos del documento se construyen con una lista explícita permitida: sin salarios, costos internos, empleados ni utilidad.

Confirmar el precio conserva fecha e historial de acuerdos. Cambiarlo registra antes/después y exige reconfirmación antes de entregar. Las cotizaciones anteriores permanecen consultables.

Se puede visualizar, imprimir/guardar PDF mediante el navegador, descargar HTML autocontenido y compartir con Web Share cuando sea compatible. WhatsApp abre un mensaje para el teléfono del cliente; el archivo se descarga para adjuntarlo manualmente cuando haga falta. No se simula un adjunto automático.

## 8. Garantía y logo

Garantía configurable: ninguna, 3, 6, 12 meses o personalizada, con condiciones. La cotización conserva su copia y al confirmar se copia al acuerdo/orden. Cambiar después de 6 a 12 meses no altera el documento anterior. Una garantía no configurada se considera ninguna; no se aplican seis meses retroactivamente a órdenes reales.

El logo aparece en Inicio, cotización y constancia, conservando “Tu taller, hoy”. Se analiza localmente para obtener una paleta de hasta cinco colores, con variantes útiles y fallback al tema predeterminado. La paleta persiste; quedan ajustes manuales avanzados y temas claro/oscuro.

## 9. Cierre y entrega

Trabajos terminados, cobro y entrega son acciones distintas. Saldo cero habilita la entrega, que necesita confirmación. La constancia registra fecha/hora, precio, abonos, saldo, métodos de pago, trabajos, piezas y garantía del acuerdo, con nombre/firma/fecha físicos. No se implementó captura digital opcional.

La orden se retira de Inicio/Producción y pasa a Historial bloqueado. Se conservan consulta interna de costos, empleados, pagos, movimientos, utilidad, cotización y constancia. La reapertura es controlada y no borra documentos previos.

## 10. Pruebas y resultados

Todas las suites siguientes finalizaron sin fallos en su ejecución final, con perfiles aislados y datos sintéticos:

| Suite | Resultado |
| --- | --- |
| `tests/work-model.mjs` | PASS: cálculos, estados, retiros, protección financiera, documentos, garantías, cierre e importación |
| `tests/work-ui.mjs` | PASS: flujo completo real de interfaz; reinicio del navegador; nueve pantallas en dos temas y cuatro anchos; cero errores JS |
| `tests/work-migration.mjs` | PASS: código exacto 2.2.0 → 2.3.0, IndexedDB 2 → 3, PWA, datos originales iguales, importación v2, arranque offline |
| `tests/phase2.mjs` | PASS: 12 grupos de regresión de Fase 2, inventario, cierre mensual, concurrencia y persistencia |
| `tests/edge-cases.mjs` | PASS: 5 grupos, incluida actualización PWA desde MVP, caja/costos conservados y atomicidad |

Casos obligatorios:

| Caso | Verificación | Resultado |
| --- | --- | --- |
| 1 | David, desabolladura, 1 × 500 | RD$500 |
| 2 | Francisco, preparación, 5 × 300 | RD$1,500 |
| 3 | Pintura, 5 × 400 | RD$2,000 |
| 4 | Preparación cambia de 5 a 4 | RD$1,200; otras asignaciones intactas |
| 5 | Carro completo 13 menos 1 | 12; también plantilla configurable a 11 |
| 6 | David, 5 × 500 | RD$2,500 |
| 7 | Terminar desabolladura | Preparación/pintura pendientes |
| 8 | Retirar/restaurar/reabrir | Sin duplicar devengos ni pagos |
| 9 | Cerrar y abrir navegador | Piezas, estados, trabajos y pagos idénticos |
| 10 | Orden antigua cantidad 5 | “5 piezas sin especificar”; sin piezas inventadas |
| 11 | Cotización | Sin importes ni nombres internos de empleados |
| 12 | Garantía 6; configuración cambia a 12 | Documento/acuerdo anterior mantiene 6 |
| 13 | Terminar, cobrar, entregar | Constancia y orden en Historial |

Pruebas adicionales: monto fijo RD$777; rechazo de piezas de otra orden; historial bloqueado; pagado RD$200 sobre devengado RD$500 mantiene RD$300 de saldo; migración de devengado RD$2,500 y pagado RD$1,000 mantiene RD$1,500; impresión real de cotización a PDF; fallback de logo inválido; cierre vacío explícito; restauración sin duplicaciones; copias previas recuperables.

Evidencia retenida localmente en `.test-results/validated-2.3/`: cinco JSON de resultados, capturas seleccionadas y PDF de prueba. Los rótulos de algunas pruebas heredadas todavía dicen v1/v2; su ejecución sirve el código actual y valida compatibilidad hacia adelante.

## 11. Limitaciones pendientes

- No se publicó, según la última instrucción. Esta versión local no actualizó los teléfonos ni la URL pública.
- Anchos 360/390/430/1280 probados en Edge/Chromium; no Safari ni iPhone físico.
- No se tuvo acceso a la base privada de RevivAuto. Se probó migración con código anterior exacto y datos sintéticos representativos.
- PDF depende de Imprimir/Guardar PDF del navegador. La descarga directa es HTML. WhatsApp puede requerir adjuntar manualmente.
- Firma física preparada; firma digital opcional no añadida.
- Datos siguen siendo locales al navegador. Inventario conserva su funcionamiento actual sin automatizar consumos a costos.

## 12. Punto seguro y recuperación

Base segura: tag `v2.2.0`. Resultado: tag local `checkpoint-2.3.0-local`, sin push, con ZIP de código `local-backups/TallerOS-2.3.0-local.zip` y SHA256 al lado. Leer `CONTINUIDAD.md` para retomar.

El ZIP no contiene los datos reales del taller. Al abrir la nueva versión, la migración guarda su snapshot antes de cambiar el modelo. No volver al ejecutable 2.2.0 sobre una base de esquema 3 ni borrar IndexedDB para retroceder.

## 13. Preparación para Fase 3

Las asignaciones pueden consultarse directamente por `employeeId`, `orderId`, proceso, piezas y estado. Se conserva identidad estable para devengos y trazabilidad. No se implementaron cuentas cloud, PIN, tablet compartida, backend, multi-taller, SaaS ni suscripciones.
