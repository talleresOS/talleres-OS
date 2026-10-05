# Arquitectura — 3.0.0

## Principio de continuidad

Se conserva la arquitectura JavaScript nativa. No hay servidor obligatorio para la operación del taller, framework, base remota ni dependencia de ChatGPT/Codex. Estos últimos son herramientas de desarrollo, no componentes del producto.

```text
GitHub (código) → build de lista permitida → dist → navegador/PWA
                                                    ↓
                                      servicios → IndexedDB local
Navegador → endpoint privado opcional → OpenAI Responses API
           (solo intención)          ← JSON validado
          ↓
resolución local → confirmación → servicios → transacción
```

## Fronteras

- La UI nunca escribe registros arbitrarios. Usa service.mjs y work-service.mjs; storage.mjs coordina transacciones.
- domain.mjs concentra cálculos: ventas no son cobros; devengos no son pagos a empleados; pagar no duplica un costo.
- vehiclePieces representa piezas físicas; workAssignments representa cada proceso y selección de piezas.
- documents.mjs consume datos permitidos para el cliente; snapshots congelan identidad, importes, garantía y trabajos. No reciben rentabilidad, empleados ni costos internos.
- El backend interpreta mensajes; no recibe acceso a IndexedDB ni puede ejecutar código/consultas arbitrarias sobre el taller.
- assistant-contract.mjs es una lista explícita de acciones y campos. assistant-core resuelve entidades y ambigüedades; assistant-service aplica cambios mediante servicios existentes.
- assistant-provider y assistant-voice son adaptadores reemplazables. Errores externos no invalidan la app.
- La conversación y el token son temporales; events registra las acciones confirmadas, sin credencial API.

## Persistencia y PWA

IndexedDB talleros2 esquema 3 reúne 21 stores. La base auxiliar histórica talleros2-ledger se conserva. El código migra datos antiguos de forma idempotente con instantáneas. No hay cambio de esquema en 3.0.

sw.js almacena recursos públicos para abrir sin conexión. No cachea POST del asistente. El nombre de caché identifica el build; una nueva versión espera el cierre de pestañas antiguas para no interrumpir formularios. Ni caché ni IndexedDB son un respaldo externo.

El código vigente no utiliza localStorage para datos del taller ni credenciales. Las preferencias persistentes y la información de negocio residen en IndexedDB.

## Decisiones de Independence Release

1. Integridad SHA-256 y revisión del envoltorio del respaldo; se mantiene el formato de datos versión 3 y la compatibilidad de importación.
2. Vista previa y control de cambios concurrentes antes de restaurar; recuperación previa dentro de la transacción.
3. Errores públicos de IA fijos, sin textos crudos del proveedor.
4. Límites modestos por instancia y deduplicación temporal; no introducir Redis, cuentas SaaS ni servicios pagos nuevos.
5. Servidor local con Node nativo y lista pública de recursos; instalación sin Codex.
6. Fixtures comprimidas y verificadas del código histórico para migraciones reproducibles desde un ZIP.
7. Build determinista por hashes y verificación automatizada en GitHub Actions, sin despliegue automático.

## Límites intencionales

No se implementa login de empleados, sincronización, multi-taller ni permisos avanzados. El código de conexión protege la API de este propietario; no equivale a un sistema de autenticación multiusuario. Un servicio público a escala requeriría controles compartidos de consumo y autenticación más completos.
