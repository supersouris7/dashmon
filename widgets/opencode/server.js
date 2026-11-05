"use strict";
// OpenCode widget: today's tokens and the last 30 days on the tile, from the
// report the Supervision page already reads (deploy/opencode-stats.sh writes
// it every 15 minutes). Nothing is fetched from OpenCode itself.

// Same threshold as the Supervision card: the cron job has probably stopped.
const STALE_SECONDS = 6 * 3600;

function usedTokens(tokens) {
  return (
    (Number(tokens?.input) || 0) + (Number(tokens?.output) || 0) + (Number(tokens?.reasoning) || 0)
  );
}

// Model with the most tokens over the period.
function mainModel(period) {
  let best = null;
  for (const model of period?.models || []) {
    const used = usedTokens(model.tokens);
    if (!best || used > best.used) best = { id: model.id, used };
  }
  return best && best.used > 0 ? best.id : "";
}

function summary(period) {
  return {
    tokens: usedTokens(period?.tokens),
    sessions: Number(period?.sessions) || 0,
    cost: Number(period?.cost) || 0
  };
}

async function check(ctx) {
  if (!ctx.supervision) return { ok: false, error: ctx.t("error") };
  const found = await ctx.supervision.usageReport("opencode", ctx.config.host, ctx.service);
  if (found.unpaired) return { ok: false, error: ctx.t("unpaired") };
  if (!found.report && found.unreachable) return { ok: false, error: ctx.t("unreachable") };
  const base = { ok: true, source: found.source, hostName: ctx.sanitizeText(found.name, 100) };
  if (!found.report) return { ...base, found: false };
  const periods = found.report.periods || {};
  const fetchedAt = Number(found.report.fetchedAt) || 0;
  return {
    ...base,
    found: true,
    fetchedAt: fetchedAt ? fetchedAt * 1000 : null,
    stale: !!fetchedAt && Date.now() / 1000 - fetchedAt > STALE_SECONDS,
    today: summary(periods.today),
    month: summary(periods.month),
    model: mainModel(periods.month)
  };
}

module.exports = { check, usedTokens, mainModel };
