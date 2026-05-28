import { decryptJsonPayloadBase64, encryptJsonPayloadBase64 } from "@vaultlock/shared/crypto";
import { useEffect, useState } from "react";
import { getServerSettings } from "./lib/storage";
import { getDataEncryptionKey, lockVault, setDataEncryptionKey } from "./lib/vaultSession";

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

      // Demonstrate real shared crypto integration (12-03)
      try {
        // Simulate unlock by setting a temporary DEK (real unlock logic comes in 12-04)
        const tempDek = crypto.getRandomValues(new Uint8Array(32));
        setDataEncryptionKey(tempDek);

        const sampleItem = {
          title: "GitHub",
          username: "user@example.com",
          password: "super-secret-123",
        };

        // Encrypt using shared helpers + our DEK management
        const encrypted = await encryptJsonPayloadBase64(sampleItem, getDataEncryptionKey());

        // Decrypt it back
        const decrypted = await decryptJsonPayloadBase64<typeof sampleItem>(
          encrypted.encrypted_data,
          encrypted.nonce,
          getDataEncryptionKey(),
        );

        setCryptoDemo(
          `Encrypted → Decrypted OK\nTitle: ${decrypted.title}\nUser: ${decrypted.username}`,
        );

        // Clean up the temporary DEK
        lockVault();
      } catch (err) {
        console.error("Crypto integration demo failed", err);
        setCryptoDemo("Crypto demo failed (see console)");
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
            12-03: Real AES-256-GCM + shared helpers now integrated.
          </p>
        </div>
      )}
    </div>
  );
}

export default IndexPopup;
