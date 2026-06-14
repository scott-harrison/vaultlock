import { AuthBrand } from "./AuthBrand";

interface PopupHeaderProps {
  serverUrl?: string;
}

export function PopupHeader({ serverUrl }: PopupHeaderProps) {
  return (
    <header className="mb-4 space-y-1">
      <AuthBrand />
      {serverUrl ? (
        <p className="truncate text-xs text-muted-foreground" title={serverUrl}>
          {serverUrl}
        </p>
      ) : null}
    </header>
  );
}
