# Si TallerOS deja de funcionar: recuperar desde GitHub y un respaldo

## Primero preservar

No borrar datos del navegador, no desinstalar la PWA ni limpiar IndexedDB. Cerrar solo pestañas que no tengan cambios pendientes. Si Configuración todavía abre, exportar el estado actual. Conservar copias de archivos originales antes de intentar repararlas.

Anotar URL, versión/build, navegador, mensaje y última operación. Una falla de IA no implica pérdida del taller: seguir con formularios y consultas locales.

## Recuperar el programa

En un equipo con Git y Node 24:

```sh
git clone --branch codex/independence-3-0 https://github.com/talleresOS/talleres-OS.git TallerOS-recuperado
cd TallerOS-recuperado
node prepare-release.mjs
node scripts/dev.mjs
```

Abrir http://localhost:4173. Para el funcionamiento normal no se necesita npm install, API key, ChatGPT ni Codex. Para verificar cambios, instalar dependencias y ejecutar las pruebas indicadas en README. Elegir un commit conocido compatible si se investiga una regresión; no copiar una base moderna a código con esquema inferior.

localhost es otro origen: puede aparecer vacío aunque los datos originales sigan en GitHub Pages. No significa que se hayan borrado. El código fuente/ZIP de GitHub no incluye esos datos.

## Recuperar el taller desde un JSON

1. Mantener copia original del archivo y comprobar su procedencia.
2. Abrir Configuración → Respaldos → Restaurar respaldo en la app recuperada.
3. Revisar versión, fecha, tabla de recuentos e integridad.
4. Confirmar Restaurar y reemplazar solo en el destino correcto.
5. Consultar una orden antigua, cliente/vehículo, pagos, empleados, inventario y documentos; comprobar saldos.
6. Recargar/cerrar/abrir y volver a revisar. Exportar una copia nueva después de verificar.

Si se restaura una copia equivocada, exportar la recuperación anterior desde Respaldos y pasarla por el mismo flujo. Si el archivo está corrupto, usar otra fecha; no quitar el checksum ni borrar la base. Si falta espacio o hay un bloqueo entre pestañas, conservar el archivo, cerrar otras pestañas y reintentar; un error no autoriza un reseteo.

## Sin archivo de respaldo

Si el origen/navegador original todavía conserva IndexedDB, intentar abrir una versión compatible del programa en ese mismo origen y exportar. No introducir otro sitio haciéndolo pasar por el original. Si el dispositivo/almacenamiento se perdió y no hay copia externa, GitHub, Vercel y OpenAI no pueden reconstruir datos que nunca recibieron.

## IA y hosting

Sin IA: confirmar backend y variables del servidor, conectividad, vigencia de clave y saldo API. Los errores públicos identifican configuración, cuota o conexión. Nunca pegar claves en la consola, chat o repositorio.

Si Vercel falla, la URL GitHub Pages actual sigue siendo una alternativa para su propia copia local de datos. No hay sincronización entre ambas. Restaurar/importar manualmente solo tras comparar y respaldar. Ver DEPLOYMENT.md antes de promover cambios.

## Qué entregar a otro desarrollador

Commit/rama, README, AGENTS, CONTINUIDAD, versión del navegador y error reproducible. Compartir datos sintéticos; si es indispensable un respaldo real, usar un canal privado autorizado. No enviar server/.env.local, API keys, perfiles personales ni respaldos a issues públicos.
