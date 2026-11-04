// Fortune Cookie bar, under the web links: the quote of the day, a click for
// another one (with confetti), a cross to hide it until the next midnight.
// Settings > Theme turns it on for every browser; "Refresh statuses" brings
// it back. It steps aside during a search.
import { state } from "../state.js";
import { t } from "../i18n.js";
import { fortuneBar, fortuneText as fortuneTextEl, fortuneCloseBtn } from "../dom.js";
import {
  fortuneText,
  pickFortune,
  loadFortunes,
  fortuneClosedToday,
  closeFortune,
  reopenFortune,
  msUntilMidnight
} from "../fortune.js";
import { searchQuery } from "./query.js";

const KEY = "fortune";
let midnightTimer = null;

// At midnight the closed bar comes back, with the quote of the new day.
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  midnightTimer = setTimeout(updateFortuneBar, msUntilMidnight() + 1000);
}

export function updateFortuneBar() {
  fortuneTextEl.title = t("fortuneHint");
  fortuneCloseBtn.title = t("fortuneClose");
  fortuneCloseBtn.setAttribute("aria-label", t("fortuneClose"));
  const text = state.fortune ? fortuneText(KEY, state.language) : "";
  fortuneTextEl.textContent = text;
  fortuneBar.hidden = !text || fortuneClosedToday() || !!searchQuery();
  if (state.fortune) scheduleMidnight();
  // The quotes load asynchronously: the bar fills itself once they arrive.
  if (state.fortune && !text) loadFortunes().then(list => list.length && updateFortuneBar());
}

export function showFortuneAgain() {
  reopenFortune();
  updateFortuneBar();
}

function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ff8a1f", "#ff4d6d", "#3cf59b", "#6d8ed1", "#d76cff"];
  for (let index = 0; index < 28; index++) {
    const particle = document.createElement("i");
    particle.className = "fortune-confetti";
    particle.style.left = `${10 + Math.round(Math.random() * 60)}%`;
    particle.style.top = `${20 + Math.round(Math.random() * 60)}%`;
    particle.style.setProperty("--x", `${Math.round((Math.random() - 0.5) * 460)}px`);
    particle.style.setProperty("--y", `${Math.round((Math.random() - 0.3) * 260)}px`);
    particle.style.setProperty("--r", `${Math.round((Math.random() - 0.5) * 540)}deg`);
    particle.style.setProperty("--size", `${8 + Math.round(Math.random() * 6)}px`);
    particle.style.background = colors[index % colors.length];
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
    fortuneBar.appendChild(particle);
  }
}

fortuneTextEl.addEventListener("click", () => {
  fortuneTextEl.textContent = pickFortune(KEY, state.language);
  confetti();
});

fortuneCloseBtn.addEventListener("click", () => {
  closeFortune();
  updateFortuneBar();
});
