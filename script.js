const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberMe = document.getElementById("rememberMe");
const formMessage = document.getElementById("formMessage");
const submitButton = loginForm.querySelector('button[type="submit"]');
const buttonText = submitButton.querySelector(".button-text");

// "student" on the Student Login page, "recruiter" on the Company Login page
const loginRole = loginForm.dataset.role;
const defaultButtonText = buttonText.textContent;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let isSubmitting = false;

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

function showMessage(message, type = "error") {
    formMessage.textContent = message;
    formMessage.classList.remove("success", "error");
    formMessage.classList.add("visible", type);
}

function clearMessage() {
    formMessage.textContent = "";
    formMessage.classList.remove("visible", "success", "error");
}

function setFieldError(input, message) {
    const error = document.getElementById(`${input.id}Error`);
    const wrap = input.closest(".input-wrap");

    error.textContent = message;
    wrap.classList.toggle("invalid", Boolean(message));
    input.setAttribute("aria-invalid", String(Boolean(message)));
}

function validateForm() {
    const email = emailInput.value.trim();
    let firstInvalid = null;

    if (!email) {
        setFieldError(emailInput, "Please enter your email address.");
        firstInvalid = emailInput;
    } else if (!EMAIL_PATTERN.test(email)) {
        setFieldError(emailInput, "Please enter a valid email address.");
        firstInvalid = emailInput;
    } else {
        setFieldError(emailInput, "");
    }

    if (!passwordInput.value) {
        setFieldError(passwordInput, "Please enter your password.");
        firstInvalid = firstInvalid || passwordInput;
    } else {
        setFieldError(passwordInput, "");
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
}

function setLoading(loading) {
    isSubmitting = loading;
    submitButton.disabled = loading;
    submitButton.classList.toggle("loading", loading);
    submitButton.setAttribute("aria-busy", String(loading));
    buttonText.textContent = loading ? "Signing in..." : defaultButtonText;
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    clearMessage();

    if (!validateForm()) return;

    setLoading(true);

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email: emailInput.value.trim().toLowerCase(),
                password: passwordInput.value,
                role: loginRole,
                remember: rememberMe.checked
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showMessage(data.message || "Login failed. Please try again.");
            setLoading(false);

            if (response.status === 401) {
                passwordInput.value = "";
                passwordInput.focus();
            }
            return;
        }

        const firstName = (data.user?.fullName || "").split(/\s+/)[0];

        showMessage(
            `Welcome back${firstName ? `, ${firstName}` : ""}! Redirecting to your dashboard...`,
            "success"
        );
        buttonText.textContent = "Redirecting...";

        // Keep the button disabled while the dashboard loads.
        setTimeout(() => {
            window.location.replace(data.redirectTo);
        }, 800);

    } catch (error) {
        showMessage(
            "Cannot reach the HireMind server. Please check your connection and try again."
        );
        setLoading(false);
    }
});

// Clear errors for a field as soon as the user edits it
[emailInput, passwordInput].forEach((input) => {
    input.addEventListener("input", () => {
        setFieldError(input, "");
        clearMessage();
    });
});
