"use strict";
// Widget APT : lit exclusivement le rapport produit localement par le script
// deploy/apt-updates.sh. Le navigateur ne peut pas choisir le chemin lu.

const fs = require("fs");
const path = require("path");

const MAX_REPORT_BYTES = 100000;

function reportFile() {
  const fromEnv = String(process.env.APT_UPDATES_REPORT_FILE || "").trim();
  if (fromEnv) return fromEnv;
  const dataDir = String(process.env.DATA_DIR || "").trim()
    || path.join(__dirname, "..", "..", "data");
  return path.join(dataDir, "apt-updates.json");
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function readReport(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (_error) {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_REPORT_BYTES) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_error) {
    return null;
  }
  const status = raw && (raw.status === "success" || raw.status === "failed") ? raw.status : null;
  if (!status) return null;
  return {
    status,
    updated: number(raw.updated) || 0,
    finishedAt: number(raw.finishedAt) || Math.floor(stat.mtimeMs / 1000),
    rebootRequired: raw.rebootRequired === true,
    rebooting: raw.rebooting === true
  };
}

async function check(ctx) {
  const report = readReport(reportFile());
  if (!report) return { ok: false, error: ctx.t("noReport"), report: null };
  return { ok: report.status === "success", error: report.status === "failed" ? ctx.t("failed") : "", report };
}

module.exports = { check, readReport };
