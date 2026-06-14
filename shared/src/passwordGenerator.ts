export const MIN_GENERATED_LENGTH = 8;
export const MAX_GENERATED_LENGTH = 64;
export const DEFAULT_GENERATED_LENGTH = 20;

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export const DEFAULT_PASSWORD_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: DEFAULT_GENERATED_LENGTH,
  uppercase: true,
  numbers: true,
  symbols: true,
};

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";

function randomIndex(max: number): number {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return random[0] % max;
}

function pick(charset: string): string {
  return charset[randomIndex(charset.length)] ?? "";
}

function shuffle(values: string[]): string[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1);
    const current = result[index];
    result[index] = result[swapIndex] ?? current;
    result[swapIndex] = current;
  }
  return result;
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  const length = Math.min(MAX_GENERATED_LENGTH, Math.max(MIN_GENERATED_LENGTH, options.length));

  const charsets = [LOWERCASE];
  if (options.uppercase) {
    charsets.push(UPPERCASE);
  }
  if (options.numbers) {
    charsets.push(NUMBERS);
  }
  if (options.symbols) {
    charsets.push(SYMBOLS);
  }

  const pool = charsets.join("");
  const required = charsets.map(pick);
  const remaining = Math.max(0, length - required.length);
  const generated = [...required];

  for (let index = 0; index < remaining; index++) {
    generated.push(pick(pool));
  }

  return shuffle(generated).join("");
}
