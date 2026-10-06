# Auditoría previa · documentos
Cotización: work-ui.mjs/quoteMarkup → customerQuote (domain) → createQuote (work-service); warranty copia settings.warranty, conditions usa quoteConditions o texto del formulario. confirmQuote congela acuerdo y copia garantía a orders.warranty.
Inicial: document-ui.show → documents.documentMarkup; saveOrder crea orders.initialReceipt atómicamente. customerReception fuerza warranty none, aunque Configuración tenga garantía.
Final: mismo renderer que inicial; closeOrder copia orders.warranty al snapshot invoices. Sin cotización confirmada no consulta Configuración. El formulario closingForm usa order.warranty o none; con edición guarda kind custom y label textual sin unidad, causando Duración 6.
Tres snapshots existentes: quotations, orders.initialReceipt, invoices. Cotización usa renderer/HTML/impresión independientes. Final/inicial comparten renderer. No hay garantía de 6 meses hardcodeada; la desconexión está en la elección de fuente y normalización del formulario.
Se omiten VIN/email en snapshots; opcionales imprimen No registrado. CSS de cabecera sobredimensionada y todos los grupos evitan cortes, problemático para múltiples páginas.
No se accede a datos personales para las pruebas. Checkpoint código local y rama codex/documents-3-0 desde d680239d; producción no se modifica durante implementación.
