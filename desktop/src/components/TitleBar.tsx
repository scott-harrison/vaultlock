import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

function getWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function TitleBar() {
  const win = getWindow();

  const startWindowDrag = (event: React.PointerEvent) => {
    if (event.button !== 0 || !win) {
      return;
    }
    event.preventDefault();
    void win.startDragging();
  };

  const stopDrag = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  return (
    <header className="titlebar">
      <div className="titlebar-drag" data-tauri-drag-region onPointerDown={startWindowDrag}>
        <span className="titlebar-logo" aria-hidden>
          VL
        </span>
        <span className="titlebar-name">Vaultlock</span>
      </div>

      <div className="titlebar-controls" onPointerDown={stopDrag}>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={() => {
            void win?.minimize();
          }}
        >
          <Minus size={14} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Maximize"
          onClick={() => {
            void win?.toggleMaximize();
          }}
        >
          <Square size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="Close"
          onClick={() => {
            void win?.close();
          }}
        >
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>
  );
}
