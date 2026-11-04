// Runs in <head>, before the first paint, on the dashboard and the login page.
// A classic script file rather than an inline one: the Content-Security-Policy
// (script-src 'self') refuses inline scripts.
//
// The last theme is applied at once from localStorage, so the page does not
// flash the default colours while the modules load. On the dashboard the body
// stays transparent until app.js is ready: if a module fails, the page is
// revealed anyway after an error or 4 s.
(function () {
  const root = document.documentElement;
  try {
    const theme = localStorage.getItem("dashmon.theme");
    let vars = localStorage.getItem("dashmon.themeVars");
    if (theme) root.setAttribute("data-theme", theme);
    if (vars) {
      // Older warning colour, replaced since.
      vars = vars.replace(/--warning:\s*#f5c542/gi, "--warning:#ff8a1f");
      const style = document.createElement("style");
      style.textContent = ":root{" + vars + "}";
      document.head.appendChild(style);
      // Native controls follow the theme from the first paint.
      const bg = (vars.match(/--bg:\s*(#[0-9a-f]{3,6})/i) || [])[1];
      if (bg) {
        let hex = bg.slice(1);
        if (hex.length === 3)
          hex = hex.replace(/./g, function (c) {
            return c + c;
          });
        if (/^[0-9a-f]{6}$/i.test(hex)) {
          const luminance =
            0.299 * parseInt(hex.slice(0, 2), 16) +
            0.587 * parseInt(hex.slice(2, 4), 16) +
            0.114 * parseInt(hex.slice(4, 6), 16);
          root.style.colorScheme = luminance < 128 ? "dark" : "light";
        }
      }
    }
  } catch (_error) {
    // Storage unavailable: the default theme applies.
  }
  function reveal() {
    if (document.body) document.body.classList.add("app-ready");
  }
  window.addEventListener("error", reveal);
  setTimeout(reveal, 4000);
})();
