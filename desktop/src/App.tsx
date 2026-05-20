import { ServerSettings } from "./components/ServerSettings";
import "./App.css";

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>Vaultlock</h1>
        <p className="tagline">Secure. Simple. Yours.</p>
      </header>

      <ServerSettings />
    </main>
  );
}

export default App;
