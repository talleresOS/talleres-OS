# TallerOS / RevivAuto — proyecto canónico

- URL de producción: https://talleresos.github.io/talleres-OS/index.html
- Repositorio de producción: https://github.com/talleresOS/talleres-OS (main).
- Esta carpeta contiene el código canónico. No crear otra aplicación ni publicar en otro origen sin una solicitud expresa.
- La vinculación histórica .openai/hosting.json corresponde a un Site sin publicación. No usar Sites para sustituir esta URL de GitHub Pages.
- Código local 2.5.0 piloto (producción GitHub Pages 2.4.1); IndexedDB: talleros2 versión 3 (número de esquema, no Fase 3). La migración conserva los stores principales y la base auxiliar anterior.
- Comprobante inicial: orders.initialReceipt es una instantánea creada atómicamente con el primer pago real. No regenerar pagos al mostrar documentos. documents.mjs usa solo datos permitidos para el cliente; document-ui.mjs conecta los formularios. Informe: docs/COMPROBANTES-2.4.0.md.
- Piezas físicas: vehiclePieces. Procesos/asignaciones: workAssignments. Cotizaciones: quotations. No volver a usar parts.assignments como fuente duplicada de trabajos migrados.
- La cantidad nueva proviene de selectedPieceIds. Las asignaciones históricas sin nombres conservan unspecifiedQuantity y sus importes originales. No inventar piezas ni recalcular devengos históricos.
- work-service.mjs amplía el servicio transaccional. sourceAssignmentId evita duplicar devengos al terminar/reabrir/restaurar. Pagos de empleados no son costos adicionales.
- Antes de cambiar almacenamiento o finanzas: respaldo, migración aditiva e idempotente, pruebas de relaciones, pagos y numeración REV. Nunca borrar IndexedDB para resolver una migración.
- Toda escritura de la app pasa por service.mjs y una transacción de storage.mjs. Respetar bloqueo de órdenes cerradas y cuentas cerradas.
- domain.mjs concentra los cálculos. No duplicar mano de obra al pagar empleados. No confundir venta con cobro.
- Nunca incluir costos, salarios, rentabilidad ni notas internas en un comprobante de cliente.
- No inventar fechas históricas. Mantener campos desconocidos y claves originales.
- Modificar la raíz y ejecutar node prepare-release.mjs para sincronizar dist. No editar ambas copias por separado.
- Pruebas: npm test (modelo, UI, migración desde tag v2.2.0, regresiones Fase 2 y casos extremos). TALLEROS_PLAYWRIGHT y TALLEROS_BROWSER permiten señalar los ejecutables instalados; TALLEROS_TEST_OUTPUT debe apuntar a .test-results dentro del proyecto. Los scripts ui-refresh y ui-upgrade son pruebas históricas de 2.2.0.
- Cotizaciones, acuerdos y garantías son instantáneas. No cambiar documentos antiguos al editar Configuración. No implementar Cloud/PIN/multitaller en esta fase.
- Estado de entrega y continuidad: CONTINUIDAD.md y docs/AUDITORIA-2.4.1.md. El usuario autorizó publicar esta versión después de la auditoría completa en el GitHub Pages existente. No cambiar el origen ni incorporar módulos experimentales.
- Mantener version.json, changelog y ficha de ubicación. Crear una versión identificable en Git antes de publicar.
- Publicar exclusivamente los archivos públicos de dist. Nunca subir copias JSON del taller, perfiles de pruebas, credenciales ni snapshots con datos reales.

- Nueva autorización 2026-10-03: preparar despliegue paralelo de aplicación + backend privado en Vercel, conectado al mismo GitHub. Mantener main/URL de producción intactos hasta comprobar Vercel. Ver docs/ASISTENTE-2.5.0.md. No confundir despliegue preparado con probado.
- server/.env.local contiene una credencial privada. Nunca leer su valor en salidas ni subirlo. Solo dist es público; api/ y server/*.mjs son código de backend, con secretos proporcionados por el servidor.

- Continuación 2026-10-04: Pintura completa editable; assignWorkSelection conserva el resto; workSelectionState divide solo tarifas por pieza sin devengos y usa setWorkState/accrueWork. addReceptionWorks es el constructor compartido de Nueva orden y trabajos adicionales. No duplicarlo.
- Altas del asistente confirmadas e idempotentes; esquema 3 sin migración nueva. Pruebas adicionales: assignment-consolidation y assistant-intake. OpenAI responde 429 credit_balance_exhausted (falta saldo API), Vercel todavía requiere conexión. Verificar estado externo antes de publicar; no actualizar main.
