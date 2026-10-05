# TallerOS 3.0 — Independence Release

Gestión de un taller de carrocería y pintura: clientes, vehículos, órdenes, piezas, procesos, empleados, cobros, costos, inventario, documentos y cierres. Esta versión consolida el proyecto existente; no lo reconstruye.

**Estado:** 3.0.0, build 3.0.0-visual-20261005b publicada el 05/10/2026; código completo en `codex/visual-3-0`. Producción en GitHub Pages, [misma URL](https://talleresos.github.io/talleres-OS/index.html). Vercel está preparado, no desplegado/verificado. La última llamada real a OpenAI fue rechazada por saldo API agotado; las pruebas posteriores usan proveedores simulados. No confundir estas pruebas con una validación de IA real.

TallerOS funciona sin ChatGPT Plus, Codex ni OpenAI. La IA es opcional; necesita un backend y una cuenta API con saldo. GitHub guarda código, **no los datos de tu taller**.

## Instalar desde GitHub

Requisitos de desarrollo: Git, Node.js 24 (incluye npm) y acceso a npm para instalar las herramientas de prueba. No se necesita una herramienta de OpenAI.

```sh
git clone --branch codex/visual-3-0 https://github.com/talleresOS/talleres-OS.git
cd talleres-OS
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 exec playwright install chromium
npm run dev
```

Abrir http://localhost:4173. El servidor local genera y sirve únicamente `dist`; no sirve los archivos privados. Sin IA no hace falta crear ningún archivo de entorno. Para operar localmente con Node y generar el build tampoco se necesitan dependencias externas: `node scripts/dev.mjs` funciona sin instalar Playwright. Este último solo se utiliza para pruebas.

En Linux, Playwright puede requerir `npx --yes pnpm@11.25.0 exec playwright install --with-deps chromium`. Se puede elegir un navegador instalado mediante `TALLEROS_BROWSER`; no es obligatorio utilizar Edge. `TALLEROS_TEST_OUTPUT` permite cambiar la carpeta de evidencias dentro de `.test-results`. Las pruebas crean datos sintéticos en contextos separados y nunca abren el perfil personal.

## Comandos

| Comando | Función |
| --- | --- |
| `npm run dev` / `npm start` | App y endpoint local, puerto 4173 |
| `npm test` | 20 suites de modelo, UI, migración, finanzas, documentos, IA y respaldos |
| `npm run test:runtime` | Copia sin Git/dependencias/secretos y aislamiento del servidor |
| `npm run build` | Copia permitida de 32 recursos públicos a dist |
| `npm run check:release` | Versiones, hashes, lista pública, caché y ausencia de secretos públicos |
| `npm run start:assistant` | API sola, por defecto 127.0.0.1:8787 |

Antes de `npm test`, ejecutar `npm run build`. Las migraciones usan fixtures del código histórico incluidas en el repositorio: no requieren tags locales ni historial completo. `tests/ui-refresh.mjs` y `tests/ui-upgrade.mjs` son pruebas archivadas de 2.2.0 y no forman parte de la suite actual.

## Arquitectura y estructura

HTML, CSS y módulos JavaScript nativos; sin framework ni dependencias de producción. IndexedDB es la fuente local de datos. Node 24 sirve el backend opcional, también adaptable a Vercel Functions.

| Archivos | Responsabilidad |
| --- | --- |
| app.js, work-ui.mjs, styles.css, interface.css | Navegación, formularios y presentación |
| domain.mjs, work-model.mjs | Cálculos y relaciones; piezas físicas y procesos independientes |
| service.mjs, work-service.mjs | Escrituras validadas, transaccionales e idempotentes |
| storage.mjs, backup.mjs | IndexedDB, migraciones, respaldo/restauración e integridad |
| documents*.mjs, document-ui.mjs | Comprobante inicial, cotización y factura final |
| assistant-*.mjs | Contrato, consultas locales, confirmaciones, interfaz y voz |
| server/*.mjs, api/assistant.mjs | Proveedor OpenAI, autenticación y endpoint privado |
| pwa.js, sw.js, version.json | Instalación, funcionamiento sin conexión y actualización |
| scripts/, tests/, .github/workflows/verify.yml | Desarrollo independiente y verificación sin despliegue |

Más detalle en [Arquitectura](docs/ARCHITECTURE.md) y [Modelo de datos](docs/DATA-MODEL.md).

## Datos, respaldos y recuperación

La base es `talleros2`, **esquema 3**. 3.0.0 es la versión de la aplicación; no supone un nuevo esquema. Cada navegador/origen conserva sus propios datos. No hay sincronización en la nube. El almacenamiento privado, borrar datos del navegador, perder el dispositivo o cambiar de origen puede hacer inaccesibles los datos.

En **Configuración → Respaldos → Exportar respaldo** descargar y conservar fuera del navegador el JSON completo. En **Restaurar respaldo** seleccionar el archivo: TallerOS valida integridad, versión, registros y relaciones, muestra los recuentos y solo escribe después de pulsar **Restaurar y reemplazar**. Cancelar no cambia nada. Se conserva una instantánea del estado anterior para exportarla desde esa misma sección.

Respaldar diariamente y después de cobros importantes. El JSON contiene información privada y no está cifrado: conservarlo en una ubicación privada con otra copia externa. GitHub y un ZIP de código no sustituyen este respaldo. [Guía de respaldos](docs/BACKUP-RESTORE.md) · [Recuperación si falla TallerOS](docs/RECOVERY.md).

## OpenAI opcional

El navegador llama al backend; solo el backend conoce `OPENAI_API_KEY`. No usar variables con prefijos públicos ni guardar secretos en Configuración/IndexedDB. Para desarrollo, copiar `server/.env.example` a `server/.env.local` y completar privadamente los valores. Los ejemplos contienen únicamente nombres vacíos.

Variables del servidor: `OPENAI_API_KEY`, `OPENAI_MODEL`, `ASSISTANT_ACCESS_CODE`, `ASSISTANT_ALLOWED_ORIGINS`, `ASSISTANT_ENABLED`, `ASSISTANT_DAILY_LIMIT`, `ASSISTANT_MINUTE_LIMIT`, `ASSISTANT_MAX_CONCURRENT`. El código de acceso debe ser largo y privado; no es la clave de OpenAI. El usuario lo introduce en Conectar del asistente; la sesión temporal permanece en memoria.

Las consultas rápidas funcionan con datos locales. La interpretación libre usa Responses API, modelo predeterminado `gpt-4.1-mini`, configurable. Cada modificación se valida y confirma en TallerOS. La voz usa el reconocimiento del navegador si existe; siempre se puede escribir o dictar con el teclado.

No hay llamadas automáticas al abrir la app ni reintentos automáticos. La API y el alojamiento pueden tener costos independientes; no se ha contratado ni pagado ningún servicio. [Seguridad, límites y capacidades](docs/AI-ASSISTANT.md).

## Build y despliegue

`npm run build && npm run check:release` no publica. Solo los 32 recursos de `dist` y su manifiesto son públicos. Nunca copiar toda la raíz a un servidor estático.

Vercel usa `vercel.json`: build Node, salida dist y función /api/assistant. Las claves se configuran como secretos en Vercel. GitHub Pages ya publica el build 3.0 autorizado. Para Vercel, preparar primero un **Preview** de la rama de código completo y verificarlo; **no cambiar dominio ni la URL existente**. Cambiar de origen no mueve IndexedDB: requiere respaldo/importación explícita. [Pasos de despliegue](docs/DEPLOYMENT.md).

## Límites conocidos

- GitHub Pages 3.0.0 está publicado y verificado. No hay despliegue Vercel confirmado, prueba real satisfactoria de IA ni prueba en iPhone físico.
- Los límites de API y la deduplicación del backend son por instancia; no constituyen un presupuesto global garantizado.
- La voz depende del navegador, permisos y posiblemente su proveedor de reconocimiento.
- Las pruebas cubren tamaños móviles equivalentes, no reemplazan Safari físico, teclado real ni impresora.
- Los respaldos antiguos sin hash se aceptan con aviso; un hash detecta cambios, no autentica al autor.
- No hay portal independiente de empleados, permisos multiusuario avanzados ni sincronización.
- El informe de consolidación y la continuidad están en [INDEPENDENCE-3.0.0](docs/INDEPENDENCE-3.0.0.md) y [CONTINUIDAD](CONTINUIDAD.md).
