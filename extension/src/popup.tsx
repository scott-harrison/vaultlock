import { toBase64 } from "@vaultlock/shared/crypto";
import { useEffect, useState } from "react";
import { getServerSettings } from "./lib/storage";

function IndexPopup() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [demo, setDemo] = useState("");
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    async function init() {
      // Demonstrate successful import from @vaultlock/shared
      try {
        const sample = new TextEncoder().encode("vaultlock");
        const encoded = toBase64(sample);
        setDemo(encoded);
      } catch (err) {
        console.error("Failed to import from @vaultlock/shared", err);
      }

      // Demonstrate the storage helper layer created in 12-01
      try {
        const settings = await getServerSettings();
        setServerUrl(settings.serverUrl);
      } catch (err) {
        console.error("Storage helper error", err);
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
          <p style={{ marginBottom: 8, fontSize: 13 }}>
            ✅ Scaffold working — importing from <code>@vaultlock/shared</code>
          </p>
          {demo && (
            <p style={{ fontSize: 12, color: "#555", wordBreak: "break-all" }}>
              Demo (toBase64): {demo}
            </p>
          )}
          {serverUrl && (
            <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Server: {serverUrl}</p>
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
            Sub-task 12-01 complete. Real functionality starts in 12-02+.
          </p>
        </div>
      )}
    </div>
  );
}

export default IndexPopup;
