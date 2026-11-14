// SUPERVISION CARD TEMPLATE, browser side (see server.js and docs/EXTENDING.md).
//
// card(ctx) turns the report into a descriptor; Dashmon draws the card with
// the frame, colours and expand behaviour of the built-in cards. It must not
// touch the DOM nor throw: a failure only drops this card. For a fully custom
// body, export element(ctx) returning a DOM node instead.
//
// ctx = {
//   report : what collect() returned
//   host   : { id, name }
//   lang   : "fr" | "en"
//   t      : (key) => text from manifest.json "strings"
//   formatNumber, formatCompactNumber, formatDateTime
//   relativeAge(epochSeconds) -> "3 min ago",  reportDate(epochSeconds)
// }
//
// Descriptor (every field optional):
//   status  : "ok" | "warning" | "critical" | "unknown"  icon colour of the health line
//   summary : text of the health line
//   value   : big number,  unit : text after it
//   rows    : [{ label, value, tone }]  always visible; tone: ok | warning | critical
//   details : [{ label, value, tone }]  shown once the card is expanded
//   note    : muted paragraph

function duration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days} d ${hours} h` : `${hours} h ${Math.floor((seconds % 3600) / 60)} min`;
}

export function card(ctx) {
  const { report, t, formatNumber } = ctx;
  const perCore = report.load1 / report.cores;
  return {
    status: perCore >= 1 ? "warning" : "ok",
    summary: perCore >= 1 ? t("busy") : t("idle"),
    value: formatNumber(Math.round(perCore * 100) / 100),
    unit: t("perCore"),
    rows: [{ label: t("uptime"), value: duration(report.uptime) }],
    details: [
      { label: t("load1"), value: formatNumber(report.load1) },
      { label: t("load5"), value: formatNumber(report.load5) },
      { label: t("load15"), value: formatNumber(report.load15) },
      { label: t("cores"), value: String(report.cores) }
    ]
  };
}
