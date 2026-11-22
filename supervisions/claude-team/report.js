"use strict";
// Reads and bounds the report of deploy/claude-team.sh. The script already
// truncates and cleans every text; this is the second line of defence, as the
// file is only trusted as far as the administrator who mounts it.
const fs = require("fs");
const { sanitizeText } = require("../../lib/sanitize");
const { scriptVersion } = require("../../lib/host/script-versions");

const MAX_BYTES = 200_000;
const TITLE_MAX = 80;
const SHORT_MAX = 60;
const MODEL_MAX = 80;
const ROLE_MAX = 40;

function seconds(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
// Unknown stays null: a missing field is never shown as a value.
function text(value, max) {
  return typeof value === "string" ? sanitizeText(value, max) || null : null;
}
function list(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}
function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function session(raw) {
  if (!plain(raw)) return null;
  return {
    project: text(raw.project, SHORT_MAX),
    name: text(raw.name, TITLE_MAX),
    status: text(raw.status, 20)?.toLowerCase() || null,
    kind: text(raw.kind, 20)?.toLowerCase() || null,
    model: text(raw.model, MODEL_MAX),
    since: seconds(raw.since),
    statusSince: seconds(raw.statusSince)
  };
}

function task(raw) {
  if (!plain(raw)) return null;
  return {
    title: text(raw.title, TITLE_MAX),
    project: text(raw.project, SHORT_MAX),
    model: text(raw.model, MODEL_MAX),
    since: seconds(raw.since)
  };
}

function member(raw) {
  const name = plain(raw) ? text(raw.name, SHORT_MAX) : null;
  if (!name) return null;
  const count = Number(raw.tasks24h);
  return {
    name,
    configuredModel: text(raw.configuredModel, MODEL_MAX),
    role: text(raw.role, ROLE_MAX),
    description: text(raw.description, TITLE_MAX),
    declared: raw.declared === true,
    active: raw.active === true,
    task: raw.active === true ? task(raw.task) : null,
    tasks24h: Number.isSafeInteger(count) && count > 0 ? count : 0
  };
}

function recent(raw) {
  const agent = plain(raw) ? text(raw.agent, SHORT_MAX) : null;
  if (!agent) return null;
  return {
    agent,
    title: text(raw.title, TITLE_MAX),
    project: text(raw.project, SHORT_MAX),
    model: text(raw.model, MODEL_MAX),
    start: seconds(raw.start),
    end: seconds(raw.end)
  };
}

// The path comes from the administrator, never from a browser request.
function readTeamReport(file, { filesystem = fs } = {}) {
  let source;
  let stat;
  try {
    stat = filesystem.statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    source = JSON.parse(filesystem.readFileSync(file, "utf8"));
  } catch (_error) {
    return null;
  }
  if (!plain(source) || !Array.isArray(source.team) || !Array.isArray(source.sessions)) return null;
  const generatedAt = seconds(source.generatedAt) || Math.floor(stat.mtimeMs / 1000);
  return {
    version: 1,
    scriptVersion: scriptVersion(source.scriptVersion),
    generatedAt,
    sessions: list(source.sessions, 20).map(session).filter(Boolean),
    team: list(source.team, 50).map(member).filter(Boolean),
    recent: list(source.recent, 10).map(recent).filter(Boolean)
  };
}

module.exports = { readTeamReport };
