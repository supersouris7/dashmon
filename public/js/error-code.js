// Text key of an API error or failed check ("apiError_<code>"), or "" when
// the body carries no known-looking code. No imports: usable by any module,
// widget-registry.js included (it is loaded by the configuration itself).
export function errorKey(body) {
  const code = [body?.errorCode, body?.code].find(
    value => typeof value === "string" && /^[a-z_]{1,40}$/.test(value)
  );
  return code ? "apiError_" + code : "";
}

export function errorMessage(body) {
  return typeof body?.error === "string" ? body.error.trim() : "";
}
