# Continuar TallerOS — 2026-10-04

Estado actual: **2.5.0 piloto local**, build `2.5.0-assistant-pilot-20261004`; basado en la versión publicada 2.4.1. Leer `docs/ASISTENTE-2.5.0.md`. Diecisiete suites locales aprobadas; resultado final en .test-results/resume-25/suite-results.json. Pendiente conectar Vercel y verificar IA/despliegue real: OpenAI ya responde, pero rechaza por saldo agotado (429 credit_balance_exhausted / insufficient_quota). No afirmar que IA real o Vercel están operativos.

El usuario autorizó explícitamente aplicación y backend en Vercel, conectados al repositorio actual, conservando GitHub Pages y sus datos hasta verificar el nuevo despliegue. Preparar/verificar rama codex/assistant-vercel-2-5-0; no actualizar main ni cambiar URL todavía. El origen nuevo requiere exportar/importar IndexedDB; no hay sincronización cloud. No implementar Modo Empleados ni apps nativas todavía.

Credencial creada mediante flujo seguro con vigencia de 30 días; existe SOLO en `server/.env.local`, ignorada en Git/Vercel/build. No leerla en respuestas, herramientas con salida visible ni copiarla al frontend. Debe transferirse al gestor de secretos de Vercel por un canal privado. `server/.env.example` no contiene secretos.

Migración `full-paint-13-v1` con snapshot, esquema IndexedDB 3. `events` conserva acciones confirmadas del asistente; textos/sesión en memoria. Altas por conversación y avance por piezas implementados; las pruebas de IA/voz usaron mocks explícitos. No repetir el trabajo; revisar docs/ASISTENTE-2.5.0.md. Tests y evidencia: `.test-results/assistant-25`. Copia de código anterior: `local-backups/before-assistant-2.4.1.zip`.

---

Antecedentes conservados:

# Continuar TallerOS — 2026-10-02

Entrega más reciente: **2.4.1**, build **2.4.1-audit-20261002**. Diez suites aprobadas; ver `docs/AUDITORIA-2.4.1.md`. El usuario autorizó expresamente la publicación de esta versión en el GitHub Pages existente después de las pruebas. La prohibición mencionada en los antecedentes siguientes ya fue sustituida por esta autorización. El resultado del despliegue se registra en el informe.

**Publicada y verificada:** https://talleresos.github.io/talleres-OS/index.html. Commit remoto `c01491d190d72d9d4971d4b27f24146dac85386d`; despliegue Pages `37014987860` exitoso. Los 22 hashes públicos coinciden con el build; flujo completo ejecutado sobre la URL real en contexto móvil aislado y consulta offline correcta. No hay errores críticos conocidos. Queda la comprobación física en iPhone/Safari e impresora.

Actualización local más reciente: **2.4.0 — comprobante de recepción y factura final**. Implementada sobre el checkpoint 2.3.0, sin publicación externa. Leer `docs/COMPROBANTES-2.4.0.md` para modelo, flujo, verificación y límites. Continúa IndexedDB `talleros2`, esquema 3. La nueva instantánea de respaldo se agrega al abrir la versión por primera vez.

La recepción inicial queda congelada al crear la orden; sus pagos se registran en el historial real una sola vez. Editar la fecha prevista de la orden no altera la constancia original. Antes de cerrar se revisa la garantía y se genera la factura final.

Los párrafos siguientes conservan la entrega anterior como antecedente.

Proyecto canónico: `C:\Users\Melis\Documents\Codex\TallerOS`.

Base publicada conocida: tag `v2.2.0`, commit `b857f702a3d32a4c075ac49adc42cc495a3c4b69`.
Actualización terminada y probada localmente: **2.3.0**, ampliación de Fase 2.
Punto de recuperación de código: tag local `checkpoint-2.3.0-local`.
Copia de código: `local-backups/TallerOS-2.3.0-local.zip`.

**No se hizo push ni publicación.** La última instrucción del usuario prohíbe publicar externamente y hacer cambios nuevos fuera del proyecto. La URL sigue siendo https://talleresos.github.io/talleres-OS/index.html. No implementar Fase 3.

## Trabajo terminado

Modelo separado de piezas físicas, procesos y asignaciones; selección independiente; carro completo configurable; cálculos por selección; migración segura; cotización/acuerdo; garantía congelada; logo/paleta; constancia y entrega; producción/historial adaptados. Se conserva arquitectura, pagos y módulos existentes.

Las cinco suites pasaron. También la actualización desde el MVP y desde 2.2.0, persistencia al reiniciar navegador, impresión de cotización y revisión móvil. Informe y lista de archivos: `docs/FASE2-2.3.0.md`. Evidencia sintética local: `.test-results/validated-2.3/` (ignorada por Git).

## Pendiente real

- Publicación: requiere nueva autorización expresa, no volver a asumir la anterior.
- Validación en un iPhone físico/Safari y con una copia autorizada de los datos reales: no realizada desde este entorno.
- La garantía real debe configurarse por el taller; no se aplicaron seis meses retroactivamente a datos históricos.

Si después se autoriza publicar, revisar estado Git y el punto local, generar `dist`, publicar exclusivamente el código público en el mismo GitHub Pages y verificar la versión servida. No subir snapshots, perfiles de pruebas ni copias del taller. En una publicación previa el push no inició Pages automáticamente: comprobar el despliegue antes de afirmar que está visible.

La app conserva automáticamente una instantánea antes de migrar el modelo. La copia ZIP es solo del código. No restaurar el código 2.2 directamente sobre una base ya migrada a esquema 3 ni borrar IndexedDB.

## Mensaje para retomar sin publicar

> Continúa TallerOS desde C:\Users\Melis\Documents\Codex\TallerOS. Lee AGENTS.md, CONTINUIDAD.md y docs/FASE2-2.3.0.md, verifica el tag checkpoint-2.3.0-local y el estado actual. Conserva todo lo implementado y los datos. No publiques ni implementes Fase 3 sin mi autorización.
