"use strict";
// API errors: a stable code, translated by the interface (public/js/i18n,
// keys "apiError_<code>"), and an English text for scripts and curl.
// Responses carry both: { code, error }. An older agent sends only a text,
// which the interface shows as it is.

const API_ERRORS = Object.freeze({
  agent_auth_required: "Agent authentication required",
  agent_config_conflict: "Agent configuration changed elsewhere",
  agent_config_unreachable: "Agent configuration unreachable; check its version and token",
  agent_disabled: "Agent not enabled",
  agent_mode_route: "Route not available in agent mode",
  agent_not_paired: "Agent not paired",
  agents_collect_failed: "Agents could not be collected",
  auth_invalid: "Invalid authentication",
  auth_required: "Authentication required",
  builtin_theme: "A built-in theme cannot be deleted",
  config_conflict: "The configuration changed; reload before saving",
  config_read_failed: "config.json could not be read",
  config_write_failed: "config.json could not be written",
  csrf_rejected: "Request refused (CSRF)",
  file_too_large: "File too large",
  image_delete_failed: "The image could not be deleted",
  image_import_failed: "The image could not be imported",
  image_not_found: "Image not found",
  images_read_failed: "The images could not be read",
  instance_unreachable: "Instance unreachable",
  internal_error: "Internal error",
  invalid_agent_config: "Invalid agent configuration",
  invalid_agent_response: "Invalid agent response",
  invalid_config: "Invalid configuration",
  invalid_config_patch: "Invalid configuration patch",
  invalid_image_name: "Invalid image name",
  invalid_json: "Invalid JSON body",
  invalid_key: "Invalid key",
  invalid_png: "Not a valid PNG image",
  invalid_theme: "Invalid theme: id and the 10 variables are required",
  invalid_theme_id: "Invalid theme id",
  invalid_url: "Invalid URL",
  link_local_refused: "Link-local address refused",
  metrics_read_failed: "The measurements could not be read",
  read_failed: "Read failed",
  revision_required: "Revision required",
  route_not_found: "Unknown route",
  save_failed: "Save failed",
  sync_auth_required: "Sync authentication required",
  sync_token_missing: "DASHMON_SYNC_TOKEN is not set",
  theme_delete_failed: "The theme could not be deleted",
  theme_export_failed: "The theme could not be exported",
  theme_import_failed: "The theme could not be imported",
  theme_not_found: "Theme not found",
  themes_read_failed: "The themes could not be read",
  token_missing: "Token missing",
  too_many_attempts: "Too many attempts, try again later",
  too_many_requests: "Too many requests, try again later",
  unknown_widget: "Unknown widget or widget without backend",
  unsupported_protocol: "Unsupported protocol",
  usage_increment_failed: "The counter could not be incremented"
});

// { code, error } for a JSON body or a widget result.
function apiError(code) {
  if (!Object.hasOwn(API_ERRORS, code)) throw new Error("Unknown API error code: " + code);
  return { code, error: API_ERRORS[code] };
}

// The same for a check result (service probe, widget status): there "code"
// is already the HTTP status, so the error code is "errorCode".
function resultError(code) {
  return { errorCode: code, error: apiError(code).error };
}

module.exports = { API_ERRORS, apiError, resultError };
