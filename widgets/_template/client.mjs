// WIDGET TEMPLATE, browser side (see server.js and docs/EXTENDING.md).
//
// render(ctx) touches neither the DOM nor `document`: it returns a descriptor
// that the core applies to the tile. The module stays testable under Node,
// and a broken widget cannot break the dashboard. For a fully custom tile,
// export element(ctx) returning a DOM node instead.

export function render(ctx) {
  // ctx = {
  //   info   : status computed by your server.js (null before the first check)
  //   config : widget configuration as entered in the editor (no secret)
  //   t      : (key) => text declared in manifest.json "strings"
  //   lang   : "fr" | "en"
  //   formatNumber, formatCompactNumber, formatDateTime
  // }
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }
  if (info.error) {
    return {
      badge: t("name") + " —",
      badgeClass: "nok",
      time: "—",
      timeClass: "",
      title: `${t("error")} : ${String(info.error).slice(0, 120)}`
    };
  }
  return {
    badge: `${t("badge")} ${info.value ?? "—"}`,
    badgeClass: "ok", // "ok" | "nok" | "warn" | "pending" | ""
    time: info.detail || "", // second line (hidden in icon mode)
    timeClass: "", // "warn" | "delta-up" | "delta-down" | ""
    title: t("name")
  };
}
