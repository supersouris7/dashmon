// List of paired agents in the pairing panel.
import { agentUrl } from "./replication-draft.js";
import { t } from "../i18n.js";

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
  function render() {
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "host-monitor-hint";
      empty.textContent = t("agentNoPairs");
      list.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "agent-editor-item";
      const urlInput = document.createElement("input");
      urlInput.className = "edit-input";
      urlInput.placeholder = "https://agent.exemple.lan:8080";
      urlInput.maxLength = 300;
      urlInput.value = entry.url || "";
      const invalid = document.createElement("p");
      invalid.className = "host-monitor-hint agent-url-error";
      invalid.textContent = t("agentInvalidUrl");
      invalid.hidden = true;
      const validate = () => {
        const raw = String(entry.url || "").trim();
        const ok = !raw || Boolean(agentUrl(raw));
        urlInput.setAttribute("aria-invalid", String(!ok));
        invalid.hidden = ok;
      };
      const nameInput = document.createElement("input");
      nameInput.className = "edit-input";
      nameInput.maxLength = 100;
      nameInput.placeholder = t("agentTabName");
      nameInput.value = entry.name || "";
      nameInput.addEventListener("input", () => {
        entry.name = nameInput.value;
        syncPairs();
      });

      const hostSelect = document.createElement("select");
      hostSelect.className = "edit-select";
      hostSelect.title = t("agentHostLabel");
      const noHost = document.createElement("option");
      noHost.value = "";
      noHost.textContent = t("agentHostNone");
      hostSelect.appendChild(noHost);
      hostChoices().forEach(host => {
        const option = document.createElement("option");
        option.value = host.id;
        option.textContent = host.name;
        hostSelect.appendChild(option);
      });
      hostSelect.value = entry.host || "";
      if (hostSelect.value !== (entry.host || "")) {
        entry.host = "";
        syncPairs();
      }
      hostSelect.addEventListener("change", () => {
        entry.host = hostSelect.value;
        syncPairs();
      });

      const status = document.createElement("span");
      status.className = "agent-test-status";
      status.setAttribute("role", "status");
      const test = document.createElement("button");
      test.type = "button";
      test.className = "action-btn";
      test.textContent = t("agentTest");
      const configure = document.createElement("a");
      configure.className = "action-btn agent-configure";
      configure.textContent = t("agentConfigure");
      configure.target = "_blank";
      configure.rel = "noopener noreferrer";
      const updateConfigure = () => {
        const target = agentUrl(entry.url);
        if (target) configure.href = target;
        else configure.removeAttribute("href");
      };
      updateConfigure();
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "action-btn danger";
      remove.textContent = t("agentRemove");
      remove.addEventListener("click", async () => {
        if (!(await confirmDelete(t("confirmDeleteAgent")))) return;
        entries.splice(index, 1);
        syncPairs();
        render();
        setAddDisabled(entries.length >= 20);
      });
      urlInput.addEventListener("input", () => {
        entry.url = urlInput.value;
        syncPairs();
        updateConfigure();
        validate();
        status.className = "agent-test-status";
        status.replaceChildren();
      });
      urlInput.addEventListener("blur", () => {
        const normalized = agentUrl(entry.url);
        if (normalized) entry.url = normalized;
        urlInput.value = entry.url || "";
        syncPairs();
        updateConfigure();
        validate();
      });
      test.addEventListener("click", async () => {
        const target = agentUrl(entry.url);
        if (!target) {
          setStatus(status, "error", t("agentInvalidUrl"));
          return;
        }
        test.disabled = true;
        setStatus(status, "pending", t("agentTesting"));
        try {
          const response = await fetch("/api/agents/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target })
          });
          const result = await response.json();
          const reasons = {
            token_missing: "agentTokenMissing",
            unauthorized: "agentUnauthorized",
            invalid_url: "agentInvalidUrl",
            invalid_response: "agentInvalidResponse",
            incompatible_protocol: "agentIncompatible"
          };
          setStatus(
            status,
            result.ok ? "ok" : "error",
            t(result.ok ? "agentConnected" : reasons[result.reason] || "agentUnreachable")
          );
        } catch (_error) {
          setStatus(status, "error", t("agentUnreachable"));
        } finally {
          test.disabled = false;
        }
      });
      const actions = document.createElement("div");
      actions.className = "agent-editor-actions";
      actions.append(test, configure, remove, status);
      item.append(
        monitoringField(t("agentUrlLabel"), urlInput),
        invalid,
        monitoringField(t("agentTabName"), nameInput),
        monitoringField(t("agentHostLabel"), hostSelect),
        actions
      );
      list.appendChild(item);
      validate();
    });
  }
  return render;
}
