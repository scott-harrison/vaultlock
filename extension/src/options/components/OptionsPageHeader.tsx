import { AuthBrand } from "../../popup/components/AuthBrand";

export function OptionsPageHeader() {
  return (
    <header className="space-y-6 border-b border-border pb-6">
      <AuthBrand />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Extension settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure how this extension connects to your Vaultlock server. Settings are stored
          locally in your browser.
        </p>
      </div>
    </header>
  );
}
