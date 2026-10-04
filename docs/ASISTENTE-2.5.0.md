# TallerOS 2.5.0 — piloto sobre 2.4.1

Fecha: 4 de octubre de 2026. Build `2.5.0-assistant-pilot-20261004`.

## Estado verificable

Implementación y pruebas locales terminadas. La instalación pública existente continúa en 2.4.1 y la misma URL. La nueva publicación en Vercel está preparada, **pendiente de conectar la cuenta y de verificar el despliegue real**. No se sustituyó `main`, no se trasladaron datos reales y no se cambió la URL.

La clave OpenAI “TallerOS” fue creada mediante el flujo seguro autorizado, con vigencia solicitada de 30 días (2,592,000 segundos). Se guardó exclusivamente en `server/.env.local`, fuera de Git y de los archivos públicos. Nunca copiar este archivo a GitHub. La conexión real se verificó el 4 de octubre: OpenAI respondió HTTP 429, código `credit_balance_exhausted`, tipo `insufficient_quota`. La red ya permite conectar; falta saldo en el proyecto API. No se ha verificado interpretación real con esa cuenta. No crear otra clave para resolver un saldo agotado.

## Piezas y compatibilidad

- “Pintura completa” se expande al catálogo existente de **13 piezas físicas**, con todos los procesos seleccionados. No es una pieza virtual ni un multiplicador visual.
- Acceso rápido en Nueva orden, selector de piezas y asignaciones. La configuración histórica opcional de “Carro completo” se conserva como selección personalizable independiente.
- 13 × RD$400 = RD$5,200. Producción, devengos, costos, empleado e historial usan los IDs y cantidades reales existentes.
- Asignar solo cuatro puertas de un proceso todavía sin empleado deja nueve piezas pendientes y crea un trabajo de cuatro piezas. No duplica selección ni afecta devengos previos.
- La búsqueda por palabras evita que “puerta” incluya “compuerta”; grano 480 tampoco coincide con 4800.
- Migración transaccional e idempotente `full-paint-13-v1`, con snapshot completo `before-full-paint-13-v1`. Expande registros pendientes explícitamente llamados Pintura completa que pueden corregirse sin tocar importes ya devengados.
- Órdenes cerradas, trabajos terminados, devengos y pagos históricos no se recalculan. Se agrega un aviso visible para revisar registros históricos que representaban pintura completa con cantidades antiguas. Comprobantes, acuerdos y facturas previos permanecen congelados.
- IndexedDB sigue en esquema **3**, mismos stores, IDs, numeración REV y base auxiliar. La actividad del asistente usa `events`; la dirección del servidor usa `settings.assistant.endpoint`. La conversación y credencial de sesión solo viven en memoria.

## Asistente

Panel independiente que conserva la pantalla y los formularios actuales. En móvil se abre desde abajo, con desplazamiento propio y espacio para teclado/áreas seguras. Acceso flotante, tarjetas compactas, consultas rápidas sin red, conversación por texto y micrófono.

Flujo: mensaje → proveedor de interpretación → intención estructurada y validada → resolución local contra datos reales → consulta o propuesta → confirmación explícita → servicios existentes en una única transacción → evento de actividad.

El modelo NO recibe la base del taller, no ejecuta código y no escribe IndexedDB. Se envían al backend y OpenAI mensajes recientes (máximo 12), fecha local y la intención pendiente cuando falta un dato. Los importes de tarjetas se calculan localmente mediante `domain.mjs`, no mediante texto del modelo. No enviar datos innecesarios en los mensajes.

Acciones disponibles:

| Consulta inmediata | Cambio que requiere Confirmar |
| --- | --- |
| Estado, balance, costos y utilidad de una orden | Abono con monto, fecha y método |
| Órdenes pendientes, atrasadas y entregas de la semana/fecha | Costo de materiales u otros costos asociado a una orden |
| Trabajos sin terminar | Crear producto o registrar entrada de inventario |
| Saldo de un empleado | Asignar proceso/piezas a empleado por tarifa por pieza |
| Venta del mes, cobros y cuentas por cobrar | Iniciar o terminar trabajos por piezas |
| Inventario completo, por producto y en mínimo | Crear cliente, vehículo, orden/comprobante y agregar trabajos |

Ante varios Toyota, empleados o productos se pide elegir. Ante un dato faltante se pregunta solo por él. El contexto conserva el vehículo de la conversación; una referencia nueva explícita no se sustituye silenciosamente por el vehículo anterior.

Cancelar no escribe. Una propuesta vence en diez minutos y se invalida si cambian los datos relacionados antes de confirmar (esta primera implementación invalida ante cambios en cualquiera de las colecciones operativas). El identificador de la acción impide duplicación, incluso con confirmaciones simultáneas. Las validaciones originales de órdenes/cuentas cerradas, balances y existencias siguen vigentes. El historial conserva el resultado confirmado, sin la conversación completa.

No hay eliminación por IA, cierre automático de órdenes, cambio de precios, pago de empleados ni asignación sobre trabajos ya asignados/devengados. Se puede iniciar o terminar una selección concreta de un grupo por pieza: el servicio divide el grupo atómicamente, conserva el resto y devenga únicamente lo terminado. Los grupos con monto fijo o importes históricos requieren actualizar el grupo completo; no se prorratean importes históricos. No se implementó el futuro Modo Empleados ni permisos/login individuales.

## IA y voz

Proveedor implementado: **OpenAI Responses API**, modelo configurable `OPENAI_MODEL`, predeterminado `gpt-4.1-mini`. Salida JSON estricta, `store:false`, una intención por mensaje, máximo 2,000 tokens de salida y timeout. Contrato desacoplado en `assistant-contract.mjs`; proveedor servidor separado en `server/openai-provider.mjs`.

Voz: adaptador Web Speech del navegador, idioma `es-DO`. El dictado llena el campo para revisión antes de Enviar. No se carga audio en TallerOS ni se habilita transcripción facturada de OpenAI. Si falta soporte o permiso, se explica y se permite escribir o usar el dictado del teclado. La disponibilidad, procesamiento externo y privacidad de ese reconocimiento dependen del navegador. Micrófono real/Safari/iPhone siguen pendientes; las pruebas automatizadas usan un adaptador simulado.

Referencias técnicas oficiales consultadas: [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs), [modelo y precios](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [funciones Node en Vercel](https://vercel.com/docs/functions/runtimes/node-js).

## Interfaz

`interface.css` mejora la presentación existente: botones con jerarquía y esquinas suaves, eliminación de sombras/bordes pesados, campos ligeros, tarjetas y espacios coherentes, tipografía del sistema, estados táctiles/foco y movimiento reducido. Reutiliza los tokens claro/oscuro y los colores del taller. Las facturas mantienen sus estilos dedicados.

## Seguridad y despliegue Vercel

`vercel.json`: build desde raíz, salida pública `dist`, API privada `/api/assistant/{session,interpret}`, Node 24, sin dependencias de runtime externas. `api/assistant.mjs` adapta el mismo servicio al entorno serverless. No se sirve la raíz del repositorio como carpeta pública. `.gitignore`, `.vercelignore` y `excludeFiles` protegen los archivos privados; el build rechaza posibles claves y archivos inesperados en dist.

El servidor exige un código del propietario independiente de la API key; genera una sesión firmada de doce horas, vinculada al origen y conservada solo en memoria del navegador. Funciona entre instancias serverless. Cambiar el código privado invalida sesiones anteriores. CORS permite únicamente orígenes configurados y las URLs propias proporcionadas por Vercel. No usar comodines ni un proxy abierto.

Variables privadas de Vercel: `OPENAI_API_KEY`, `ASSISTANT_ACCESS_CODE` (secreto aleatorio de al menos 12 caracteres; usar 24 o más), opcional `OPENAI_MODEL`, `ASSISTANT_ALLOWED_ORIGINS`, `ASSISTANT_DAILY_LIMIT`. No usar prefijos públicos. El código no contiene valores reales de estas variables. Los secretos deben configurarse directamente en Vercel mediante un canal privado, nunca en GitHub.

Los límites internos (12 solicitudes/minuto, 2 simultáneas, 250/día por defecto) son **por instancia**, no un tope económico global en serverless. Antes del uso sostenido configurar límites de proyecto OpenAI y reglas de Vercel Firewall para `/api/assistant/*`, especialmente intentos de conexión. No se afirma que esas reglas remotas estén instaladas. No se ha contratado un plan de pago ni habilitado un servicio adicional.

Costos posibles: tokens de OpenAI y alojamiento/funciones de Vercel según sus planes y consumo. La suscripción de ChatGPT no configura el presupuesto de esta API. Esta implementación no añade cobro de OpenAI por voz. Consultar precios actuales antes del piloto prolongado; no hay un costo mensual fijo verificado.

## Traslado sin pérdida

IndexedDB pertenece al origen. El mismo repositorio o cuenta no comparte automáticamente la base entre GitHub Pages, Vercel, Safari y una aplicación nativa.

1. Conservar GitHub Pages 2.4.1 y exportar todos los datos desde el navegador que contiene los registros reales.
2. Verificar Vercel con datos sintéticos, IA real, iPhone, ambas facturas, recarga/offline y todos los hashes del build.
3. Importar la copia en una instalación Vercel vacía; comparar cantidades de órdenes/clientes/pagos, balances, REV, documentos y garantías. La importación conserva una recuperación previa local.
4. Elegir un único origen operativo después de esa verificación. No operar simultáneamente ambas instalaciones esperando sincronización.
5. No borrar el navegador original ni cambiar la URL habitual hasta completar el traslado.

Para App Store/Google Play, los adaptadores de proveedor/voz y el backend HTTP podrán reutilizarse. Empaquetado nativo, permisos de plataforma, firma, migración al almacenamiento de la app, cuentas de desarrollador y revisiones de tiendas son trabajo posterior; no se publicaron apps nativas ni se prometió aceptación por las tiendas.

## Pruebas y límites actuales

Resultado del 4 de octubre: **17/17 suites aprobadas**, cero fallos en la ejecución final. Build público regenerado: 29 archivos, sin secretos ni backups.

Diecisiete suites locales: las diez de 2.4.1, `assistant`, `assistant-ui`, `assistant-server`, `assistant-safety` `vercel`, `assignment-consolidation` y `assistant-intake`. Se ejecutaron modelos, UI, migraciones reales desde 2.2/2.3, finanzas, empleados, inventario, cierres, backup/importación, persistencia tras cierre de navegador, caché/offline y documentos PDF.

Caso nuevo por interfaz: cliente/vehículo → orden Pintura completa 13 → abono20,000/comprobante → abono5,000 con cancelación y confirmación → lija480, 10×65 → materiales1,500 → pintura13×400 a Carlos → terminar → pago35,000 → garantía → factura PAGADO → historial y recarga. El caso original Mario20,000+40,000 continúa aprobado sin duplicar el abono. Ochenta combinaciones de pantallas/tamaños/temas en la prueba nueva, más las revisiones originales.

Errores encontrados/corregidos en esta etapa: búsqueda “puerta” que incluía compuerta; soporte de selección parcial de un proceso sin empleado; whitelist de pruebas de actualización que necesitaba los nuevos módulos; recuento de snapshots actualizado por el nuevo respaldo. Registros financieros originales y diseño de facturas conservados.

**Límites explícitos:** pruebas del proveedor con respuestas controladas, no interpretación real; la conexión real a OpenAI respondió falta de saldo de la API. Falta conectar Vercel, transferir secretos de forma privada, desplegar/verificar el build y probar en iPhone/micrófono/impresora físicos. Ningún resultado simulado se presenta como una prueba real de OpenAI o Vercel.

## Continuación del 4 de octubre

Ya estaban terminados el sistema de documentos 2.4.1, la migración de pintura completa, el panel del asistente, el backend seguro y el rediseño general. Faltaban la edición directa de las 13 piezas al crear, la asignación parcial desde formularios, altas operativas por conversación y el despliegue real.

Ahora el botón o la selección de Pintura completa abre las 13 filas del catálogo existente, editables y sin duplicarlas al repetir. Seleccionar cuatro puertas en Asignar empleado conserva las restantes sin asignar. Una misma pieza admite procesos distintos, pero no se puede duplicar el mismo proceso activo ni restaurarlo encima de otro. Corregir una pieza permite retirarla de sus procesos pendientes; se recalculan tarifas por pieza, se conservan montos fijos restantes y se bloquea ante devengos/trabajos terminados. El comprobante original nunca se reescribe.

Altas del asistente: client.create pide nombre/teléfono; vehicle.create resuelve el cliente y conserva año/color/matrícula; order.create pide precio, entrega, piezas/procesos y abono (incluido cero explícito). Confirmar crea atómicamente la orden, primer pago real y comprobante y abre el documento. El contexto conserva cada entidad recién creada. work.add agrega piezas/procesos mediante el mismo constructor transaccional de Nueva orden, sin cambiar precio ni comprobantes previos. Cada alta y modificación se confirma y registra en events.

Avances: work.start y work.finish seleccionan piezas específicas. Prueba: bonete de una pintura completa, 1 × RD$400 devengado y 12 pendientes; al terminar el resto, RD$5,200 en total. Identificar piezas históricas sin nombre sigue permitido conservando importes; cambiar las piezas de un devengo ya identificado queda protegido.

Pruebas nuevas: cliente → vehículo → orden mediante panel, preguntas cortas, cancelación sin escritura, contexto, comprobante 60,000/20,000/40,000, avances parciales, alta adicional de trabajo, cobro final, garantía, factura, backup/importación y recarga. Selección editable 13→12, asignación 4+8, procesos distintos, duplicados, retiro atómico y protección de devengos. Proveedor de interpretación controlado en estas pruebas; no equivale a IA real. Evidencia local: .test-results/resume-25.

Regresiones encontradas en la revisión: la protección añadida bloqueaba identificar el proceso de una cantidad histórica sin nombres; se conservó esa excepción existente. La prueba de aviso de actualización dependía de un nombre de caché sin build; ahora obtiene el identificador efectivo. Los errores de falta de crédito y límite temporal de OpenAI tienen mensajes diferentes.

Sin nueva migración ni stores en esta continuación. Se reutiliza el esquema 3, con campos aditivos splitFromId en grupos divididos y context en eventos del asistente. Respaldo previo de código (sin secretos): local-backups/before-resume-20261004.zip.

Archivos de esta continuación: work-service.mjs, work-ui.mjs, service.mjs, document-ui.mjs, app.js, assistant-contract.mjs, assistant-core.mjs, assistant-service.mjs, assistant-ui.mjs, server/openai-provider.mjs; las pruebas nuevas assignment-consolidation.mjs y assistant-intake.mjs; ajustes de assistant-server, assistant-safety, assistant-ui, work-migration, documents-upgrade y update-notice; package.json, version.json, sw.js, documentación y dist regenerado.

Pendiente: conectar Vercel (plugin todavía no instalado/conectado al comprobar), transferir secretos por canal privado, habilitar saldo del proyecto OpenAI, comprobar interpretación real, publicar un preview y verificarlo en iPhone/Safari con micrófono real. La credencial existente tiene duración limitada; verificar vigencia antes de desplegar. No hay URL Vercel verificada ni cambio en main/producción.

## Archivos de esta etapa

Nuevos: `assistant-contract.mjs`, `assistant-core.mjs`, `assistant-service.mjs`, `assistant-provider.mjs`, `assistant-voice.mjs`, `assistant-ui.mjs`, `interface.css`, `server/server.mjs`, `server/openai-provider.mjs`, `server/.env.example` (sin clave), `api/assistant.mjs`, `vercel.json`, `.vercelignore`, cinco suites nuevas y este informe.

Modificados: `work-model.mjs`, `work-service.mjs`, `work-ui.mjs`, `service.mjs`, `storage.mjs`, `document-ui.mjs`, `app.js`, `index.html`, `.gitignore`, `domain.mjs` (versión), `package.json`, `version.json`, `sw.js`, `prepare-release.mjs`, `tests/harness.mjs`, `tests/phase2.mjs`, `tests/work-migration.mjs`, `tests/documents-upgrade.mjs`, README/changelog/continuidad. `dist` se regenera, no se edita por separado. Respaldo local de código previo: `local-backups/before-assistant-2.4.1.zip`.
