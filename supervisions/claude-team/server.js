"use strict";
// Claude team card: the summary written by deploy/claude-team.sh (open
// sessions, subagents and their tasks). Only short summaries reach the
// browser, never a prompt or a conversation.
const { readTeamReport } = require("./report");

function collect(ctx) {
  return readTeamReport(ctx.files.report);
}

module.exports = { collect };
