// Traduce los errores de Better Auth a mensajes claros, sin revelar si un email
// está registrado salvo en el registro (donde es inevitable para el usuario).
export function authErrorMessage(error: { status?: number; code?: string; message?: string } | null | undefined): string {
  if (!error) return "Algo falló. Probá de nuevo.";
  if (error.status === 429) return "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.";
  const code0 = error.code ?? "";
  if (error.status === 403 && /ORIGIN/i.test(code0 + (error.message ?? ""))) {
    return "Esta dirección no está autorizada. Abrí Mova desde la dirección configurada en APP_URL (en local, http://localhost:3000).";
  }
  if (error.status !== undefined && error.status >= 500) {
    return process.env.NODE_ENV === "production"
      ? "No pudimos completar la operación. Probá de nuevo en unos minutos."
      : "El servidor falló. Mirá la terminal de npm run dev: casi siempre es la base de datos apagada o sin migrar (npm run doctor lo revisa).";
  }
  const code = error.code ?? "";
  if (code.includes("INVALID_EMAIL_OR_PASSWORD")) return "El email o la contraseña no son correctos.";
  if (code.includes("USER_ALREADY_EXISTS")) return "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.";
  if (code.includes("PASSWORD_TOO_SHORT")) return "La contraseña debe tener al menos 10 caracteres.";
  if (code.includes("PASSWORD_TOO_LONG")) return "La contraseña es demasiado larga.";
  if (code.includes("INVALID_EMAIL")) return "Ingresá un email válido.";
  if (code.includes("INVALID_TOKEN")) return "El enlace no es válido o venció. Pedí uno nuevo.";
  return "Algo falló. Probá de nuevo.";
}
