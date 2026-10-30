// "Fortune Cookie" tile: one quote per day, without title or pill.
//
// The quote of the day is deterministic: it derives from the day and the tile
// identity, never from randomness at load time. The same tile shows the same
// quote all day, and a reload does not change it.
//
// The identity is the special tile type ("fortune"), so there is a single
// memory per dashboard. An object identity is still accepted so that older
// calls keep working.
//
// A click draws another quote. That choice is remembered in the browser along
// with the day that produced it: the next day the memory is invalidated and
// the tile goes back to the quote of the day. As with view preferences,
// storage may be unavailable; the tile still works, only the remembered click
// is lost.

const STORAGE_KEY = "dashmon.fortune";
const MESSAGES_URL = "/fortune-messages.json";

let messages = [];
let loading = null;

// Stable identity of a tile: the type when given as is, otherwise the
// name / host / category concatenation (older calls).
function asKey(identity) {
  if (typeof identity === "string") return identity;
  return [
    (identity && identity.name) || "",
    (identity && identity.host) || "",
    (identity && identity.category) || ""
  ].join("|");
}

function storage() {
  try {
    const store = globalThis.localStorage;
    return store || null;
  } catch (_error) {
    return null;
  }
}

// Local day, as YYYY-MM-DD. Deliberately not ISO / UTC: the quote must change
// at the reader's midnight, not at that of a distant time zone.
export function dayStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 32-bit FNV-1a: fast, dependency-free and spread enough to pick a quote
// index.
export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function fortuneKey(identity) {
  return asKey(identity);
}

// Quotes validated on load: the file ships with the repository, but a broken
// file must neither leave an empty tile nor break the rendering.
function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item && typeof item === "object")
    .map(item => ({
      id: String(item.id || ""),
      fr: typeof item.fr === "string" ? item.fr : "",
      en: typeof item.en === "string" ? item.en : ""
    }))
    .filter(item => item.fr || item.en);
}

export function loadFortunes() {
  if (messages.length) return Promise.resolve(messages);
  if (!loading) {
    loading = fetch(MESSAGES_URL)
      .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(raw => {
        messages = normalizeMessages(raw);
        return messages;
      })
      .catch(error => {
        console.error("Chargement des phrases impossible", error);
        loading = null;
        messages = [];
        return messages;
      });
  }
  return loading;
}

export function fortuneCount() {
  return messages.length;
}

// Tests and the renderer need the list without going through the network.
export function setFortunes(list) {
  messages = normalizeMessages(list);
  loading = messages.length ? Promise.resolve(messages) : null;
}

function phraseOf(message, language) {
  if (!message) return "";
  if (language === "en") return message.en || message.fr;
  return message.fr || message.en;
}

// Click memory, per tile and per day. An entry from another day is ignored on
// read, then dropped on write: the map does not grow from one day to the
// next.
function readOverrides() {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeOverride(key, index, day) {
  const store = storage();
  if (!store) return;
  const overrides = readOverrides();
  for (const existing of Object.keys(overrides)) {
    if (overrides[existing] && overrides[existing].day !== day) delete overrides[existing];
  }
  overrides[key] = { day, index };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (_error) {
    // Quota full or storage disabled: the choice stays valid for the session.
  }
}

// Index of the quote shown: the remembered one if it exists and dates from
// today, otherwise derived from the day and the tile.
export function currentFortuneIndex(key, day = dayStamp()) {
  if (!messages.length) return -1;
  const overrides = readOverrides();
  const saved = overrides[key];
  if (
    saved &&
    saved.day === day &&
    Number.isInteger(saved.index) &&
    saved.index >= 0 &&
    saved.index < messages.length
  ) {
    return saved.index;
  }
  return hashString(`${day}|${key}`) % messages.length;
}

export function fortuneText(identity, language, day = dayStamp()) {
  const index = currentFortuneIndex(asKey(identity), day);
  if (index < 0) return "";
  return phraseOf(messages[index], language);
}

// Draws another quote. A full round comes back to the remembered quote, so it
// never loops forever when only one message remains.
export function pickFortune(identity, language, day = dayStamp()) {
  if (messages.length < 1) return "";
  const key = asKey(identity);
  const current = currentFortuneIndex(key, day);
  const offset = hashString(`${day}|${key}|${Math.random()}`) % messages.length;
  const next = (current + 1 + offset) % messages.length;
  writeOverride(key, next, day);
  return phraseOf(messages[next], language);
}
