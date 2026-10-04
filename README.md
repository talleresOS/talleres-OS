# TallerOS

Aplicación existente de gestión de taller, ampliada sobre 2.2.0 sin reconstruirla.

- Código local: **2.5.0 piloto** sobre 2.4.1. Pintura completa 13 piezas, asistente con acciones controladas e interfaz renovada.
- Publicada: **2.4.1**, intacta. Vercel preparado; conexión/despliegue y OpenAI real pendientes.
- Informe actual: `docs/ASISTENTE-2.5.0.md`.
- URL existente: https://talleresos.github.io/talleres-OS/index.html
- Repositorio: https://github.com/talleresOS/talleres-OS
- Auditoría final y autorización de publicación: `docs/AUDITORIA-2.4.1.md`.
- Informes: `docs/COMPROBANTES-2.4.0.md` y `docs/FASE2-2.3.0.md`. Punto de continuación: `CONTINUIDAD.md`.

## Datos y migración

Cada navegador conserva sus datos en IndexedDB; GitHub publica el programa, no los datos del taller. No existe sincronización cloud.

La base `talleros2` pasa del esquema 2 al 3 mediante ampliación aditiva. Se incorporan `vehiclePieces`, `workAssignments` y `quotations`. Antes de transformar el modelo se guarda la instantánea `before-work-model-v3`. Configuración permite descargar esa copia previa a 2.3; exportar todos los datos genera un backup completo formato 3. La importación admite formatos anteriores con validación y recuperación previa.

Se conservan IDs, números REV, clientes, vehículos, órdenes, piezas antiguas, costos, cuentas, devengos, pagos, movimientos, documentos y campos desconocidos. La migración es transaccional e idempotente. No borra la base ni el libro auxiliar histórico `talleros2-ledger`.

Una asignación antigua que solo decía cantidad 5 aparece como **5 piezas sin especificar**. No se inventan nombres ni procesos históricos. El propietario puede identificar las piezas manteniendo los importes protegidos. Las asignaciones históricas o ya devengadas no permiten cambiar silenciosamente empleado, cantidad, tarifa o total.

No abrir directamente una versión de código que solicite un esquema inferior después de migrar. Un ZIP del código no es una copia de los datos del navegador; la recuperación de datos debe usar backups y código compatible, nunca borrar IndexedDB.

## Piezas, procesos y empleados

1. En la orden se eligen las piezas físicas: catálogo táctil, búsqueda, carro completo o pieza personalizada.
2. Cada trabajo elige proceso, empleado y su propia selección de piezas.
3. Por pieza: cantidad seleccionada × tarifa. Monto fijo: el importe acordado sin multiplicarlo.
4. Cada trabajo tiene estado Pendiente, En proceso o Terminado. Terminar un proceso no termina los demás.
5. Terminar devenga; pagar al empleado es una operación independiente. Reabrir, retirar y restaurar no repite devengos ni pagos.

Pintura completa siempre representa las 13 piezas estándar y se puede elegir con un toque.

Carro completo utiliza una lista configurable en Ajustes, inicialmente de 13 piezas. Quitar una usa 12; cambiar la configuración cambia la selección inicial, no las órdenes existentes.

Una pieza retirada deja de estar activa. Para retirar una pieza vinculada, primero hay que quitarla de sus trabajos editables o retirar esos trabajos. Se preservan la trazabilidad y los importes devengados. Producción y Empleados reutilizan los mismos trabajos, sin un responsable duplicado.

## Cotización, garantía y entrega

La cotización toma una copia de cliente, vehículo, logo, piezas, procesos, precio, condiciones y garantía. Confirmar el precio registra el acuerdo; las revisiones conservan historial. Un cambio de precio posterior exige volver a confirmar el acuerdo antes de entregar.

La garantía es configurable: ninguna, 3, 6, 12 meses o personalizada. Si no se configura, no se inventa. Cambiar la garantía general no cambia cotizaciones ni acuerdos anteriores.

Documentos del cliente excluyen salarios, costos, rentabilidad y notas internas. Pueden visualizarse, imprimirse/guardarse como PDF con el navegador, descargarse como HTML autocontenido y compartirse cuando Web Share está disponible. WhatsApp prepara el mensaje y permite descargar el documento: no afirma haber adjuntado un archivo automáticamente.

Trabajos terminados → cobrar saldo → revisar entrega → confirmar. Saldo cero por sí solo no entrega el vehículo. La constancia conserva garantía y fecha real de entrega, e incluye nombre, firma física y fecha. La orden pasa a Historial y queda bloqueada, con reapertura controlada.

## Apariencia y operación conservada

Logo en Inicio y documentos; paleta automática de hasta cinco colores útiles, con alternativa predeterminada y controles manuales avanzados. Temas claro/oscuro persistentes, contraste y profundidad sutil. Se mantiene “Tu taller, hoy”.

Inventario, clientes, vehículos, cobros, cuentas de empleados, materiales, otros costos, rentabilidad y cierre mensual siguen en la aplicación existente. Venta, caja cobrada y saldo pendiente permanecen separados. Los cierres mensuales guardan instantáneas históricas; pagar mano de obra no vuelve a restar su costo.

## Desarrollo

- `domain.mjs`: cálculos, estados y datos permitidos en documentos.
- `storage.mjs`: IndexedDB, migraciones y copias.
- `service.mjs` y `work-service.mjs`: operaciones transaccionales.
- `work-model.mjs`: catálogo, relaciones y compatibilidad histórica.
- `app.js`, `work-ui.mjs`, `styles.css`: interfaz existente y flujos nuevos.
- `logo-palette.mjs`: análisis local del logo.
- `pwa.js`, `sw.js`: instalación y caché versionada; la actualización espera el cierre de las pestañas antiguas.

`npm run build` prepara 19 archivos públicos en `dist`, con hashes. No publica. No editar `dist` directamente.

`npm test` ejecuta modelo, interfaz, migración desde el código exacto del tag `v2.2.0`, regresiones y casos extremos. Requiere Playwright y Edge/Chromium. Variables opcionales: `TALLEROS_PLAYWRIGHT`, `TALLEROS_BROWSER`, `TALLEROS_TEST_OUTPUT` (usar `.test-results` dentro del proyecto). La prueba adicional de actualización desde el MVP usa la opción documentada en `tests/edge-cases.mjs`.

Las pruebas usan datos sintéticos, perfiles aislados y tamaños 360/390/430/1280. No equivalen a haber inspeccionado la base privada del teléfono ni a una prueba en Safari/iPhone físico. Ver resultados y límites en el informe.
