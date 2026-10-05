const messages={
  not_configured:'El servidor del asistente todavía no está configurado. Puedes seguir usando TallerOS sin IA.',
  provider_auth:'La credencial privada del servidor venció o no es válida. El propietario debe revisar su configuración.',
  provider_access:'El proyecto de OpenAI no tiene acceso al modelo configurado. Revisa el modelo y sus permisos.',
  quota:'El proyecto de OpenAI no tiene saldo disponible. Revisa la facturación de la API. No se realizó ningún cambio.',
  rate_limit:'La IA limitó temporalmente las solicitudes. Espera antes de volver a intentarlo. No se realizó ningún cambio.',
  timeout:'La IA tardó demasiado. Puedes volver a intentarlo; no se guardó nada.',
  network:'No se pudo conectar con OpenAI. Las funciones normales de TallerOS siguen disponibles.',
  invalid_response:'La IA devolvió una respuesta inválida o incompleta. No se realizó ningún cambio.',
  unavailable:'El proveedor de IA no está disponible. Puedes seguir usando TallerOS sin IA.'
};
export class AssistantError extends Error{
  constructor(code,status=502){super(messages[code]||messages.unavailable);this.code=code;this.status=status;}
}
export const publicAssistantError=error=>error instanceof AssistantError?{status:error.status,body:{error:error.message,code:error.code}}:{status:502,body:{error:messages.unavailable,code:'unavailable'}};
