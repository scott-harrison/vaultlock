import { useEffect, useState } from "react";

function IndexPopup() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    // Placeholder — in 12-02+ we will connect to the real backend + shared crypto
    setTimeout(() => setStatus("ready"), 300);
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
          <p style={{ marginBottom: 12 }}>Extension scaffold is running.</p>
          <button
            type="button"
            onClick={() => alert("Coming in sub-task 12-04 (Auth + unlock)")}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
            }}
          >
            Open Vault (placeholder)
          </button>
        </div>
      )}
    </div>
  );
}

export default IndexPopup;
