# TallerOS — RevivAuto

Aplicación existente, actualizada a Fase 2. Identidad oscura/dorada y operación desde teléfono.

URL estable: https://talleresos.github.io/talleres-OS/index.html
Repositorio: https://github.com/talleresOS/talleres-OS
Versión del código: 2.2.0.

## Datos

La URL publica el programa, no una base compartida. Cada navegador/dispositivo conserva sus datos en IndexedDB. Mantener la misma dirección permite actualizar la aplicación sin cambiar el origen de esos datos. No existe sincronización entre teléfonos.

Antes de actualizar, en la instalación actual: Configuración → Exportar todos los datos. Guarda ese JSON fuera del navegador.

Al abrir Fase 2 por primera vez:
1. Se añaden stores a talleros2 sin borrar los existentes.
2. Se crea la instantánea before-phase2 con los registros originales.
3. Se copian las cuentas, devengos y pagos del libro auxiliar a la base principal.
4. Se agregan metadatos operativos preservando IDs, REV, estados antiguos, costos y campos desconocidos.
5. Todo se confirma en una sola transacción. Una ejecución posterior no repite la migración.

El libro auxiliar original queda intacto. Las operaciones nuevas se guardan juntas en la base principal. Los backups v2 incluyen todos los módulos nuevos; las copias v1 pueden importarse en instalaciones que no contienen módulos nuevos, con recuperación previa.

Una orden histórica entregada sin fecha queda en Historial como “Fecha no registrada”. No se inventa fecha ni un pago. Si tiene saldo previo, se señala en la revisión de datos.

## Apariencia y piezas (2.2.0)

Configuración → Apariencia permite elegir tema claro/oscuro y colores principal/acento. Se guardan en settings.appearance de la base existente; no hay cambio de esquema ni migración adicional. El logo y la tarifa histórica del pintor permanecen almacenados; esta última ya no aparece en datos generales.

Cada pieza conserva Terminar y Asignar empleado. El menú ••• reúne Editar, Reabrir y Eliminar. Eliminar es reversible: usa el archivo existente y agrupa la pieza en Piezas retiradas; deja de aparecer en producción. Si tiene asignaciones o costos, la confirmación avisa que se conservan todos sus importes y pagos. No es una anulación contable. La edición conserva el precio de referencia en Datos adicionales.

Reabrir devuelve la pieza a Preparación mediante la edición existente. No revierte pagos ni devengos; terminar nuevamente reutiliza el devengo original sin duplicarlo.

## Operación

- Terminar piezas devenga mano de obra; no paga al empleado ni entrega el vehículo.
- Trabajo terminado con deuda: Cobrar saldo.
- Saldo cero: Finalizar y entregar → revisar resumen → Finalizar orden.
- El cierre crea un comprobante interno y bloquea cambios. Reabrir requiere confirmación y conserva los comprobantes previos.
- El PDF utiliza Imprimir / PDF del navegador. Descargar crea un HTML autocontenido para guardar y compartir. Web Share se utiliza cuando está disponible.
- El comprobante usa una lista explícita de datos permitidos del cliente; excluye notas internas y todos los costos.
- Inventario registra entradas, salidas y ajustes. Aún no convierte automáticamente consumos en costos.

## Finanzas y fechas

Rentabilidad = precio acordado − materiales − mano de obra − otros costos. Los pagos a empleados no se descuentan de nuevo.

Cierre mensual: venta por fecha de entrada/acuerdo; cobros por su fecha; costos por fecha conocida de costo o devengo; cuentas por cobrar al último día. Los movimientos de caja y costos no desaparecen al cancelar o archivar órdenes. Los costos históricos sin fecha se conservan y se muestran como advertencia de información incompleta.

Cerrar mes solo está permitido para períodos terminados y guarda una instantánea inmutable con su base de datos. No vuelve a calcularse silenciosamente.

## Desarrollo y publicación

Archivos:
- domain.mjs: estados derivados, cálculos, comprobantes y revisión.
- storage.mjs: IndexedDB, migración, importación y exportación.
- service.mjs: operaciones transaccionales.
- app.js / styles.css: interfaz única, sin MutationObserver ni formularios superpuestos.
- pwa.js / sw.js: instalación, caché por versión y actualización al cerrar pestañas antiguas.

Ejecuta node prepare-release.mjs para generar dist. Los archivos del manifiesto de publicación deben reemplazar los públicos del repositorio GitHub; incluir .mjs con MIME de JavaScript.

El service worker espera que se cierren las pestañas anteriores para activar la nueva versión. Después de publicar: abrir la URL en línea, cerrar las pestañas/icono de TallerOS y volver a abrir. Si hay otra pestaña bloqueando la migración, la app indica que se cierre; no solicita borrar datos.

No volver directamente al código MVP v1 después de migrar: el esquema conserva todos los datos, pero ese código pide explícitamente IndexedDB versión 1. La recuperación debe hacerse con una versión compatible y un backup, nunca borrando la base.

## Verificación

tests/phase2.mjs recorre los diez casos solicitados en un navegador Chromium/Edge aislado, con datos sintéticos basados en el esquema real. Prueba migración v1, importación, concurrencia, facturas sin costos, persistencia al reiniciar navegador y anchos 360/390/430/1280.

No afirma haber leído los datos privados del teléfono de RevivAuto. Los datos reales no están dentro de GitHub.

Pruebas de esta actualización: node tests/ui-refresh.mjs y node tests/ui-upgrade.mjs. La segunda necesita el tag v2.1.0 del repositorio para simular la actualización desde la versión anterior. Incluyen cantidad × tarifa, edición, reapertura, retiro/restauración, temas, logo, cierre del navegador y actualización PWA offline. Los tamaños móviles se prueban en Edge/Chromium; no sustituyen una revisión en un iPhone físico.
