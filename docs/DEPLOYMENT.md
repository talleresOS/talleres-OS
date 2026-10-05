# Despliegue seguro

## Estado y fuentes

Producción vigente: https://talleresos.github.io/talleres-OS/index.html (3.0.0), main 935a4dad49339761691f4057722fc92092f20d12. Código completo: codex/independence-3-0. El usuario autorizó publicar en la misma URL el 05/10/2026. Pages 37308159560 terminó correctamente; los 30 hashes y el flujo móvil sobre la URL real se verificaron.

main conserva el mecanismo histórico de distribución estática y sus archivos previos; se actualizaron exclusivamente los 30 recursos de dist y release-manifest.json. Para desarrollo/backend/pruebas usar la rama de código completo, no las herramientas históricas de main. Recuperación 2.4.1: codex/stable-before-independence-3-0.

No usar Sites ni el archivo histórico .openai/hosting.json para reemplazar el hosting. Un cambio de código no transfiere datos del navegador.

## Verificación local antes de publicar

```sh
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 exec playwright install chromium
npm run build
npm run check:release
npm test
npm run test:runtime
```

dist contiene 30 recursos públicos y release-manifest.json. Este último identifica sus hashes SHA-256. No editar dist; corregir raíz y volver a generar. El build se detiene ante archivos extra o una posible clave en un recurso público.

El workflow Verify TallerOS solo verifica; no publica ni sube perfiles/backups. No confundirlo con un despliegue.

## Paso externo pendiente: configurar la cuenta Vercel

Requiere una sesión del propietario y permisos sobre talleresOS/talleres-OS; este acceso no estaba disponible. Todo el código de build/backend está preparado.

1. Entrar a Vercel, conectar GitHub e importar ese repositorio en un proyecto nuevo. Revisar condiciones/costos del plan antes de aceptar un cargo.
2. Conservar main como rama de producción existente en GitHub. Generar un **Preview** de codex/independence-3-0; no hacer merge ni promoverlo automáticamente.
3. Framework Other; Node 24. Mantener vercel.json: build `node prepare-release.mjs`, output `dist`, instalación sin dependencias de runtime. api/assistant.mjs es función Node y server/*.mjs código privado.
4. Para Preview, configurar OPENAI_API_KEY y ASSISTANT_ACCESS_CODE como secretos del servidor; los otros nombres están en .env.example. Añadir ASSISTANT_ALLOWED_ORIGINS con orígenes exactos si corresponde. Nunca VITE_/NEXT_PUBLIC_ ni inyectar variables en JS público. Empezar con ASSISTANT_ENABLED=false permite verificar la app sin gasto API.
5. Desplegar Preview. Las variables nuevas requieren redeploy. Mantener protección de Preview si la cuenta la ofrece. Si bloquea pruebas remotas, acceder por la sesión legítima; no desactivar protecciones innecesariamente.
6. Verificar /version.json = 3.0.0 y build 3.0.0-independence-20261004. Comparar release-manifest.json y recursos con el build local. Comprobar que /.env, /server/.env.local y archivos de respaldo no se sirven.
7. Probar con datos sintéticos el flujo cliente → vehículo → orden → abono → comprobante → producción → cobro → garantía → cierre → factura → historial. Exportar/importar, recargar y probar sin conexión. Abrir desde iPhone real.
8. Si se desea IA, configurar saldo/clave válida privadamente en OpenAI, habilitarla y ejecutar una consulta y una operación confirmada con datos sintéticos. No afirmar funcionamiento real usando solo mocks.
9. Solo después de estas comprobaciones decidir una promoción de producción. Esta fase **no autoriza cambiar el dominio/URL existente automáticamente**.

GitHub Pages 3.0.0 continúa operativo mientras se prepara Vercel. El backend Vercel también puede ser usado por la URL actual mediante la configuración del endpoint y el origen permitido, sin migrar el frontend; requiere verificar HTTPS/CORS y acceso.

## Rutas, caché y entornos

/api/assistant/session e /interpret se reescriben al adaptador serverless. No se exportan secretos a dist. .vercelignore y excludeFiles excluyen credenciales, backups y perfiles.

version.json y API llevan no-store; index y sw no-cache. La nueva caché PWA es versionada. Cerrar todas las pestañas antiguas para activar una actualización, sin borrar datos del sitio. El hash # de navegación no requiere una ruta SPA nueva.

Preview y Production deben tener sus variables explícitamente configuradas. Los contadores de consumo en memoria no se comparten entre funciones/instancias. Consultar [entornos Vercel](https://vercel.com/docs/deployments/environments) y [variables](https://vercel.com/docs/environment-variables).

## Recuperación / rollback

Conservar el commit previo y un respaldo de datos antes de cualquier despliegue. Revertir código usando un commit compatible con esquema 3, tras probarlo contra una copia; no resetear la base. No publicar código 2.2 que solicita un esquema inferior sobre una base actual. No usar force-push ni sustituir main con el directorio Git local antiguo.
