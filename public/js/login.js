const form = document.getElementById("loginForm");
const password = document.getElementById("password");
const error = document.getElementById("loginError");

form.addEventListener("submit", async event => {
  event.preventDefault();
  error.hidden = true;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value })
    });
    if (!response.ok) throw new Error("invalid");
    window.location.replace("/");
  } catch (_error) {
    password.select();
    error.textContent = "Mot de passe incorrect.";
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
});
