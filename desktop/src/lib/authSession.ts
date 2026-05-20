import { load } from "@tauri-apps/plugin-store";

const AUTH_STORE = "auth.json";
const SESSION_KEY = "session";
const CREDENTIALS_KEY = "credentials";

export interface AuthSession {
  email: string;
  accessToken: string;
  refreshToken: string;
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
  return (await store.get<AuthSession>(SESSION_KEY)) ?? null;
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
