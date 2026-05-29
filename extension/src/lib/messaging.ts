/**
 * Message types for extension communication (background <-> content scripts <-> popup).
 *
 * Used for the fill-on-click (autofill) flow and other cross-context messaging.
 */

export interface AutofillRequest {
  hostname: string;
  fieldType: "username" | "password";
  associatedFieldId?: string;
}

// Chrome runtime message shapes for autofill
export type AutofillMessage =
  | { type: "INDICATOR_CLICKED"; payload: AutofillRequest }
  | { type: "GET_PENDING_FILL_REQUEST" }
  | { type: "CLEAR_PENDING_FILL_REQUEST" };
