
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginForm = document.getElementById("loginForm");
const formMessage = document.getElementById("formMessage");
const createAccount = document.getElementById("createAccount");
const forgotLink = document.getElementById("forgotLink");

// Show or hide password
togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    togglePassword.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
    );

    togglePassword.setAttribute(
        "aria-pressed",
        String(isHidden)
    );
});

// Demo-only form submission
loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    formMessage.textContent =
        "This is a UI demo. Login will be enabled when authentication is connected.";

    formMessage.classList.add("visible");
});

// Hide the demo message when the user edits a field
loginForm.addEventListener("input", () => {
    formMessage.textContent = "";
    formMessage.classList.remove("visible");
});

// Create account placeholder
createAccount.addEventListener("click", (event) => {
    event.preventDefault();

    formMessage.textContent =
        "Registration page will be added in the next step.";

    formMessage.classList.add("visible");
});

// Forgot password placeholder
forgotLink.addEventListener("click", (event) => {
    event.preventDefault();

    formMessage.textContent =
        "Password recovery will be available after authentication is implemented.";

    formMessage.classList.add("visible");
});

// After successful demo login
sessionStorage.setItem("hireMindLoggedIn", "true");
window.location.href = "student-dashboard.html";