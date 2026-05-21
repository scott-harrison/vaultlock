interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <output className="loading-overlay" aria-live="polite">
      <div className="loading-spinner" aria-hidden />
      <p>{message}</p>
    </output>
  );
}
