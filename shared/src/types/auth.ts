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
  master_password_hash: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface AuthResponse {
  access_token: string;
  token: string;
  refresh_token: string;
  message: string;
}

export interface ApiErrorBody {
  message: string;
}
