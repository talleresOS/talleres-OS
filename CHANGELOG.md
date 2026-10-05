# 3.0.0 — publicación GitHub Pages · 2026-10-05

- Publicada en la misma URL; commit main 935a4da, despliegue Pages 37308159560 exitoso.
- 30 hashes verificados y flujo completo móvil/offline sobre la URL real, sin errores JS.
- Sin nuevas funciones ni rediseño adicional al retomar; datos/esquema/origen preservados.
- Backend/IA real pendientes; consultas locales y operación normal disponibles.

# 3.0.0 — Independence Release · 2026-10-04 (rama, sin publicación)

- Respaldos completos versionados con integridad, resumen previo, restauración confirmada y recuperación anterior.
- Errores IA seguros, límites configurables, timeout y deduplicación; aplicación operativa sin API.
- Runtime Node independiente, build verificable y pruebas históricas reproducibles sin tags locales.
- Documentación de arquitectura, datos, despliegue, respaldo y recuperación; ejemplos de entorno vacíos.
- 19 suites más runtime aprobadas; esquema 3 y producción 2.4.1 conservados. Vercel/IA real pendientes de acceso externo.

# 2.5.0 piloto — continuación 2026-10-04 (publicación pendiente)

- Pintura completa editable antes de guardar; asignación parcial conserva los trabajos restantes.
- Protecciones contra procesos duplicados y retiro seguro de piezas sin devengos.
- Altas de clientes, vehículos, órdenes/comprobantes y trabajos por asistente con confirmación.
- Avance de piezas concretas sin perder el resto ni duplicar devengos.
- Build 2.5.0-assistant-pilot-20261004; 17 suites de regresión. OpenAI real requiere saldo API, Vercel requiere conexión.

# 2.5.0 piloto — 2026-10-03 (local; Vercel pendiente)

- Pintura completa: 13 piezas reales, respaldo/migración idempotente; registros devengados protegidos.
- Asistente modular con consultas locales, interpretación OpenAI del lado servidor, contexto, tarjetas, voz del navegador y confirmación transaccional/idempotente de cambios.
- Asignación de subconjuntos no asignados; búsqueda de puertas sin incluir compuerta.
- Interfaz móvil clara/oscura renovada sin cambiar facturas.
- Vercel: frontend dist + función privada, credencial fuera de Git; nueva publicación aún no ejecutada. GitHub Pages 2.4.1 permanece intacto.
- Quince suites en la entrega anterior; ver continuación del 4 de octubre para estado actual. Ver docs/ASISTENTE-2.5.0.md.

# 2.4.1 - Auditoría final y estabilidad móvil - 2026-10-02

- Corregido el desbordamiento de nombres largos en tarjetas, cabeceras e historial, sin ocultar texto.
- Áreas táctiles de procesos de recepción de al menos 44 px.
- Mensajes específicos al crear/editar órdenes y clientes, registrar pagos, terminar trabajos y generar factura final.
- Comprobación explícita del service worker y aviso de actualización pendiente; conserva formularios abiertos y cambia de caché al cerrar todas las pestañas.
- Corregida una carrera en la prueba de producción: espera el estado renderizado antes de comprobarlo.
- Diez suites aprobadas; caso completo con costos, pagos de empleados, respaldo/importación y cierre mensual; 13 vistas a 320/375/390/430/1280 px.
- Sin cambios en cálculos financieros, relaciones, esquema IndexedDB ni diseño de facturas.

# 2.4.0 - Comprobante inicial y factura final - 2026-10-01 (local, sin publicar)

- Nueva orden con piezas/procesos, fecha estimada, condiciones y observaciones de recepción separadas.
- Abono inicial real e idempotente, guardado atómicamente con la orden y su comprobante.
- Dos documentos independientes inspirados en la referencia, logo/colores configurables, agrupación por proceso y datos exclusivamente del cliente.
- Garantía por orden con duración, fechas y condiciones revisadas en el cierre; historial de pagos y estado PAGADO en factura.
- Vista móvil, impresión carta, PDF del navegador y compartir con enlace WhatsApp/archivo.
- Marca de agua decorativa en zonas vacías y vistas principales con pocos registros.
- Respaldo aditivo e idempotente; mismo esquema IndexedDB 3, sin cambiar registros históricos.
- Ocho suites de prueba y revisión visual de PDF. Informe: docs/COMPROBANTES-2.4.0.md.

# 2.3.0 - Piezas y procesos independientes - 2026-10-01 (local, sin publicar)

- Piezas físicas por orden, catálogo editable y carro completo configurable.
- Procesos con empleado, selección de piezas, cantidad derivada y estado propios.
- Migración aditiva al esquema 3 con snapshot; cantidades antiguas sin nombres permanecen sin especificar, conservando importes y pagos.
- Devengos idempotentes; reapertura, retiro y restauración conservan trazabilidad y no duplican costos.
- Cotizaciones, acuerdos de precio con historial, garantía congelada y WhatsApp con descarga explícita.
- Constancia de entrega con piezas, procesos, garantía y área de firma física.
- Logo en Inicio/documentos y paleta automática reutilizando temas existentes.
- Producción, Empleados e Historial adaptados; selector y modal compactos para móvil.
- Pruebas de modelo, interfaz, migración 2.2, regresiones, PWA y persistencia completadas.
- Fase 3 no implementada. Publicación pendiente por instrucción expresa.

# 2.2.0 - Apariencia y edición de piezas - 2026-09-30

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
