import { VAULT_ITEM_TYPES } from "@vaultlock/shared/types";
import "./App.css";

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>Vaultlock</h1>
        <p className="tagline">Secure. Simple. Yours.</p>
      </header>

      <section className="card">
        <h2>Desktop client</h2>
        <p>Tauri scaffold is running. Supported vault item types: {VAULT_ITEM_TYPES.join(", ")}.</p>
        <p className="hint">
          Configure your server URL and sign in — coming in sub-tasks 11-02 and 11-04.
        </p>
      </section>
    </main>
  );
}

export default App;
