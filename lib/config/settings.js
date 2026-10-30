"use strict";
// Every environment variable Dashmon reads, validated in one place.
//
// The rest of the server receives the resulting object and never touches
// process.env itself: to know what can be configured, read this file.

const fs = require("fs");
const path = require("path");

// Host metrics refresh period. The browser reads it from the HTML and the
// server reuses it as the cache lifetime, so concurrent tabs share one
// measurement. 60 s by default: the supervision page does not need more, and
// it spares small hosts such as a Raspberry Pi.
function hostMetricsInterval(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 5) return 60000;
  return Math.min(value, 3600) * 1000;
}

// env: usually process.env. root: the application folder (public/, widgets/).
// runningInDocker is injectable so tests do not depend on the machine.
function readSettings(env, { root, runningInDocker = fs.existsSync("/.dockerenv") }) {
  const publicDir = path.join(root, "public");
  const dataDir = env.DATA_DIR || path.join(root, "data");
  const password = env.DASHMON_PASSWORD || "";
  // Secret shared only between paired instances. It never goes through
  // config.json nor any HTTP response.
  const syncToken = String(env.DASHMON_SYNC_TOKEN || "");
  const agentMode = env.DASHMON_MODE === "agent";

  if (agentMode && (!password || !syncToken)) {
    throw new Error("Agent mode requires DASHMON_PASSWORD and DASHMON_SYNC_TOKEN");
  }
  // Without a password Dashmon must not become an admin interface reachable
  // from the network. In Docker the server has to listen on all interfaces
  // for the proxy and the published port, so a password is mandatory there.
  if (runningInDocker && !password) {
    throw new Error("DASHMON_PASSWORD is required in Docker");
  }
  // The main dashboard stores widget passwords: they are always encrypted.
  // An agent has no widgets and needs no key.
  const masterKey = String(env.DASHMON_MASTER_KEY || "");
  if (!agentMode && !masterKey) {
    throw new Error(
      "DASHMON_MASTER_KEY is required: generate one with `openssl rand -hex 32` and keep it safe (losing it means re-entering widget passwords)"
    );
  }

  return {
    port: Number(env.PORT) || 8080,
    bindAddress: password ? "0.0.0.0" : "127.0.0.1",
    // Behind a single reverse proxy (nginx): TRUST_PROXY=1 so that req.ip,
    // req.secure and the rate limiter see the real client address.
    trustProxy: Number(env.TRUST_PROXY) || 0,

    rootDir: root,
    publicDir,
    dataDir,
    configFile: env.CONFIG_FILE || path.join(dataDir, "config.json"),
    iconsDir: env.ICONS_DIR || path.join(dataDir, "icons"),
    themesNativeDir: env.THEMES_NATIVE_DIR || path.join(publicDir, "themes"),
    themesCustomDir: env.THEMES_CUSTOM_DIR || path.join(dataDir, "themes"),

    // Reports written to disk by the deploy/ scripts for the local host. Their
    // paths are fixed here by the administrator, never chosen from the web
    // interface, so the configuration cannot make the server read any file.
    wireguardDumpFile: env.WIREGUARD_DUMP_FILE || path.join(dataDir, "wireguard.dump"),
    smartDumpFile: env.SMART_DUMP_FILE || path.join(dataDir, "smart.json"),
    aptUpdatesReportFile: env.APT_UPDATES_REPORT_FILE || path.join(dataDir, "apt-updates.json"),

    password,
    syncToken,
    agentMode,
    // Key encrypting widget secrets at rest.
    masterKey,
    insecureTls: env.DASHBOARD_INSECURE_TLS === "1",
    hostMetricsInterval: hostMetricsInterval(env.HOST_METRICS_INTERVAL),

    // Build information injected by the CI (see Dockerfile).
    release: (env.DASHMON_RELEASE || "").trim(),
    commit: (env.DASHMON_COMMIT || "").trim()
  };
}

module.exports = { readSettings };
