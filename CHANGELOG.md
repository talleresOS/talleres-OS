# 2.2.0 — Apariencia y edición de piezas — 2026-09-30

- Tema claro/oscuro y dos colores persistentes en la configuración existente.
- Mejor contraste, tarjetas compactas, botones con profundidad y estados táctiles.
- Tarifa de pintor retirada solo del formulario general; valor histórico conservado.
- Menú de pieza con edición, reapertura y eliminación reversible con advertencia de costos.
- Terminar y Asignar empleado siguen visibles; cálculos y pagos sin cambios.
- Piezas retiradas recuperables, sin borrar referencias ni movimientos.
- Sin migración de IndexedDB: se mantiene talleros2 versión 2 y la misma URL.

# 2.1.0 — Fase 2 — 2026-09-30

- Separación entre producción, trabajo terminado, cobro y entrega explícita.
- Comprobantes internos inmutables, impresión/PDF del navegador, descarga y compartir.
- Historial independiente con búsqueda y filtros; bloqueo y reapertura controlada.
- Una única rentabilidad por orden; venta, cobro y mano de obra pendientes diferenciados.
- Cuentas de empleados y pagos conservados; devengos transaccionales sin duplicarse por doble acción.
- Inicio operativo, producción sin órdenes entregadas, navegación móvil con safe-area.
- Inventario independiente con costo promedio, movimientos y stock mínimo.
- Cierre mensual separado por fechas y snapshots históricos inmutables.
- Migración aditiva de talleros2 v1 a v2, respaldo automático, importación y exportación completas.
- Corrección de costos/caja que desaparecían al cancelar o archivar una orden.
- Eliminación de inyecciones de botones mediante MutationObserver y de funciones UI redefinidas.
