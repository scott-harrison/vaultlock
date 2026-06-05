import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  loadServerSettingsWithAdvanced,
  normalizeServerBaseUrl,
  saveServerConnection,
  testServerConnection,
} from "../../lib/serverSettings";
import type { LastConnectionStatus } from "../../lib/storage";

export type TestResult = "idle" | "success" | "error";

export function useServerOptions() {
  const [serverUrl, setServerUrl] = useState("");
  const [advanced, setAdvanced] = useState<ServerAdvancedOptions>(DEFAULT_SERVER_ADVANCED);
  const [lastStatus, setLastStatus] = useState<LastConnectionStatus | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTestResult, setCurrentTestResult] = useState<TestResult>("idle");
  const [currentError, setCurrentError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const normalizedUrl = serverUrl ? normalizeServerBaseUrl(serverUrl) : "";
  const isBusy = isTesting || isSaving;

  const refreshFromStorage = useCallback(async () => {
    const fresh = await loadServerSettingsWithAdvanced();
    setLastStatus(fresh.lastStatus ?? null);
  }, []);

  useEffect(() => {
    loadServerSettingsWithAdvanced().then(({ url, advanced: adv, lastStatus: status }) => {
      setServerUrl(url);
      setAdvanced(adv);
      setLastStatus(status ?? null);
    });
  }, []);

  const validateUrl = useCallback((): boolean => {
    if (!serverUrl.trim()) {
      setCurrentError("Please enter a server URL");
      return false;
    }
    return true;
  }, [serverUrl]);

  const handleServerUrlChange = useCallback((value: string) => {
    setServerUrl(value);
    setCurrentTestResult("idle");
    setCurrentError("");
    setSaveMessage("");
  }, []);

  const handleTest = useCallback(async () => {
    if (!validateUrl()) return;

    setIsTesting(true);
    setCurrentTestResult("idle");
    setCurrentError("");
    setSaveMessage("");

    try {
      const result = await testServerConnection(serverUrl, advanced);
      setCurrentTestResult(result.success ? "success" : "error");
      if (!result.success) {
        setCurrentError(result.error || "Connection test failed");
      }
      await refreshFromStorage();
    } catch (err) {
      setCurrentTestResult("error");
      setCurrentError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  }, [advanced, refreshFromStorage, serverUrl, validateUrl]);

  const handleSave = useCallback(async () => {
    if (!validateUrl()) return;

    setIsSaving(true);
    setSaveMessage("");
    setCurrentError("");

    try {
      await saveServerConnection(serverUrl, advanced);
      setSaveMessage("Settings saved successfully.");
      await refreshFromStorage();
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [advanced, refreshFromStorage, serverUrl, validateUrl]);

  const handleReset = useCallback(() => {
    setServerUrl("http://localhost:8080");
    setAdvanced(DEFAULT_SERVER_ADVANCED);
    setCurrentTestResult("idle");
    setCurrentError("");
    setSaveMessage("");
  }, []);

  return {
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
  };
}
