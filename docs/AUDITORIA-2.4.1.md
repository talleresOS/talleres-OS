# Auditoría final TallerOS 2.4.1

Fecha: 02/10/2026. Build: `2.4.1-audit-20261002`.

## Estado retomado

Ya estaban implementados en 2.4.0: comprobante inicial automático con abono real, transacción e idempotencia; factura final; piezas y procesos independientes; pagos, balance, garantía e identidad del taller; respaldo local. La publicación estaba pendiente: la dirección pública seguía sirviendo 2.2.0.

## Pruebas ejecutadas

Diez suites ejecutadas en navegadores aislados: modelo de trabajos, interfaz de trabajos, migración 2.2, regresión Fase 2, casos extremos, modelo de documentos, actualización 2.3, documentos, auditoría funcional integral y aviso de actualización.

Caso Mario: Honda Civic 2011 gris, cinco piezas y cuatro procesos, total RD$60,000, abono RD$20,000, saldo RD$40,000; producción, pago final RD$40,000 y garantía; dos pagos reales, balance cero, factura y consulta histórica. PDF carta y vistas móviles verificados.

Caso integral: cliente y vehículo creados y editados por interfaz; tres piezas y tres procesos asignados a tres empleados. Mano de obra: 1×500 + 2×300 + 3×400 = RD$2,300. Materiales RD$12,000, otros costos RD$700. Total RD$60,000; pagos 20,000 + 10,000 + 30,000; costos RD$15,000; utilidad RD$45,000, margen 75%. Pagar RD$200 al primer empleado deja RD$300 pendientes y no modifica la utilidad.

También se verificó:

- Inicio, órdenes activas, producción e historial; exclusión de órdenes cerradas de operación.
- Edición de entrega prevista; instantánea inicial conservada; rechazo de sobrepago sin escribir.
- Cancelación de confirmaciones, cierre definitivo, garantía y bloqueo histórico.
- Inventario: 10 + 5 − 4 = 11; promedio 106.67; rechazo de salida superior al stock.
- Cierre de septiembre: caja 60,000 y utilidad 45,000; cancelación previa no crea cierre.
- Exportación real del JSON completo, importación con confirmación y recuperación, permanencia de factura/garantía/pagos después de recargar.
- Persistencia al terminar y reiniciar el proceso del navegador (suite work-ui/Fase 2).
- Trece vistas a 320, 375, 390, 430 y 1280 px con nombres sin espacios de más de 180 caracteres.
- Modal a 390×360 px, simulando el espacio disponible con teclado: campos y botones accesibles por scroll.
- Actualización pendiente conserva un formulario sin guardar; tras cerrar todas las pestañas se activa la nueva caché, conserva el cliente y abre offline.
- Consola y excepciones JavaScript sin errores en el flujo integral.

Los datos de prueba existen únicamente en perfiles/contextos de prueba y fueron cerrados al terminar. No se importaron, alteraron ni eliminaron datos de la instalación real del usuario.

## Errores y correcciones

1. Nombres muy largos ampliaban Clientes e Historial más allá de la pantalla. Se corrigió el ajuste de texto y el ancho mínimo de los contenedores; no se escondió contenido.
2. Los procesos en Nueva orden tenían un área táctil pequeña. Las etiquetas ahora tienen altura mínima de 44 px.
3. Varias acciones respondían con un mensaje genérico. Se incorporaron mensajes específicos de orden, cliente, vehículo, pago, trabajo terminado y factura final.
4. No existía aviso visible de una actualización esperando. Se agregó aviso y revalidación explícita del worker, sin forzar recarga ni alterar formularios abiertos.
5. Una prueba leía el estado de producción antes de terminar el renderizado. La captura posterior confirmó que el trabajo estaba terminado; se corrigió la sincronización de la prueba, no los cálculos del sistema.

## Archivos de esta auditoría

Aplicación: `app.js`, `styles.css`, `document-ui.mjs`, `work-ui.mjs`, `pwa.js`. Identificación/build: `domain.mjs` (solo VERSION), `sw.js`, `version.json`, `package.json`. Pruebas: `tests/work-ui.mjs`, `tests/work-migration.mjs`, `tests/documents-upgrade.mjs`, `tests/final-audit.mjs`, `tests/update-notice.mjs`. Documentación: `AGENTS.md`, `README.md`, `CHANGELOG.md`, `CONTINUIDAD.md` y este informe. `dist` se genera desde la raíz.

Se conservaron el diseño de ambas facturas, los cálculos financieros, el servicio transaccional y el esquema IndexedDB 3.

## Publicación y límites

Publicación completada y verificada el 02/10/2026 en **https://talleresos.github.io/talleres-OS/index.html**.

- Versión **2.4.1**; build **2.4.1-audit-20261002**.
- Commit publicado: `c01491d190d72d9d4971d4b27f24146dac85386d`.
- GitHub Pages: ejecución `37014987860`, completada con resultado `success`.
- Se publicaron los 22 archivos públicos generados en `dist` y su manifiesto. No se subieron perfiles, copias JSON del taller ni evidencia privada.
- Los 22 archivos descargados desde la URL publicada coinciden byte por byte (SHA-256) con el build auditado, y el manifiesto coincide exactamente.
- Se repitió sobre esa URL el flujo completo mediante la interfaz, a 375×812: cliente → vehículo → orden/abono 20,000 → comprobante → asignación/producción → pago 40,000 → garantía → factura final → historial. Dos pagos, total cobrado 60,000, balance cero, orden cerrada, sin referencias rotas ni errores JavaScript.
- Nueve vistas del sitio publicado sin desbordamiento; recarga offline y consulta histórica correctas.
- Prueba publicada en un contexto nuevo y aislado, cerrado al terminar: no se dejaron datos en el navegador habitual del usuario.

Evidencia: `.test-results/audit-final/` de esta tarea. El proyecto original conserva una copia de código anterior en `local-backups/before-audit-2.4.1-1790948720915`. Se comprobaron los hashes al sincronizar los 29 archivos preparados hacia esa carpeta.

Para una instalación que todavía muestre la versión antigua: cerrar todas las pestañas y la aplicación TallerOS y volver a abrir la misma URL. No borrar los datos del navegador ni cambiar de origen. En Configuración debe aparecer TallerOS 2.4.1.

Pendiente de comprobación física: Safari/iPhone real, teclado iOS real e impresora. Las verificaciones móviles disponibles aquí utilizan Chromium con dimensiones de teléfono; no se presenta esa simulación como prueba en un teléfono físico.
