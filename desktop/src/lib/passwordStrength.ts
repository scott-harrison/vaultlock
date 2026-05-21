import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";

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
