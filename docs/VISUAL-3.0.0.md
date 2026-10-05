# TallerOS 3.0 — actualización visual
Build: 3.0.0-visual-20261005b. Rama: codex/visual-3-0. Base estable: 935a4dad49339761691f4057722fc92092f20d12.
Estado: verificaciones locales aprobadas; publicación y verificación remotas se registran al final.

## Qué ya estaba hecho
Piezas físicas y procesos independientes; pintura completa selecciona 13 piezas editables; asignación parcial por empleado; devengos idempotentes; recepción y factura final; garantías; respaldos validados; asistente local con consultas/acciones confirmadas, contexto y voz del navegador. No se reimplementaron.

## Cambios
- dashboard-ui.mjs: presentación de métricas/procesos con los cálculos existentes; iconos SVG; búsqueda de clientes/vehículos/órdenes.
- app.js: shell común, navegación, Inicio y accesos a vehículos/pagos/gastos existentes. Los formularios, servicios y transacciones operativas permanecen iguales.
- interface.css: tokens de superficies glass, fotografía integrada, jerarquía, tarjetas/botones, temas claro/oscuro y adaptación móvil.
- workshop-background.webp: fotografía generada sin marcas, 170258 bytes, 1536×1024. Logo/nombre/paleta continúan en Configuración; el fondo usa el token CSS --workshop-image y puede sustituirse sin tocar datos. No se añadió un campo de configuración.
- index.html, prepare-release.mjs, sw.js, version.json: recurso precargado, distribución de 32 archivos y nuevo identificador de caché. Se conserva el aviso y la espera al cierre de pestañas.
- scripts/dev.mjs y servidores de pruebas: MIME WebP.
- tests/visual.mjs y package.json: regresión del dashboard real, búsqueda, cancelar un pago sin escribir, vistas y persistencia del tema. Actualizadas expectativas de título/caché y listado de recursos en pruebas previas.
No se modificaron domain.mjs, storage.mjs, service.mjs, work-model.mjs, work-service.mjs ni los tres módulos de documentos. IndexedDB sigue esquema 3; ninguna migración nueva.

## Pruebas
20 suites existentes/nueva aprobadas mediante pnpm test. Runtime independiente y check:release aprobados.
Flujo completo: cliente → vehículo → orden/abono → comprobante → piezas/procesos/empleados → producción → costos/pagos → garantía → cierre → factura → historial.
Pruebas de recuperación desde versiones 2.2/2.3, persistencia al cerrar navegador, respaldo/restauración y caché offline aprobadas.
Dashboard: 12 vistas × 6 anchos (320,375,390,430,1280,1440) × 2 temas sin desbordes; capturas revisadas. Se corrigió el margen heredado que desalineaba los paneles y el peso de etiquetas secundarias. El buscador móvil conserva 16 px para evitar ampliación automática de campos al enfocarlos en iPhone.
Las suites también verifican 13 piezas editables, pago por pieza, asistente con confirmación, altas, avance parcial, errores externos y operación sin clave.
Las pruebas usan contextos aislados y datos sintéticos. No se accede al perfil personal ni se borran datos reales.

## Límites pendientes
iPhone/Safari físico y micrófono real requieren prueba del propietario. El backend Vercel y una llamada real con saldo OpenAI siguen pendientes externos, documentados en INDEPENDENCE-3.0.0.md. Los mocks no certifican un proveedor real. No se creó portal de empleados.

## Imagen
Herramienta: image_gen.imagegen integrada; no llamadas con la clave privada del proyecto.
Prompt de diseño: fotografía realista de un taller automotriz premium, grafito oscuro e iluminación cálida dorada, SUV negro a la derecha con técnico trabajando, espacio oscuro a la izquierda para titulares, sin logos, texto ni interfaz. Optimización a WebP con Sharp, sin alterar el contenido.
Artefacto original: generated_images/01a0fa0e-ba7d-74d1-ae98-6d20c24abef7/exec-d94d48ba-3d66-4439-9ac8-84d1a2147486.png.
