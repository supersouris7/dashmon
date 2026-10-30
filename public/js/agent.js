"use strict";
const form = document.getElementById("agent-form");
const message = document.getElementById("message");
const metrics = document.getElementById("metrics");
async function request(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    location.href = "/login";
    throw new Error("Session expirée");
  }
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
async function refresh() {
  try {
    const data = await request("/api/agent/metrics", { cache: "no-store" });
    metrics.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    metrics.textContent = "Collecte impossible : " + error.message;
  }
}
async function load() {
  try {
    const data = await request("/api/agent/config", { cache: "no-store" });
    const m = data.monitoring || {};
    form.elements.name.value = data.name || "Agent";
    form.elements.path.value = m.path || "";
    form.elements.wireguard.checked = m.wireguard?.enabled !== false;
    form.elements.interface.value = m.wireguard?.interface || "";
    form.elements.smart.checked = m.smart?.enabled !== false;
    form.elements.disks.value = (m.smart?.disks || []).join("\n");
    form.elements.apt.checked = m.aptUpdates?.enabled !== false;
    await refresh();
  } catch (error) {
    message.textContent = "Chargement impossible : " + error.message;
  }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  const monitoring = {
    path: form.elements.path.value,
    wireguard: {
      enabled: form.elements.wireguard.checked,
      interface: form.elements.interface.value
    },
    smart: {
      enabled: form.elements.smart.checked,
      disks: form.elements.disks.value
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
    },
    aptUpdates: { enabled: form.elements.apt.checked }
  };
  try {
    await request("/api/agent/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.elements.name.value, monitoring })
    });
    message.textContent = "Configuration enregistrée.";
    await refresh();
  } catch (error) {
    message.textContent = "Enregistrement impossible : " + error.message;
  }
});
document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  location.href = "/login";
});
load();
