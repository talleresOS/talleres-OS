# Respaldos y restauración

## Exportar

1. Abrir **Configuración → Respaldos → Exportar respaldo**.
2. Guardar el archivo `TallerOS-backup-AAAA-MM-DD-HHMM.json`.
3. Conservarlo fuera del navegador, con una segunda copia privada en otro dispositivo o almacenamiento elegido por el propietario.

El archivo contiene schema/format version, appVersion, exportedAt, revisión del envoltorio e integrity SHA-256, además de todas las colecciones: identidad/logo, clientes, vehículos, empleados, órdenes, piezas, procesos, asignaciones, pagos, gastos, inventario, documentos, garantías, cierres, eventos y recuperaciones.

No contiene la API key ni una sesión del asistente. Es texto JSON **sin cifrar** y contiene información privada. No enviarlo al repositorio ni a un directorio público. El mensaje de la app confirma la generación, no que el dispositivo haya conservado correctamente el archivo: comprobar la descarga.

## Restaurar

1. Conservar primero un respaldo del estado actual.
2. Pulsar **Restaurar respaldo**, elegir un archivo de hasta 100 MB.
3. La app valida JSON, versión soportada, integridad si existe, colecciones, claves, relaciones e importes.
4. Revisar fecha, versión, aviso de legado y tabla **Actuales / Respaldo**.
5. **Cancelar** conserva todo. Solo **Restaurar y reemplazar** autoriza sustituir el contenido.

No hay mezcla silenciosa. Si otra pestaña modifica el taller mientras la vista previa está abierta, la restauración se rechaza: revisar nuevamente el archivo. Si la operación falla, la transacción conserva el estado anterior. Antes de reemplazar se guarda una instantánea recuperable.

Después: consultar cliente/orden, pagos, inventario, documentos y totales; recargar y comprobar persistencia. Puede mantenerse un contador REV superior al del archivo para prevenir números duplicados.

## Recuperación de una importación equivocada

En Respaldos, **Exportar recuperación anterior** genera un JSON de la instantánea anterior a la importación. Revisarlo/importarlo mediante el mismo flujo confirmado. Antes de hacer otra restauración, exportar también el estado actual. Las otras instantáneas históricas continúan accesibles desde sus controles existentes.

La instantánea vive en el mismo navegador: no protege frente a pérdida del dispositivo o borrado de datos del navegador. Si falta espacio, la importación debe fallar atómicamente; no borrar la base como solución.

## Compatibilidad e integridad

- Los respaldos anteriores compatibles se aceptan sin hash con un aviso visible.
- La versión de datos 3 conserva main/ledger/phase2; no requiere regenerar datos.
- Un respaldo nuevo modificado, incompleto o con checksum incorrecto se rechaza antes de escribir.
- Versiones futuras no soportadas se rechazan; utilizar una app compatible.
- El hash detecta daños/cambios, **no firma el archivo ni demuestra quién lo creó**. Importar solo archivos propios de confianza.
- No editar importes ni quitar integrity manualmente para sortear validaciones. Una reparación excepcional debe preservar el original, identificar la causa y probarse en un origen aislado.
- Para verificar hash se necesita HTTPS o localhost.

## Frecuencia y cambio de dispositivo

Respaldo diario y después de jornadas/cobros importantes; mantener varias fechas. Cambiar GitHub Pages por Vercel, navegador o dispositivo crea un almacenamiento diferente. Exportar en el origen antiguo, importar conscientemente en el nuevo, verificar y conservar ambos hasta terminar la revisión. No se ha implementado sincronización automática.
