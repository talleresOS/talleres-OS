# Asistente: operación, seguridad y límites

## Arquitectura

Frontend → /api/assistant/session e /interpret → backend Node → OpenAI Responses API. Modelo predeterminado gpt-4.1-mini; OPENAI_MODEL permite cambiarlo por uno compatible con salida estructurada. El servidor solicita una intención JSON y la valida. La app resuelve los datos locales y ejecuta exclusivamente servicios permitidos.

No hay conexión a ChatGPT Plus/Codex en tiempo de ejecución. Sin API, el taller y las consultas rápidas siguen disponibles.

## Credenciales

OPENAI_API_KEY solo existe en variables del servidor o en server/.env.local ignorado para desarrollo. Nunca guardarla en settings, localStorage, IndexedDB, dist, GitHub ni variables públicas. La app recibe un token de sesión temporal tras introducir un código privado distinto de la API key. El token dura hasta 12 horas, queda en memoria y está ligado al origen. Rotar ASSISTANT_ACCESS_CODE invalida sesiones.

CORS admite orígenes explícitos; Vercel agrega sus URL configuradas. No es una frontera contra clientes no navegador: la autenticación y los límites siguen siendo necesarios. Los errores no devuelven mensajes crudos del proveedor ni credenciales. No se imprime el código de acceso al iniciar el servidor.

## Variables de servidor

| Variable | Predeterminado / uso |
| --- | --- |
| OPENAI_API_KEY | Sin valor: IA desactivada; app operativa |
| OPENAI_MODEL | gpt-4.1-mini |
| ASSISTANT_ACCESS_CODE | Privado, al menos 12 caracteres; usar un secreto aleatorio largo |
| ASSISTANT_ALLOWED_ORIGINS | https://talleresos.github.io; lista de orígenes sin ruta separados por coma |
| ASSISTANT_ENABLED | false desactiva IA; sin valor se habilita solo si hay clave y código válidos |
| ASSISTANT_DAILY_LIMIT | 250 intentos al proveedor por instancia / ventana móvil de 24 h |
| ASSISTANT_MINUTE_LIMIT | 12 por instancia / 60 s; máximo configurable 120 |
| ASSISTANT_MAX_CONCURRENT | 2 por instancia; máximo configurable 10 |
| HOST / PORT | API local sola: 127.0.0.1 / 8787 |
| DEV_PORT | App local: 4173 |

Cero en un límite bloquea solicitudes. Valores malformados usan el predeterminado. Cambios en Vercel requieren un nuevo despliegue. No poner valores reales en los archivos .env.example.

Para el servidor local combinado, introducir http://localhost:4173/api/assistant en Conexión. Para la API local sola usar http://localhost:8787. En móvil no utilizar localhost del teléfono: se necesita un backend HTTPS accesible.

## Capacidades

Consultas: orden/estado/saldo/costos/utilidad, órdenes pendientes/atrasadas/semana, trabajos pendientes, inventario/bajos, saldo de empleado, facturación mensual y cuentas por cobrar.

Acciones **con confirmación**: crear cliente, vehículo u orden, agregar trabajos, registrar pago/gasto/compra de inventario, asignar, iniciar y terminar trabajo. Se pide solo lo que falte y se resuelven ambigüedades. El contexto identifica el vehículo de turnos anteriores. Las acciones aplicadas quedan en events y los reintentos no duplican movimientos.

No admite borrado arbitrario, cierre automático de órdenes, ejecución de código ni modificación libre de precios. El modelo no tiene acceso directo a la base.

## Costos y fallos

- Mensajes: máximo 1,500 caracteres. Hasta 12 turnos de contexto, 1,600 caracteres cada uno. Cuerpo máximo 24 KB.
- Una petición a la vez por proveedor frontend; el panel también bloquea envíos mientras espera.
- requestId identifica una solicitud. Backend reutiliza el resultado/promesa por 5 minutos en la misma instancia/sesión; diferente contenido con el mismo ID produce conflicto.
- Sin reintentos automáticos. Una nueva acción manual genera una petición nueva.
- Timeout del proveedor 35 s, frontend 40 s; Vercel maxDuration 60 s. Máximo 2,000 tokens de salida.
- Sin llamadas al abrir la aplicación ni carga automática de datos del taller.
- Respuestas controladas para falta de configuración, conexión, tiempo agotado, autenticación, permisos, cuota agotada, límites, proveedor caído o respuesta inválida.
- Los límites son **por instancia en memoria**. Reinicios y varias instancias de Vercel los reinician/dividen. No son un límite monetario global. Para despliegue público amplio habría que añadir contadores compartidos y autenticación apropiada.
- Revisar uso/alertas de la cuenta API y del proveedor de alojamiento. TallerOS no compra créditos ni aumenta presupuestos automáticamente.

La entrada enviada a OpenAI contiene mensaje, contexto conversacional acotado, fecha e intención pendiente; puede contener nombres/datos que el usuario escribió. No se envía una copia completa del taller. store:false se solicita al proveedor; no equivale a prometer retención cero fuera de la app.

## Voz

SpeechRecognition/webkitSpeechRecognition del navegador, idioma es-DO. El micrófono pide permiso del dispositivo; transcribe al campo de mensaje. El usuario puede revisar el texto. Sin soporte, escribir o usar dictado del teclado. No se implementó una API de voz pagada de OpenAI. El reconocimiento del navegador puede depender de servicios externos y conectividad; no se garantiza funcionamiento offline.

## Estado comprobado

Proveedores simulados prueban interpretación/validación, confirmación, errores, límites y ausencia de IA. La última prueba real de la fase anterior devolvió 429 credit_balance_exhausted / insufficient_quota. Hace falta saldo/acceso en la cuenta API antes de declarar la IA operativa. La credencial anterior tenía vigencia limitada; revisar expiración privadamente en la cuenta. Nunca reproducirla en documentación.

Referencias oficiales: [seguridad de producción OpenAI](https://developers.openai.com/api/docs/guides/production-best-practices), [errores API](https://developers.openai.com/api/docs/guides/error-codes).
