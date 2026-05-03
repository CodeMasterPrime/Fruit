import { register, mapAuthError } from "./auth.js";

const form = document.getElementById("registerForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const statusMsg = document.getElementById("statusMsg");

const showStatus = (message, isError = false) => {
  statusMsg.textContent = message;
  statusMsg.classList.toggle("error", isError);
  statusMsg.hidden = false;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMsg.hidden = true;

  if (passwordInput.value !== confirmPasswordInput.value) {
    showStatus("Passwords do not match.", true);
    return;
  }

  try {
    await register(usernameInput.value.trim(), passwordInput.value);
    window.navigateWithTransition("welcome.html");
  } catch (err) {
    showStatus(mapAuthError(err), true);
  }
});
