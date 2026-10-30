"use strict";
// Reads the disk health report written by deploy/smart-dump.sh (smartctl JSON)
// and keeps only the values the supervision page shows.
const fs = require("fs");
const { sanitizeText } = require("../sanitize");

function smartNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
function smartAttribute(raw, id) {
  const table = Array.isArray(raw?.ata_smart_attributes?.table)
    ? raw.ata_smart_attributes.table
    : [];
  const attribute = table.find(item => Number(item?.id) === id);
  return smartNumber(attribute?.raw?.value);
}
function normalizeSmartDisk(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const device = sanitizeText(raw.device?.name || raw.name, 100);
  if (!device) return null;
  const nvme = raw.nvme_smart_health_information_log || {};
  return {
    device,
    model: sanitizeText(raw.model_name || raw.model_family || raw.device?.type, 100),
    passed: typeof raw.smart_status?.passed === "boolean" ? raw.smart_status.passed : null,
    temperature: smartNumber(raw.temperature?.current ?? nvme.temperature),
    powerOnHours: smartNumber(raw.power_on_time?.hours ?? nvme.power_on_hours),
    reallocated: smartAttribute(raw, 5),
    pending: smartAttribute(raw, 197),
    uncorrectable: smartAttribute(raw, 198),
    sataCrc: smartAttribute(raw, 199),
    smartErrors: smartNumber(raw.ata_smart_error_log?.summary?.count ?? nvme.num_err_log_entries),
    loadCycle: smartAttribute(raw, 193)
  };
}
function readSmartDump(file, { filesystem = fs } = {}) {
  let stat;
  try {
    stat = filesystem.statSync(file);
  } catch (_error) {
    return null;
  }
  if (!stat.isFile() || stat.size > 2_000_000) return null;
  let source;
  try {
    source = JSON.parse(filesystem.readFileSync(file, "utf8"));
  } catch (_error) {
    return null;
  }
  const rawDisks = Array.isArray(source?.disks) ? source.disks : [];
  const disks = rawDisks.map(normalizeSmartDisk).filter(Boolean).slice(0, 20);
  if (!disks.length) return null;
  const fetchedAt = smartNumber(source.updatedAt) || Math.floor(stat.mtimeMs / 1000);
  return { disks, fetchedAt: Number.isFinite(fetchedAt) && fetchedAt > 0 ? fetchedAt : null };
}
module.exports = { readSmartDump, normalizeSmartDisk };
