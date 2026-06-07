/**
 * Message types for extension communication (background <-> content scripts <-> popup).
 *
 * Used for the fill-on-click (autofill) flow and other cross-context messaging.
 */

export interface AutofillRequest {
  hostname: string;
  fieldType: "username" | "password";
  associatedFieldId?: string;
  tabId?: number;
}

export interface ExecuteFillPayload {
  type: "EXECUTE_FILL";
  hostname: string;
  username: string;
  password: string;
  fieldType: "username" | "password";
  associatedFieldId?: string;
}

export interface SaveLoginCandidate {
  hostname: string;
  pageUrl: string;
  username: string;
  password: string;
  title: string;
}

export interface SaveLoginAvailability {
  authenticated: boolean;
}

// Chrome runtime message shapes for autofill
export type AutofillMessage =
  | { type: "INDICATOR_CLICKED"; payload: AutofillRequest }
  | { type: "GET_PENDING_FILL_REQUEST" }
  | { type: "CLEAR_PENDING_FILL_REQUEST" }
  | ExecuteFillPayload
  | { type: "CHECK_SAVE_LOGIN_AVAILABLE" }
  | { type: "SAVE_LOGIN_CANDIDATE"; candidate: SaveLoginCandidate }
  | { type: "GET_PENDING_SAVE_LOGIN" }
  | { type: "CLEAR_PENDING_SAVE_LOGIN" };
