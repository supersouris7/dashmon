// Claude Code card (supervision plugin claude). The coding agent card is shared with
// the other coding agent: public/js/supervision/usage-card.js. A bundled
// card: it reuses the interface modules by their /js/ path, which a
// third-party plugin should not rely on (docs/EXTENDING.md).
import { usageCard } from "/js/supervision/usage-card.js";

const SOURCE = {
  field: "claude",
  title: "supervisionClaudeTitle",
  icon: "fa-solid fa-code",
  pref: "supervisionClaudeExpanded",
  keyName: "claudeKey"
};

export function element(ctx) {
  return usageCard(ctx.host, ctx.report, SOURCE);
}
