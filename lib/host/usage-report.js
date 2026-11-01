"use strict";
// Reads the coding agent usage reports: deploy/opencode-stats.sh (one
// `opencode stats --json` object per period) and deploy/claude-stats.sh, which
// writes the same format from the Claude Code session logs. Only counters are
// kept: models, tokens, cost, tools and daily activity, never the prompts.
const fs = require("fs");
const { sanitizeText } = require("../sanitize");

const PERIODS = ["today", "week", "month", "all"];

function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10000) / 10000 : 0;
}
function tokens(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    input: count(src.input),
    output: count(src.output),
    reasoning: count(src.reasoning),
    cacheRead: count(src.cache?.read),
    cacheWrite: count(src.cache?.write)
  };
}

// The same model can appear once per variant: the card shows one line per
// provider and model, the counters added up.
function models(raw) {
  const merged = new Map();
  for (const item of Array.isArray(raw) ? raw.slice(0, 100) : []) {
    const id = sanitizeText(item?.model?.id, 100);
    if (!id) continue;
    const provider = sanitizeText(item.model.providerID, 60);
    const key = provider + "/" + id;
    const entry = merged.get(key) || {
      id,
      provider,
      steps: 0,
      cost: 0,
      tokens: tokens(null)
    };
    const add = tokens(item.tokens);
    for (const field of Object.keys(entry.tokens)) entry.tokens[field] += add[field];
    entry.steps += count(item.steps);
    entry.cost = money(entry.cost + money(item.cost));
    merged.set(key, entry);
  }
  return [...merged.values()]
    .filter(entry => entry.steps > 0 || Object.values(entry.tokens).some(Boolean))
    .slice(0, 30);
}

function tools(raw) {
  const list = Array.isArray(raw?.usage) ? raw.usage : [];
  return list
    .slice(0, 30)
    .map(item => ({
      name: sanitizeText(item?.name, 60),
      calls: count(item?.calls),
      failed: count(item?.failed)
    }))
    .filter(item => item.name && item.calls > 0);
}

function activity(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date || "")))
    .slice(-400)
    .map(item => ({ date: item.date, steps: count(item.steps) }));
}

function normalizeUsagePeriod(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return {
    sessions: count(raw.sessions),
    subagents: count(raw.subagents),
    prompts: count(raw.prompts),
    steps: count(raw.steps),
    cost: money(raw.cost),
    tokens: tokens(raw.tokens),
    activeDays: count(raw.activeDays),
    streak: count(raw.streak),
    activity: activity(raw.activity),
    models: models(raw.models),
    tools: tools(raw.tools)
  };
}

// The path comes from the administrator, never from a browser request.
function readUsageReport(file, { filesystem = fs } = {}) {
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
  const periods = {};
  for (const name of PERIODS) {
    const period = normalizeUsagePeriod(source?.periods?.[name]);
    if (period) periods[name] = period;
  }
  if (!Object.keys(periods).length) return null;
  const fetchedAt = count(source.updatedAt) || Math.floor(stat.mtimeMs / 1000);
  return {
    fetchedAt: fetchedAt > 0 ? fetchedAt : null,
    version: sanitizeText(source.version, 40),
    periods
  };
}
module.exports = { readUsageReport, normalizeUsagePeriod };
