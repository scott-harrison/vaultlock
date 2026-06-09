export interface SignupContextSignals {
  urlText?: string;
  submitLabel?: string;
  passwordAutocomplete?: string;
  containerText?: string;
  hasConfirmPasswordField?: boolean;
  hasForgotPasswordLink?: boolean;
  passwordFieldHints?: string;
}

const SIGNUP_URL_PATTERN =
  /\b(sign[\s-]?up|signup|register(?:ation)?|create[\s-]?(?:an?\s+)?account|new[\s-]?account)\b/i;
const LOGIN_URL_PATTERN = /\b(log[\s-]?in|login|sign[\s-]?in|signin|authenticate|\/session)\b/i;

const SIGNUP_SUBMIT_PATTERN =
  /\b(sign[\s-]?up|register|create(?:\s+(?:an?\s+)?account)?|join\s+(?:now|for\s+free)|get\s+started)\b/i;
const LOGIN_SUBMIT_PATTERN = /\b(log[\s-]?in|sign[\s-]?in)\b/i;

const SIGNUP_CONTAINER_PATTERN =
  /\b(sign[\s-]?up|create(?:\s+(?:an?\s+)?account)?|register(?:\s+now)?|new\s+account)\b/i;
const LOGIN_CONTAINER_PATTERN =
  /\b(log[\s-]?in|sign[\s-]?in|welcome\s+back|existing\s+(?:account|member))\b/i;

const NEW_PASSWORD_HINT_PATTERN =
  /(?:new|confirm|signup|sign-up|register|create|choose).*(?:pass|pwd)|(?:pass|pwd).*(?:new|confirm)/i;

export function scoreSignupContext(signals: SignupContextSignals): {
  signup: number;
  login: number;
} {
  let signup = 0;
  let login = 0;

  const autocomplete = (signals.passwordAutocomplete ?? "").toLowerCase();
  if (autocomplete === "new-password") {
    signup += 3;
  } else if (autocomplete === "current-password") {
    login += 3;
  }

  const urlText = signals.urlText ?? "";
  if (SIGNUP_URL_PATTERN.test(urlText)) {
    signup += 4;
  }
  if (LOGIN_URL_PATTERN.test(urlText)) {
    login += 4;
  }

  const submitLabel = signals.submitLabel ?? "";
  if (SIGNUP_SUBMIT_PATTERN.test(submitLabel)) {
    signup += 4;
  }
  if (LOGIN_SUBMIT_PATTERN.test(submitLabel)) {
    login += 4;
  }

  const containerText = signals.containerText ?? "";
  if (SIGNUP_CONTAINER_PATTERN.test(containerText)) {
    signup += 2;
  }
  if (LOGIN_CONTAINER_PATTERN.test(containerText)) {
    login += 2;
  }

  if (signals.hasConfirmPasswordField) {
    signup += 3;
  }

  if (signals.hasForgotPasswordLink) {
    login += 3;
  }

  const passwordHints = signals.passwordFieldHints ?? "";
  if (NEW_PASSWORD_HINT_PATTERN.test(passwordHints)) {
    signup += 2;
  }

  return { signup, login };
}

export function isDefinitiveLoginContext(signals: SignupContextSignals): boolean {
  const autocomplete = (signals.passwordAutocomplete ?? "").toLowerCase();
  if (autocomplete === "current-password") {
    return true;
  }

  const urlText = signals.urlText ?? "";
  if (LOGIN_URL_PATTERN.test(urlText)) {
    return true;
  }

  const submitLabel = signals.submitLabel ?? "";
  if (LOGIN_SUBMIT_PATTERN.test(submitLabel)) {
    return true;
  }

  if (signals.hasForgotPasswordLink) {
    return true;
  }

  return false;
}

export function isLikelyLoginContext(signals: SignupContextSignals): boolean {
  if (isDefinitiveLoginContext(signals)) {
    return true;
  }

  const { login } = scoreSignupContext(signals);
  return login >= 3;
}

export function isLikelySignupContext(signals: SignupContextSignals): boolean {
  if (isLikelyLoginContext(signals)) {
    return false;
  }

  const { signup, login } = scoreSignupContext(signals);
  return signup >= 3 && signup > login;
}
