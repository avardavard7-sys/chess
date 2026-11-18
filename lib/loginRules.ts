export const LOGIN_DOMAIN = 'login.hodkonem.app';
export const LOGIN_RE = /^[a-z0-9_]{3,20}$/;

export const normalizeLogin = (raw: string) => raw.trim().toLowerCase();

export function toAuthEmail(loginOrEmail: string): string {
  const v = loginOrEmail.trim();
  return v.includes('@') ? v : `${normalizeLogin(v)}@${LOGIN_DOMAIN}`;
}

export const SIGNUP_ERRORS: Record<string, string> = {
  bad_login: 'Логин: 3–20 символов — латинские буквы, цифры и _',
  bad_password: 'Пароль — минимум 6 символов',
  login_taken: 'Этот логин уже занят — придумайте другой',
  too_many: 'Слишком много попыток регистрации. Попробуйте через час',
};
