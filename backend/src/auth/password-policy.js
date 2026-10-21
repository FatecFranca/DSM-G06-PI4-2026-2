export const PASSWORD_MIN_LENGTH = 12;

export function getPasswordPolicyErrors(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length === 0) {
    errors.push('A senha é obrigatória.');
    return errors;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(
      `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres; a informada tem ${password.length}.`,
    );
  }
  return errors;
}
