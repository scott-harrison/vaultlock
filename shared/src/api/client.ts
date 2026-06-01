import type {
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
} from "../types/auth";
import type {
  CreateVaultItemRequest,
  UpdateVaultItemRequest,
  VaultItemListResponse,
  VaultItemResponse,
} from "../types/vault";

export class VaultlockApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "VaultlockApiError";
  }
}

export interface VaultlockApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

/** Browser fetch must not be extracted unbound — breaks Tauri/WebView. */
function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

export class VaultlockApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VaultlockApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? defaultFetch;
  }

  async healthCheck(): Promise<boolean> {
    const response = await this.fetchImpl(`${this.baseUrl}/health`);
    if (!response.ok) {
      return false;
    }
    const body = await response.text();
    return body.includes("ok");
  }

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    return this.requestJson("POST", "/register", { body: JSON.stringify(payload) });
  }

  async verifyEmail(payload: VerifyEmailRequest): Promise<AuthResponse> {
    return this.requestJson("POST", "/verify-email", { body: JSON.stringify(payload) });
  }

  async login(payload: LoginRequest): Promise<AuthResponse> {
    return this.requestJson("POST", "/login", { body: JSON.stringify(payload) });
  }

  async refresh(payload: RefreshRequest): Promise<AuthResponse> {
    return this.requestJson("POST", "/refresh", { body: JSON.stringify(payload) });
  }

  async listVaultItems(accessToken: string, since?: string): Promise<VaultItemListResponse> {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.requestJson("GET", `/vault/items${query}`, { accessToken });
  }

  async getVaultItem(accessToken: string, itemId: string): Promise<VaultItemResponse> {
    return this.requestJson("GET", `/vault/items/${itemId}`, { accessToken });
  }

  async createVaultItem(
    accessToken: string,
    payload: CreateVaultItemRequest,
  ): Promise<VaultItemResponse> {
    return this.requestJson("POST", "/vault/items", {
      accessToken,
      body: JSON.stringify(payload),
    });
  }

  async saveWrappedDek(accessToken: string, wrappedDek: Record<string, unknown>): Promise<void> {
    await this.requestJson("POST", "/users/me/wrapped-dek", {
      accessToken,
      body: JSON.stringify({ wrapped_dek: wrappedDek }),
    });
  }

  async updateVaultItem(
    accessToken: string,
    itemId: string,
    payload: UpdateVaultItemRequest,
  ): Promise<VaultItemResponse> {
    return this.requestJson("PUT", `/vault/items/${itemId}`, {
      accessToken,
      body: JSON.stringify(payload),
    });
  }

  async deleteVaultItem(accessToken: string, itemId: string): Promise<void> {
    await this.requestJson("DELETE", `/vault/items/${itemId}`, { accessToken });
  }

  private async requestJson<T>(
    method: string,
    path: string,
    options: { accessToken?: string; body?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body,
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        // non-JSON error body
      }
      throw new VaultlockApiError(response.status, message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
