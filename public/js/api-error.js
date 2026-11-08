// Text of an API error or of a failed check, in the interface language. The
// server sends a stable code ("code" in a response, "errorCode" in a check
// result) and an English text (lib/http/api-errors.js); an older agent sends
// only a text, shown as it is.
import { t } from "./i18n.js";
import { errorKey, errorMessage } from "./error-code.js";

export function errorText(body, fallbackKey = "") {
  const key = errorKey(body);
  if (key && t(key) !== key) return t(key);
  return errorMessage(body) || (fallbackKey ? t(fallbackKey) : "");
}
