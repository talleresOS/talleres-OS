# Modelo de datos — esquema 3

**Base:** talleros2. **App:** 3.0.0. **Formato de datos del respaldo:** 3. **Revisión del envoltorio con integridad:** 2. Son números distintos.

## Colecciones

| Store | Contenido / relación |
| --- | --- |
| settings | Identidad, logo, colores, preferencias y configuración |
| clients | Clientes; teléfonos y datos de contacto |
| vehicles | Vehículos vinculados por clientId |
| orders | Cliente, vehículo, REV, fechas, precio, condiciones, recepción, estado, garantía e initialReceipt |
| parts | Registros históricos; no duplicar assignments ya migrados |
| employees | Empleados y tarifas/configuración existente |
| payments | Cobros reales del cliente por orderId |
| costs | Costos/materiales/gastos asociados a órdenes |
| vehiclePieces | Piezas físicas específicas, incluidas retiradas |
| workAssignments | Proceso, selectedPieceIds, empleado, estado, modalidad, tarifa e importe |
| ledgerAccounts | Cuentas de empleados |
| ledgerAccruals | Devengos; sourceAssignmentId evita duplicarlos |
| ledgerPayments | Pagos al empleado; no son un segundo costo |
| invoices | Facturas/constancias congeladas de cierre |
| quotations | Cotizaciones y acuerdos congelados |
| inventory | Productos, stock, mínimos y costo |
| inventoryMoves | Entradas/salidas por productId |
| events | Historial de operaciones, incluidas acciones del asistente |
| monthlyClosures | Cierre mensual como instantánea |
| meta | Versiones internas, migraciones y numeración |
| snapshots | Recuperaciones anteriores a cambios/importación |

El respaldo serializa todas estas colecciones, incluyendo campos desconocidos. Los grupos main, ledger y phase2 del JSON mantienen compatibilidad con las versiones anteriores.

## Invariantes financieros

- Un abono inicial crea **un pago real** y la instantánea initialReceipt en la misma transacción. Abrir o imprimir documentos nunca agrega pagos.
- Balance = precio acordado − pagos vigentes. No permitir sobrepagos inadvertidos ni confundir caja cobrada con venta.
- Cada proceso de una pieza puede tener un empleado distinto. Pintura completa selecciona 13 piezas reales; la selección sigue editable.
- Una tarifa de 400 por las 13 piezas genera 5,200. Un monto fijo no se multiplica.
- Las asignaciones históricas sin nombres mantienen unspecifiedQuantity e importes originales. No inventar piezas ni recalcular devengos protegidos.
- Terminar/reabrir/restaurar no duplica devengos. Los pagos de empleados reducen su deuda, no la utilidad otra vez.
- Orden finalizada conserva historial/documentos y bloquea cambios operativos. La reapertura usa el flujo controlado.
- Condiciones, observaciones de recepción y observaciones finales son conceptos separados. La garantía no se inventa.
- REV conserva el máximo histórico al recuperar/importar para no reutilizar números; restaurar no promete reducir el contador.

## Migraciones

La migración original a esquema 3 es aditiva. Las migraciones de modelo y pintura completa existentes guardan instantáneas y son idempotentes; la auxiliar talleros2-ledger no se elimina. 3.0 no añade stores ni cambia el esquema.

Antes de modificar datos/finanzas: exportar, crear un punto de recuperación de código, verificar con datos sintéticos históricos, conservar IDs/campos desconocidos, ejecutar la suite de migraciones y repetir la apertura. Nunca borrar IndexedDB para resolver un error.

La importación valida referencias principales, tipos, duplicados e importes; audit añade avisos para inconsistencias históricas adicionales. No puede certificar que un importe válido coincide con la realidad del taller.
