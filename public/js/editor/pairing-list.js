// List of paired agents in the pairing panel.
import { agentUrl } from "./replication-draft.js";
import { t } from "../i18n.js";
import { isEncryptedSecret } from "../widget-registry.js";

function setStatus(status, state, text) {
  status.className = "agent-test-status" + (state ? " " + state : "");
  const icon = document.createElement("i");
  icon.className =
    state === "ok"
      ? "fa-solid fa-circle-check"
      : state === "error"
        ? "fa-solid fa-circle-xmark"
        : "fa-solid fa-spinner fa-spin";
  icon.setAttribute("aria-hidden", "true");
  status.replaceChildren(icon, document.createTextNode(text));
}

const TEST_FAILURES = {
  token_missing: "agentTokenMissing",
  unauthorized: "agentUnauthorized",
  not_agent: "agentNotAgent",
  invalid_url: "agentInvalidUrl",
  invalid_response: "agentInvalidResponse",
  incompatible_protocol: "agentIncompatible"
};

// Asks the server to reach the agent with the token of its row (typed, or the
// mask of the saved one), and shows the outcome next to the button.
async function testAgent(entry, button, status) {
  const target = agentUrl(entry.url);
  if (!target) {
    setStatus(status, "error", t("agentInvalidUrl"));
    return;
  }
  button.disabled = true;
  setStatus(status, "pending", t("agentTesting"));
  try {
    const response = await fetch("/api/agents/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target, token: entry.token || "" })
    });
    const result = await response.json();
    setStatus(
      status,
      result.ok ? "ok" : "error",
      t(result.ok ? "agentConnected" : TEST_FAILURES[result.reason] || "agentUnreachable")
    );
  } catch (_error) {
    setStatus(status, "error", t("agentUnreachable"));
  } finally {
    button.disabled = false;
  }
}

function button(text, className) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text;
  return element;
}

// Host whose colour and icon dress the agent tab. A host deleted since is
// dropped from the pairing.
function agentHostSelect(entry, hostChoices, syncPairs) {
  const select = document.createElement("select");
  select.className = "edit-select";
  select.title = t("agentHostLabel");
  for (const [value, label] of [
    ["", t("agentHostNone")],
    ...hostChoices().map(host => [host.id, host.name])
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = entry.host || "";
  if (select.value !== (entry.host || "")) {
    entry.host = "";
    syncPairs();
  }
  select.addEventListener("change", () => {
    entry.host = select.value;
    syncPairs();
  });
  return select;
}

// Address of the agent, checked as it is typed and completed on blur
// ("192.0.2.4:8080" becomes "http://192.0.2.4:8080/"). Typing clears the
// result of a previous test.
function agentUrlInput(entry, syncPairs, status) {
  const input = document.createElement("input");
  input.className = "edit-input";
  input.placeholder = "https://agent.exemple.lan:8080";
  input.maxLength = 300;
  input.value = entry.url || "";
  const invalid = document.createElement("p");
  invalid.className = "host-monitor-hint agent-url-error";
  invalid.textContent = t("agentInvalidUrl");
  invalid.hidden = true;
  // Over plain HTTP the agent token crosses the network in clear.
  const plain = document.createElement("p");
  plain.className = "host-monitor-hint agent-url-warning";
  plain.textContent = t("agentPlainHttp");
  plain.hidden = true;
  const validate = () => {
    const raw = String(entry.url || "").trim();
    const normalized = raw ? agentUrl(raw) : "";
    const ok = !raw || Boolean(normalized);
    input.setAttribute("aria-invalid", String(!ok));
    invalid.hidden = ok;
    plain.hidden = !normalized || !normalized.startsWith("http:");
  };
  input.addEventListener("input", () => {
    entry.url = input.value;
    syncPairs();
    validate();
    status.className = "agent-test-status";
    status.replaceChildren();
  });
  input.addEventListener("blur", () => {
    const normalized = agentUrl(entry.url);
    if (normalized) entry.url = normalized;
    input.value = entry.url || "";
    syncPairs();
    validate();
  });
  return { input, invalid, plain, validate };
}

// Mask of the token saved for each row, kept out of the entry (the draft
// snapshot compares entries) so that emptying the field restores it.
const savedTokens = new WeakMap();

// Token of the agent (its DASHMON_SYNC_TOKEN). Never shown in clear once
// saved: the field stays empty and says so; typing replaces it. Typing also
// clears the result of a previous test.
function agentTokenInput(entry, syncPairs, status) {
  const input = document.createElement("input");
  input.className = "edit-input";
  input.type = "password";
  input.autocomplete = "new-password";
  input.maxLength = 500;
  const saved = isEncryptedSecret(entry.token);
  if (saved) savedTokens.set(entry, entry.token);
  input.placeholder = saved ? t("agentTokenSaved") : t("agentTokenPlaceholder");
  input.value = saved ? "" : entry.token || "";
  input.addEventListener("input", () => {
    // Emptied: back to the saved token, if any.
    entry.token = input.value || savedTokens.get(entry) || "";
    syncPairs();
    status.className = "agent-test-status";
    status.replaceChildren();
  });
  return input;
}

// Rows of the pairing list. The draft and the save remain the responsibility
// of the editor, which provides the callbacks.
export function createPairingList({
  list,
  entries,
  hostChoices,
  syncPairs,
  confirmDelete,
  monitoringField,
  setAddDisabled
}) {
  function row(entry, index) {
    const item = document.createElement("div");
    item.className = "agent-editor-item";
    const status = document.createElement("span");
    status.className = "agent-test-status";
    status.setAttribute("role", "status");
    const url = agentUrlInput(entry, syncPairs, status);
    const tokenInput = agentTokenInput(entry, syncPairs, status);

    const nameInput = document.createElement("input");
    nameInput.className = "edit-input";
    nameInput.maxLength = 100;
    nameInput.placeholder = t("agentTabName");
    nameInput.value = entry.name || "";
    nameInput.addEventListener("input", () => {
      entry.name = nameInput.value;
      syncPairs();
    });

    const test = button(t("agentTest"), "action-btn");
    test.addEventListener("click", () => testAgent(entry, test, status));
    const remove = button(t("agentRemove"), "action-btn danger");
    remove.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteAgent")))) return;
      entries.splice(index, 1);
      syncPairs();
      render();
      setAddDisabled(entries.length >= 20);
    });
    const actions = document.createElement("div");
    actions.className = "agent-editor-actions";
    actions.append(test, remove, status);

    item.append(
      monitoringField(t("agentUrlLabel"), url.input),
      url.invalid,
      url.plain,
      monitoringField(t("agentTokenLabel"), tokenInput),
      monitoringField(t("agentTabName"), nameInput),
      monitoringField(t("agentHostLabel"), agentHostSelect(entry, hostChoices, syncPairs)),
      actions
    );
    list.appendChild(item);
    url.validate();
  }

  function render() {
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "host-monitor-hint";
      empty.textContent = t("agentNoPairs");
      list.appendChild(empty);
      return;
    }
    entries.forEach(row);
  }
  return render;
}
