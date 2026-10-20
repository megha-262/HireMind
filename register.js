
const registerForm = document.getElementById("registerForm");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const role = document.getElementById("role");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const terms = document.getElementById("terms");
const registerMessage = document.getElementById("registerMessage");

// Show or hide either password field
document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.toggle);
        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";

        button.setAttribute(
            "aria-pressed",
            String(showPassword)
        );

        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    });
});

// Display a message
function showMessage(message, isSuccess = false) {
    registerMessage.textContent = message;
    registerMessage.classList.add("visible");

    registerMessage.style.color = isSuccess ? "#21845f" : "#b34b57";
}

// Clear old messages while the form is edited
registerForm.addEventListener("input", () => {
    registerMessage.textContent = "";
    registerMessage.classList.remove("visible");
});

// Frontend-only registration validation
registerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!fullName.value.trim()) {
        showMessage("Please enter your full name.");
        fullName.focus();
        return;
    }

    if (!email.validity.valid || !email.value.trim()) {
        showMessage("Please enter a valid email address.");
        email.focus();
        return;
    }

    if (!role.value) {
        showMessage("Please select your account type.");
        role.focus();
        return;
    }

    if (password.value.length < 8) {
        showMessage("Your password must contain at least 8 characters.");
        password.focus();
        return;
    }

    if (password.value !== confirmPassword.value) {
        showMessage("Your passwords do not match.");
        confirmPassword.focus();
        return;
    }

    if (!terms.checked) {
        showMessage("Please agree to the Terms of Use and Privacy Policy.");
        terms.focus();
        return;
    }

    showMessage(
        "Form validation successful! Account creation will be enabled after backend integration.",
        true
    );

    // No account is created and no data is saved.
});

// Placeholder links until their pages exist
document.getElementById("termsLink").addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("The Terms of Use page will be added later.");
});

document.getElementById("privacyLink").addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("The Privacy Policy page will be added later.");
});
