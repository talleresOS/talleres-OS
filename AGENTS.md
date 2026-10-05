# TallerOS — reglas de continuidad (Independence Release)

## Proyecto y alcance
- Trabajo actual: codex/visual-3-0; consultar docs/VISUAL-3.0.0.md y el encabezado más reciente de CONTINUIDAD.md. dashboard-ui.mjs es presentación de solo lectura; --workshop-image permite cambiar el fondo.
- Repositorio maestro: https://github.com/talleresOS/talleres-OS.
- Producción: https://talleresos.github.io/talleres-OS/index.html, main 3.0.0 publicada y verificada el 05/10/2026; commit f80cc2381b59dc434096600c2f53c50288950fee.
- Código completo 3.0.0 en rama codex/visual-3-0; main mantiene la distribución estática existente. Leer CONTINUIDAD.md y docs/INDEPENDENCE-3.0.0.md antes de actuar. Los informes 2.x son antecedentes.
- No reconstruir, resetear datos ni sustituir funciones existentes. Trabajar incrementalmente y conservar compatibilidad.
- El usuario autorizó preparar app + backend en Vercel como despliegue paralelo. El 05/10/2026 autorizó publicar 3.0 en el GitHub Pages existente: completado. No cambiar URL ni promover Vercel hasta verificar Preview y contar con autorización aplicable. Preparado no equivale a desplegado/probado.
- No usar Sites ni .openai/hosting.json para sustituir el origen existente.
- No desarrollar todavía portal/PIN de empleados, multi-taller, sincronización cloud ni módulos SaaS.

## Estructura
- Vanilla HTML/CSS/ES modules: app.js/work-ui.mjs; cálculos en domain.mjs/work-model.mjs.
- Toda escritura operativa pasa por service.mjs/work-service.mjs y una transacción de storage.mjs. Respetar órdenes y cuentas cerradas.
- IndexedDB talleros2 **esquema 3**, auxiliar histórica talleros2-ledger conservada. App 3.0 no cambia el esquema.
- backup.mjs valida y sella el envoltorio de respaldo; storage gestiona preview, stale guard y recuperación atómica.
- documents.mjs, documents-style.mjs y document-ui.mjs son exclusivos de documentos del cliente.
- assistant-*.mjs: contrato, resolución local, acciones controladas, proveedor, UI y voz. server/*.mjs y api/assistant.mjs: backend.
- scripts/dev.mjs sirve solo dist; prepare-release.mjs genera lista pública; scripts/check-release.mjs verifica hashes/versiones/secretos.

## Invariantes
- orders.initialReceipt es una instantánea creada atómicamente con el primer pago real. Mostrar documentos nunca agrega pagos.
- Nunca incluir costos, salarios, empleados, rentabilidad ni notas internas en comprobantes/facturas.
- vehiclePieces son piezas físicas; workAssignments procesos/asignaciones; quotations cotizaciones. No reutilizar parts.assignments como fuente duplicada de trabajos migrados.
- Las cantidades nuevas provienen de selectedPieceIds. Pintura completa selecciona 13 piezas estándar y permite editar esa selección.
- Históricos sin nombres conservan unspecifiedQuantity e importes originales. No inventar piezas, fechas ni recalcular devengos protegidos.
- sourceAssignmentId evita duplicar devengos al terminar/reabrir/restaurar. Pagar empleados no añade otro costo.
- addReceptionWorks es el constructor compartido de recepción/trabajos adicionales. assignWorkSelection conserva el resto; workSelectionState solo divide tarifas por pieza sin devengos y usa setWorkState/accrueWork.
- Cotizaciones, acuerdos, comprobantes y garantías son instantáneas. Editar Configuración no cambia documentos antiguos.
- No confundir venta con cobro. Conservar numeración REV máxima durante recuperaciones.
- No eliminar campos desconocidos, IDs originales ni datos históricos.

## Protección de datos
- Antes de modificar almacenamiento o finanzas: respaldo de datos si hay acceso autorizado y checkpoint de código. No acceder al perfil personal para generar datos de prueba.
- Migraciones aditivas, transaccionales e idempotentes; probar relaciones, pagos, documentos y numeración antes/después y tras reabrir.
- Nunca borrar IndexedDB para arreglar una migración.
- Restaurar datos requiere validación, resumen y confirmación explícita del usuario de la app. No saltarse esa confirmación ni quitar hashes para aceptar un archivo corrupto.
- Un ZIP de código no es un respaldo del taller. Datos son locales por navegador/origen; cambio de URL no los transfiere.
- No publicar copias JSON del taller, perfiles de pruebas, snapshots reales ni local-backups.

## Seguridad IA
- OPENAI_API_KEY solo del servidor. server/.env.local puede contener una credencial real: nunca imprimirla, leerla en resultados visibles ni subirla.
- .env.example y server/.env.example contienen SOLO nombres vacíos.
- Ninguna variable pública, JS del navegador, settings, localStorage o IndexedDB puede contener la clave.
- El modelo devuelve intenciones de la lista permitida; no tiene escritura directa en la base. Toda modificación se valida, confirma e identifica de manera idempotente.
- No generar llamadas automáticas, reintentos sin límite ni múltiples envíos. Mantener timeouts, límites y deduplicación.
- Contadores en memoria son por instancia, no presupuesto global garantizado. No prometer lo contrario.
- Errores del proveedor se traducen a mensajes fijos; nunca devolver el error crudo con datos privados.
- Probar con proveedores sintéticos por defecto. Llamadas reales pueden consumir saldo; no contratar/pagar sin autorización. La última real conocida falló por insuficiente saldo.
- IA caída o no configurada nunca debe bloquear funciones normales del taller.

## Comandos independientes
- Node 24; npx --yes pnpm@11.25.0 install --frozen-lockfile.
- npx --yes pnpm@11.25.0 exec playwright install chromium (Linux: --with-deps).
- npm run dev (no necesita Codex ni API key).
- npm run build; npm run check:release; npm test; npm run test:runtime.
- TALLEROS_BROWSER opcional para un ejecutable instalado; TALLEROS_PLAYWRIGHT opcional, no requisito. TALLEROS_TEST_OUTPUT dentro de .test-results.
- 20 suites actuales + runtime; las migraciones usan tests/fixtures con SHA-256, no tags Git. ui-refresh/ui-upgrade son archivos históricos 2.2, fuera de la suite vigente.
- Modificar la raíz y regenerar dist; nunca editar ambas copias a mano. Solo dist es público.
- No imprimir/cargar archivos secretos en auditorías. Escanear listas explícitas de código público y metadatos, sin mostrar valores.

## Git y entrega
- Inspeccionar estado/remotos antes de cambiar. No resetear trabajo previo ni hacer force-push.
- Crear/reutilizar rama codex/ apropiada, commits lógicos, pruebas antes de publicar, preservar punto estable.
- El checkout histórico de esta máquina tiene un Git local antiguo y origin hacia otro directorio local; no representa main remoto. No hacer push desde él sin corregir conscientemente la vinculación. En esta fase se usan commits de rama mediante GitHub y verificación de una descarga limpia.
- Mantener version.json, CHANGELOG, CONTINUIDAD y docs/LOCATION.md. Para publicar Vercel seguir docs/DEPLOYMENT.md.
- Verificar SHA/build servido, caché, URL, móvil y recuperación antes de afirmar éxito remoto.
- Entregar pruebas reales, límites y pasos externos pendientes; compilar no basta.
