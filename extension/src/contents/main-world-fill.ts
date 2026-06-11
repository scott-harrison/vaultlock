import type { PlasmoCSConfig } from "plasmo";
import { setInputValueInPageContext } from "../lib/inputSimulationCore";
import {
  MAIN_WORLD_FILL_REQUEST_EVENT,
  type MainWorldFillRequestDetail,
  resolveMainWorldFillTarget,
} from "../lib/mainWorldFillBridge";

export const config: PlasmoCSConfig = {
  world: "MAIN",
  all_frames: true,
  run_at: "document_start",
};

document.addEventListener(MAIN_WORLD_FILL_REQUEST_EVENT, (event) => {
  if (!(event instanceof CustomEvent)) {
    return;
  }

  const detail = event.detail as MainWorldFillRequestDetail | undefined;
  if (!detail?.value) {
    return;
  }

  const target = resolveMainWorldFillTarget(detail);
  if (!target) {
    return;
  }

  setInputValueInPageContext(target, detail.value, {
    nudgeTrustedInput: detail.nudgeTrustedInput,
    preferTypedInsert: detail.preferTypedInsert,
  });
  detail.success = true;
});
