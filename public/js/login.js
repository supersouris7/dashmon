// Login page: sends the password, then explains a refusal. The page follows
// the browser language (the dashboard setting is only readable once logged in).
const TEXT = {
  fr: {
    title: "Dashmon - Connexion",
    copy: "Votre session reste active pendant 30 jours sur cet appareil.",
    password: "Mot de passe",
    submit: "Connexion",
    wrong: "Mot de passe incorrect.",
    blocked: "Trop de tentatives. Réessayez dans {minutes} min.",
    unreachable: "Serveur injoignable. Réessayez."
  },
  en: {
    title: "Dashmon - Sign in",
    copy: "Your session stays active for 30 days on this device.",
    password: "Password",
    submit: "Sign in",
    wrong: "Wrong password.",
    blocked: "Too many attempts. Try again in {minutes} min.",
    unreachable: "Server unreachable. Try again."
  }
};
const language = /^fr\b/i.test(navigator.language || "") ? "fr" : "en";
const text = TEXT[language];

const form = document.getElementById("loginForm");
const password = document.getElementById("password");
const error = document.getElementById("loginError");
const button = document.getElementById("loginBtn");

document.documentElement.lang = language;
document.title = text.title;
document.getElementById("loginCopy").textContent = text.copy;
document.getElementById("passwordLabel").textContent = text.password;
button.textContent = text.submit;

// Message for a refused login: blocked after too many attempts (429, with the
// wait in Retry-After), wrong password, or no answer at all.
function refusal(response) {
  if (!response) return text.unreachable;
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After")) || 60;
    return text.blocked.replace("{minutes}", String(Math.max(1, Math.ceil(seconds / 60))));
  }
  return response.status === 401 ? text.wrong : text.unreachable;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  error.hidden = true;
  button.disabled = true;
  let response;
  try {
    response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value })
    });
    if (response.ok) {
      window.location.replace("/");
      return;
    }
  } catch (_error) {
    response = null;
  }
  password.select();
  error.textContent = refusal(response);
  error.hidden = false;
  button.disabled = false;
});
