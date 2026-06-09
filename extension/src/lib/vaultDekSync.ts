export async function syncVaultDekToBackground(): Promise<void> {
  const { getDataEncryptionKey, isVaultUnlocked } = await import("./vaultDekState");
  if (!isVaultUnlocked()) {
    return;
  }

  const dek = getDataEncryptionKey();
  await chrome.runtime
    .sendMessage({
      type: "SYNC_VAULT_DEK",
      dek: Array.from(dek),
    })
    .catch(() => {});
}
