export const MIN_RECOVERY_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_BYTES = 72;

export function isRecoveryTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{56,64}$/i.test(value);
}

export function validateRecoveryPassword(password: unknown, confirmation: unknown) {
  if (typeof password !== "string" || [...password].length < MIN_RECOVERY_PASSWORD_LENGTH) {
    return `Use at least ${MIN_RECOVERY_PASSWORD_LENGTH} characters for your new password.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "That password is too long. Try a shorter password.";
  }
  if (password !== confirmation) return "Your passwords don’t match.";
  return null;
}
