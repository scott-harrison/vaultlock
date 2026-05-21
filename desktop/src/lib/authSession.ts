import { load } from "@tauri-apps/plugin-store";

const AUTH_STORE = "auth.json";
const SESSION_KEY = "session";
const CREDENTIALS_KEY = "credentials";
const PENDING_VERIFICATION_KEY = "pending_verification_email";

export interface AuthSession {
  email: string;
  accessToken: string;
  refreshToken: string;
}

type StoredSession = AuthSession & {
  access_token?: string;
  refresh_token?: string;
  token?: string;
};

function normalizeAuthSession(raw: StoredSession | null): AuthSession | null {
  if (!raw?.email) {
    return null;
  }

  const accessToken = raw.accessToken || raw.access_token || raw.token || "";
  const refreshToken = raw.refreshToken || raw.refresh_token || "";

  if (!accessToken) {
    return null;
  }

  return {
    email: raw.email,
    accessToken,
    refreshToken,
  };
}

function sessionFromAuthResponse(
  email: string,
  response: { access_token?: string; token?: string; refresh_token?: string },
): AuthSession {
  const accessToken = response.access_token || response.token;
  if (!accessToken) {
    throw new Error("Server did not return an access token.");
  }

  return {
    email,
    accessToken,
    refreshToken: response.refresh_token ?? "",
  };
}

export interface StoredCredentials {
  email: string;
  masterPasswordHash: string;
}

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load(AUTH_STORE);
  }
  return storePromise;
}

export async function loadSession(): Promise<AuthSession | null> {
  const store = await getStore();
  const raw = await store.get<StoredSession>(SESSION_KEY);
  return normalizeAuthSession(raw ?? null);
}

export async function saveSession(session: AuthSession): Promise<void> {
  const store = await getStore();
  await store.set(SESSION_KEY, session);
  await store.save();
}

export async function clearSession(): Promise<void> {
  const store = await getStore();
  await store.delete(SESSION_KEY);
  await store.save();
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const store = await getStore();
  return (await store.get<StoredCredentials>(CREDENTIALS_KEY)) ?? null;
}

export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  const store = await getStore();
  await store.set(CREDENTIALS_KEY, credentials);
  await store.save();
}

export async function loadPendingVerificationEmail(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>(PENDING_VERIFICATION_KEY)) ?? null;
}

export async function savePendingVerificationEmail(email: string): Promise<void> {
  const store = await getStore();
  await store.set(PENDING_VERIFICATION_KEY, email);
  await store.save();
}

export async function clearPendingVerificationEmail(): Promise<void> {
  const store = await getStore();
  await store.delete(PENDING_VERIFICATION_KEY);
  await store.save();
}

/** Logout: wipe session, credentials, and pending verification. Server URL is kept. */
export async function clearAllAuthData(): Promise<void> {
  const store = await getStore();
  await store.delete(SESSION_KEY);
  await store.delete(CREDENTIALS_KEY);
  await store.delete(PENDING_VERIFICATION_KEY);
  await store.save();
}

export { normalizeAuthSession, sessionFromAuthResponse };
