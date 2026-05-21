import { describe, expect, it, vi } from "vitest";
import { VaultlockApiClient, VaultlockApiError } from "../src/api/client";

describe("VaultlockApiClient", () => {
  it("checks health endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });

    const client = new VaultlockApiClient({
      baseUrl: "https://vault.example.com/",
      fetch: fetchMock,
    });

    await expect(client.healthCheck()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://vault.example.com/health");
  });

  it("sends bearer token on vault list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], sync_token: null }),
    });

    const client = new VaultlockApiClient({
      baseUrl: "http://localhost:8080",
      fetch: fetchMock,
    });

    await client.listVaultItems("jwt-token", "2026-05-20T00:00:00Z");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/vault/items?since=2026-05-20T00%3A00%3A00Z",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
  });

  it("uses bound default fetch when none provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "ok",
    } as Response);

    const client = new VaultlockApiClient({ baseUrl: "http://localhost:8080" });
    await expect(client.healthCheck()).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8080/health", undefined);

    fetchSpy.mockRestore();
  });

  it("throws VaultlockApiError on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ message: "invalid token" }),
    });

    const client = new VaultlockApiClient({
      baseUrl: "http://localhost:8080",
      fetch: fetchMock,
    });

    await expect(client.login({ email: "a@b.co", master_password: "secret" })).rejects.toEqual(
      new VaultlockApiError(401, "invalid token"),
    );
  });
});
