import { useEffect } from "react";
import "./extension-ui.css";
import { applyExtensionTheme } from "./lib/extensionTheme";
import { OptionsPageHeader } from "./options/components/OptionsPageHeader";
import { OptionsShell } from "./options/components/OptionsShell";
import { ServerConnectionSection } from "./options/components/ServerConnectionSection";
import { useServerOptions } from "./options/hooks/useServerOptions";

export default function OptionsPage() {
  useEffect(() => {
    applyExtensionTheme();
  }, []);

  const {
    serverUrl,
    advanced,
    lastStatus,
    normalizedUrl,
    isTesting,
    isSaving,
    isBusy,
    currentTestResult,
    currentError,
    saveMessage,
    setAdvanced,
    handleServerUrlChange,
    handleTest,
    handleSave,
    handleReset,
  } = useServerOptions();

  return (
    <OptionsShell>
      <OptionsPageHeader />
      <ServerConnectionSection
        serverUrl={serverUrl}
        advanced={advanced}
        normalizedUrl={normalizedUrl}
        isTesting={isTesting}
        isSaving={isSaving}
        isBusy={isBusy}
        currentTestResult={currentTestResult}
        currentError={currentError}
        saveMessage={saveMessage}
        lastStatus={lastStatus}
        onServerUrlChange={handleServerUrlChange}
        onAdvancedChange={setAdvanced}
        onTest={() => void handleTest()}
        onSave={() => void handleSave()}
        onReset={handleReset}
      />
    </OptionsShell>
  );
}
