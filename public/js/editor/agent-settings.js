// Remote drafts stay in the primary browser; the token stays on its server.
import { t } from "../i18n.js";
import { clone } from "../util.js";
import { renderHostSettings } from "./host-settings.js";
import { agentHostMetrics } from "../supervision.js";

export function createAgentSettings() {
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
    renderHostSettings(editor, { config: draft.config, metrics: agentHostMetrics(activeUrl) });
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
      tree.replaceChildren();
      for (const entry of entries) {
        if (!entry.url) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "edit-tab";
        button.dataset.panel = "remoteAgentPanel";
        button.dataset.agentUrl = entry.url;
        button.textContent = entry.name || new URL(entry.url).hostname;
        button.disabled = !savedUrls.includes(entry.url);
        if (button.disabled) button.title = t("agentSavePairFirst");
        if (
          activeUrl === entry.url &&
          document.getElementById("remoteAgentPanel").classList.contains("active")
        ) {
          button.classList.add("active");
          button.setAttribute("aria-current", "page");
        }
        tree.appendChild(button);
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
        status.textContent = "";
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
