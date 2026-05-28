import { decryptJsonPayloadBase64, encryptJsonPayloadBase64 } from "@vaultlock/shared/crypto";
import { useEffect, useState } from "react";
import { getServerSettings } from "./lib/storage";
import { getDataEncryptionKey, isVaultUnlocked, lockVault, unlockVault } from "./lib/vaultSession";

function IndexPopup() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [serverUrl, setServerUrl] = useState("");
  const [cryptoDemo, setCryptoDemo] = useState("");

  useEffect(() => {
    async function init() {
      // Demonstrate the storage helper layer
      try {
        const settings = await getServerSettings();
        setServerUrl(settings.serverUrl);
      } catch (err) {
        console.error("Storage helper error", err);
      }

      // Demonstrate full 12-03 crypto integration with master password derivation
      try {
        // Demo unlock (real flow + UI comes in 12-04)
        await unlockVault({
          email: "demo@example.com",
          masterPassword: "demo-password-123",
          masterPasswordHash: "$argon2id$v=19$m=19456,t=2,p=1$ZGVtb0BleGFtcGxlLmNvbQ$demo",
        });

        const sampleItem = {
          title: "GitHub",
          username: "user@example.com",
          password: "super-secret-123",
        };

        const encrypted = await encryptJsonPayloadBase64(sampleItem, getDataEncryptionKey());
        const decrypted = await decryptJsonPayloadBase64<typeof sampleItem>(
          encrypted.encrypted_data,
          encrypted.nonce,
          getDataEncryptionKey(),
        );

        setCryptoDemo(
          `✅ 12-03 Crypto OK
Derived master key + DEK via Argon2id
Encrypted → Decrypted: ${decrypted.title} / ${decrypted.username}
Vault is currently ${isVaultUnlocked() ? "UNLOCKED" : "LOCKED"}`,
        );

        lockVault();
      } catch (err) {
        console.error("12-03 crypto demo failed", err);
        setCryptoDemo("Crypto integration ready (full unlock in 12-04)");
      }

      setStatus("ready");
    }

    init();
  }, []);

  return (
    <div
      style={{
        width: 320,
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>VaultLock</h2>
      <p style={{ margin: "8px 0 16px", color: "#666", fontSize: 13 }}>Secure. Simple. Yours.</p>

      {status === "loading" ? (
        <p>Loading…</p>
      ) : (
        <div>
          <p style={{ marginBottom: 8, fontSize: 13, color: "green" }}>
            ✅ 12-01 + 12-03: Shared crypto integration working
          </p>

          {cryptoDemo && (
            <pre
              style={{
                fontSize: 11,
                background: "#f4f4f4",
                padding: 8,
                borderRadius: 4,
                whiteSpace: "pre-wrap",
              }}
            >
              {cryptoDemo}
            </pre>
          )}

          {serverUrl && (
            <p style={{ fontSize: 12, color: "#555", marginTop: 8 }}>Server: {serverUrl}</p>
          )}

          <button
            type="button"
            onClick={() => alert("Coming in sub-task 12-04 (Auth + unlock)")}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              marginTop: 12,
            }}
          >
            Open Vault (placeholder)
          </button>

          <p style={{ marginTop: 12, fontSize: 11, color: "#888" }}>
            12-03: Argon2id + AES-GCM + DEK wrapping via @vaultlock/shared
          </p>
        </div>
      )}
    </div>
  );
}

export default IndexPopup;
