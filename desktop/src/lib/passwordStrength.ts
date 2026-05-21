import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";
import { MIN_GENERATED_LENGTH } from "./passwordGenerator";

let initialized = false;

export const MIN_PASSWORD_LENGTH = 12;
export const MIN_STRENGTH_SCORE = 3;

export function initPasswordStrength(): void {
  if (initialized) {
    return;
  }
  zxcvbnOptions.setOptions({
    dictionary: {
      ...dictionary,
    },
    graphs: adjacencyGraphs,
  });
  initialized = true;
}

export interface PasswordStrengthResult {
  score: number;
  feedback: string;
  isStrongEnough: boolean;
}

export function evaluatePasswordStrength(password: string, email: string): PasswordStrengthResult {
  initPasswordStrength();

  const localPart = email.includes("@") ? email.split("@")[0] : email;
  const result = zxcvbn(password, [email, localPart].filter(Boolean));

  const warnings = [
    ...(result.feedback.warning ? [result.feedback.warning] : []),
    ...result.feedback.suggestions,
  ];

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const scoreTooLow = result.score < MIN_STRENGTH_SCORE;
  const isStrongEnough = !tooShort && !scoreTooLow;

  let feedback = warnings[0] ?? "";
  if (tooShort) {
    feedback = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (scoreTooLow) {
    feedback = feedback || "Choose a stronger, less predictable password.";
  } else if (!feedback) {
    feedback = "Strong password.";
  }

  return {
    score: result.score,
    feedback,
    isStrongEnough,
  };
}

/** Strength display for generated login passwords (no master-password length gate). */
export function evaluateVaultPasswordStrength(
  password: string,
  hints: string[],
): PasswordStrengthResult {
  initPasswordStrength();

  const result = zxcvbn(
    password,
    hints.filter((hint) => hint.trim().length > 0),
  );
  const warnings = [
    ...(result.feedback.warning ? [result.feedback.warning] : []),
    ...result.feedback.suggestions,
  ];

  let feedback = warnings[0] ?? "";
  if (password.length < MIN_GENERATED_LENGTH) {
    feedback = `Use at least ${MIN_GENERATED_LENGTH} characters.`;
  } else if (result.score < 2) {
    feedback = feedback || "Weak — try a longer password or enable more character types.";
  } else if (!feedback) {
    feedback = "Looks good for a login password.";
  }

  return {
    score: result.score,
    feedback,
    isStrongEnough: result.score >= 3,
  };
}
