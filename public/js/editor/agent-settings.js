// Remote drafts stay in the primary browser; the token stays on its server.
import { t } from "../i18n.js";
import { clone } from "../util.js";

export function createAgentSettings({ field }) {
  const drafts = new Map();
  const loading = new Map();
  let generation = 0;
  let activeUrl = "";
  const editor = document.getElementById("remoteAgentEditor");
  const status = document.getElementById("remoteAgentStatus");
  const title = document.getElementById("remoteAgentTitle");
  const tree = document.getElementById("settingsAgentTree");
  const dirty = draft => JSON.stringify(draft.config) !== draft.baseline;

  async function request(url, options) {
    const response = await fetch(url, options);
    if (response.status === 412) throw new Error(t("agentConfigConflict"));
    if (!response.ok) throw new Error(t("agentConfigUnavailable"));
    return response.json();
  }

  function renderForm(draft) {
    editor.replaceChildren();
    const fields = document.createElement("div");
    fields.className = "remote-agent-fields";
    const config = draft.config;
    const m = config.monitoring;
    function text(key, value, change, multiline = false) {
      const input = document.createElement(multiline ? "textarea" : "input");
      input.className = "edit-input";
      input.name = key;
      input.value = value || "";
      input.maxLength = multiline ? 4000 : key === "agentHostName" ? 100 : 200;
      input.addEventListener("input", () => change(input.value));
      fields.appendChild(field(t(key), input));
    }
    function toggle(key, value) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = m[key]?.enabled !== false;
      input.addEventListener("change", () => {
        m[key] = { ...m[key], enabled: input.checked };
      });
      fields.appendChild(field(t(value), input));
    }
    text("agentHostName", config.name, value => {
      config.name = value;
    });
    text("hostDiskPath", m.path, value => {
      m.path = value;
    });
    toggle("wireguard", "tabWireguard");
    text("wireguardInterface", m.wireguard?.interface, value => {
      m.wireguard = { ...m.wireguard, interface: value };
    });
    toggle("smart", "tabSmart");
    text(
      "smartDisks",
      (m.smart?.disks || []).join("\n"),
      value => {
        m.smart = {
          ...m.smart,
          disks: value
            .split(/[\n,]/)
            .map(item => item.trim())
            .filter(Boolean)
        };
      },
      true
    );
    toggle("aptUpdates", "tabAptUpdates");
    editor.appendChild(fields);
  }

  return {
    refreshLabels() {
      const draft = drafts.get(activeUrl);
      if (draft) renderForm(draft);
    },
    reset() {
      generation++;
      drafts.clear();
      loading.clear();
      activeUrl = "";
    },
    snapshot() {
      return [...drafts]
        .filter(([, draft]) => dirty(draft))
        .map(([url, draft]) => [url, draft.config]);
    },
    renderTree(entries, savedUrls) {
      const expanded = new Map(
        [...tree.querySelectorAll("details")].map(node => [node.dataset.url, node.open])
      );
      tree.replaceChildren();
      for (const entry of entries) {
        if (!entry.url) continue;
        const branch = document.createElement("details");
        branch.className = "settings-branch";
        branch.dataset.url = entry.url;
        branch.open = expanded.get(entry.url) ?? true;
        const summary = document.createElement("summary");
        summary.textContent = entry.name || new URL(entry.url).hostname;
        const children = document.createElement("div");
        children.className = "settings-children";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "edit-tab";
        button.dataset.panel = "remoteAgentPanel";
        button.dataset.agentUrl = entry.url;
        button.textContent = t("agentConfiguration");
        button.disabled = !savedUrls.includes(entry.url);
        if (button.disabled) button.title = t("agentSavePairFirst");
        if (
          activeUrl === entry.url &&
          document.getElementById("remoteAgentPanel").classList.contains("active")
        ) {
          button.classList.add("active");
          button.setAttribute("aria-current", "page");
        }
        children.appendChild(button);
        branch.append(summary, children);
        tree.appendChild(branch);
      }
    },
    async open(url, name) {
      const openedGeneration = generation;
      activeUrl = url;
      title.textContent = name || new URL(url).hostname;
      editor.replaceChildren();
      status.textContent = t("agentConfigLoading");
      try {
        if (!drafts.has(url)) {
          if (!loading.has(url))
            loading.set(url, request("/api/agents/config?url=" + encodeURIComponent(url)));
          const data = await loading.get(url);
          if (openedGeneration !== generation) return;
          if (!drafts.has(url))
            drafts.set(url, {
              config: clone(data.config),
              revision: data.revision,
              baseline: JSON.stringify(data.config)
            });
          loading.delete(url);
        }
        if (activeUrl !== url) return;
        renderForm(drafts.get(url));
        status.textContent = t("agentConfigSaveHint");
      } catch (error) {
        if (openedGeneration === generation) {
          loading.delete(url);
          if (activeUrl === url) status.textContent = error.message;
        }
      }
    },
    async save(urls) {
      editor.inert = true;
      try {
        for (const [url, draft] of drafts) {
          if (!urls.includes(url)) {
            drafts.delete(url);
            continue;
          }
          if (!dirty(draft)) continue;
          const result = await request("/api/agents/config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, config: draft.config, revision: draft.revision })
          });
          draft.revision = result.revision;
          draft.baseline = JSON.stringify(draft.config);
        }
      } finally {
        editor.inert = false;
      }
    }
  };
}
