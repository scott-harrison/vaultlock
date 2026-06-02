export interface RegisterRequest {
  email: string;
  master_password_hash: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  /** Master password preimage — works on any device (server verifies with Argon2). */
  master_password?: string;
  /** Legacy: exact PHC string from registration on this device. */
  master_password_hash?: string;
}

export interface VerifyEmailRequest {
  token: string;
  /** When the email link was already opened, the server can confirm verification status. */
  email?: string;
}

export interface AuthResponse {
  access_token: string;
  token: string;
  refresh_token: string;
  message: string;
  master_password_hash?: string;
  wrapped_dek?: Record<string, unknown>;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface ApiErrorBody {
  message: string;
}
