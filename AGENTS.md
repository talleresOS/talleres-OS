# TallerOS / RevivAuto — proyecto canónico

- URL de producción: https://talleresos.github.io/talleres-OS/index.html
- Repositorio de producción: https://github.com/talleresOS/talleres-OS (main).
- Esta carpeta contiene el código canónico. No crear otra aplicación ni publicar en otro origen sin una solicitud expresa.
- La vinculación histórica .openai/hosting.json corresponde a un Site sin publicación. No usar Sites para sustituir esta URL de GitHub Pages.
- IndexedDB: talleros2 versión 2. La migración conserva los stores principales e incorpora copias de las cuentas de talleros2-ledger. La base auxiliar anterior queda intacta.
- Antes de cambiar almacenamiento o finanzas: respaldo, migración aditiva e idempotente, pruebas de relaciones, pagos y numeración REV. Nunca borrar IndexedDB para resolver una migración.
- Toda escritura de la app pasa por service.mjs y una transacción de storage.mjs. Respetar bloqueo de órdenes cerradas y cuentas cerradas.
- domain.mjs concentra los cálculos. No duplicar mano de obra al pagar empleados. No confundir venta con cobro.
- Nunca incluir costos, salarios, rentabilidad ni notas internas en un comprobante de cliente.
- No inventar fechas históricas. Mantener campos desconocidos y claves originales.
- Modificar la raíz y ejecutar node prepare-release.mjs para sincronizar dist. No editar ambas copias por separado.
- Pruebas: node tests/phase2.mjs (Playwright) y node tests/edge-cases.mjs cuando exista. TALLEROS_PLAYWRIGHT y TALLEROS_BROWSER permiten señalar los ejecutables instalados; TALLEROS_TEST_OUTPUT debe apuntar a un directorio temporal local.
- Mantener version.json, changelog y ficha de ubicación. Crear una versión identificable en Git antes de publicar.
- Publicar exclusivamente los archivos públicos de dist. Nunca subir copias JSON del taller, perfiles de pruebas, credenciales ni snapshots con datos reales.
