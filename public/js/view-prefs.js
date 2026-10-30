// View preferences, stored in the browser (localStorage).
//
// Why not in config.json? These settings describe how THIS screen looks at
// the dashboard (columns or rows, sorting, collapsed sections), not the
// dashboard configuration (services, hosts, language, theme). Keeping them in
// the browser avoids writing a file on disk at every click, avoids carrying a
// layout from one device to another, and sends nothing to the server with each
// request, unlike a cookie.
//
// Storage may be unavailable (private browsing, blocked cookies, quota): the
// application keeps working and the preference only lasts for the session.

const STORAGE_KEY = "dashmon.view";

// Single list of allowed keys: nothing else is ever written, even if a caller
// passes the whole config. The source of truth is VIEW_PREF_KEYS in
// config/normalize.js; it is copied here to avoid a circular dependency.
const ALLOWED = Object.freeze([
  "viewMode",
  "sortMode",
  "groupMode",
  "openMode",
  "smallIcons",
  "collapsed",
  "webLinksHidden",
  "page",
  "dashboardId",
  "supervisionInstanceId",
  "supervisionSmartExpanded",
  "supervisionHostExpanded",
  "supervisionAptExpanded"
]);

function storage() {
  try {
    // Deferred access: the module stays loadable outside a browser (tests).
    const store = globalThis.localStorage;
    if (!store) return null;
    return store;
  } catch (_error) {
    return null; // accès refusé (mode privé strict)
  }
}

// Returns only the view preferences found in an object (the server config,
// for instance), never inventing any.
export function pickViewPrefs(source) {
  if (!source || typeof source !== "object") return {};
  const out = {};
  for (const key of ALLOWED) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

// Preferences saved in this browser. Never throws: corrupted storage is
// treated as empty.
export function loadViewPrefs() {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return pickViewPrefs(parsed);
  } catch (_error) {
    return {};
  }
}

// Saves only the known view preferences. Returns what was actually taken into
// account, so the caller can update its state without sorting again.
export function saveViewPrefs(patch) {
  const applied = pickViewPrefs(patch);
  if (!Object.keys(applied).length) return applied;
  const store = storage();
  if (!store) return applied;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(Object.assign(loadViewPrefs(), applied)));
  } catch (_error) {
    // Quota full or storage disabled: the preference stays valid in memory.
  }
  return applied;
}
