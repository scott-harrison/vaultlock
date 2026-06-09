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

export type SaveLoginPromptMode = "save" | "update";

export interface SaveLoginCandidate {
  hostname: string;
  pageUrl: string;
  username: string;
  password: string;
  title: string;
  mode?: SaveLoginPromptMode;
  existingItemId?: string;
}

export interface SaveLoginAvailability {
  authenticated: boolean;
  unlocked: boolean;
}

export type SaveLoginEvaluation =
  | { action: "skip" }
  | { action: "save" }
  | { action: "update"; existingItemId: string }
  | { action: "unavailable" }
  | { action: "locked" };

export interface MatchingLoginPreview {
  id: string;
  title: string;
  username: string;
}

export type MatchingLoginsStatus = "locked" | "unavailable" | "ready";

export interface MatchingLoginsResponse {
  status: MatchingLoginsStatus;
  matches: MatchingLoginPreview[];
}

export interface FillMatchingLoginRequest {
  type: "FILL_MATCHING_LOGIN";
  hostname: string;
  itemId: string;
  fieldType: "username" | "password";
  associatedFieldId?: string;
}

// Chrome runtime message shapes for autofill
export type AutofillMessage =
  | { type: "INDICATOR_CLICKED"; payload: AutofillRequest }
  | { type: "GET_MATCHING_LOGINS_FOR_HOST"; hostname: string }
  | FillMatchingLoginRequest
  | { type: "GET_PENDING_FILL_REQUEST" }
  | { type: "CLEAR_PENDING_FILL_REQUEST" }
  | ExecuteFillPayload
  | { type: "CHECK_SAVE_LOGIN_AVAILABLE" }
  | { type: "EVALUATE_SAVE_LOGIN_CANDIDATE"; candidate: SaveLoginCandidate }
  | { type: "QUEUE_SAVE_LOGIN_BANNER"; candidate: SaveLoginCandidate }
  | { type: "PERSIST_SAVE_LOGIN_BANNER"; candidate: SaveLoginCandidate }
  | { type: "GET_PENDING_SAVE_LOGIN_BANNER" }
  | { type: "CLEAR_PENDING_SAVE_LOGIN_BANNER" }
  | { type: "RENDER_SAVE_LOGIN_BANNER"; candidate: SaveLoginCandidate }
  | { type: "SAVE_LOGIN_CANDIDATE"; candidate: SaveLoginCandidate }
  | { type: "GET_PENDING_SAVE_LOGIN" }
  | { type: "CLEAR_PENDING_SAVE_LOGIN" }
  | { type: "REQUEST_VAULT_DEK_SYNC" };
