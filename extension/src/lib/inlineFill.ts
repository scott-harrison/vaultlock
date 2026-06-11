import { buildFillFieldRefs } from "./fieldMarkers";
import { fillLoginFields } from "./formFillDom";

export interface InlineLoginCredentials {
  username: string;
  password: string;
}

export function fillMatchingLoginInline(
  field: HTMLInputElement,
  fieldType: "username" | "password",
  credentials: InlineLoginCredentials,
): void {
  const { triggerFieldId, associatedFieldId } = buildFillFieldRefs(field, fieldType);

  fillLoginFields({
    username: credentials.username,
    password: credentials.password,
    triggerFieldType: fieldType,
    associatedFieldId,
    triggerFieldId,
  });
}
