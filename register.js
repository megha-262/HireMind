const registerForm = document.getElementById("registerForm");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const role = document.getElementById("role");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const terms = document.getElementById("terms");
const registerMessage = document.getElementById("registerMessage");

// Show or hide password
document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.toggle);
        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";

        button.setAttribute("aria-pressed", String(showPassword));
        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    });
});

// Display message
function showMessage(message, isSuccess = false) {
    registerMessage.textContent = message;
    registerMessage.classList.add("visible");
    registerMessage.style.color = isSuccess ? "#21845f" : "#b34b57";
}

// Clear message when form is edited
registerForm.addEventListener("input", () => {
    registerMessage.textContent = "";
    registerMessage.classList.remove("visible");
});

// Register user through backend
registerForm.addEventListener("submit", async (event) => {
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

    const submitButton = registerForm.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector("span");

    submitButton.disabled = true;
    buttonText.textContent = "Creating account...";

    try {
        const response = await fetch("http://localhost:5050/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fullName: fullName.value.trim(),
                email: email.value.trim(),
                role: role.value,
                password: password.value,
                confirmPassword: confirmPassword.value
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message || "Registration failed. Please try again.");
            return;
        }

        showMessage(
            "Account created successfully! You can now sign in.",
            true
        );

        registerForm.reset();

    } catch (error) {
        console.error("Registration request failed:", error);
        showMessage(
            "Cannot connect to the server. Please make sure the backend is running."
        );
    } finally {
        submitButton.disabled = false;
        buttonText.textContent = "Create my account";
    }
});

// Terms of Use placeholder
document.getElementById("termsLink").addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("The Terms of Use page will be added later.");
});

// Privacy Policy placeholder
document.getElementById("privacyLink").addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("The Privacy Policy page will be added later.");
});