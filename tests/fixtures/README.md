# Código público histórico para pruebas

`source-2.2.0.json` y `source-2.3.0.json` guardan únicamente los archivos públicos de esas versiones. Se generaron desde los refs indicados en `sourceRef`; `sourceCommit` conserva el commit exacto. No contienen IndexedDB, clientes reales, perfiles, respaldos del taller ni credenciales.

El contenido es un mapa de nombres a bytes base64, comprimido con gzip y codificado como base64. `sha256` valida los bytes descomprimidos; `tests/legacy-source.mjs` verifica antes de usarlos. Esta representación evita depender de tags que solo existían en la computadora original y permite ejecutar las migraciones desde un ZIP o un clon superficial de GitHub.

No regenerar los fixtures con código nuevo para hacer pasar una prueba. Una actualización requiere comprobar la fuente histórica original y conservar el commit y hash.
