const registerForm = document.getElementById("registerForm");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const role = document.getElementById("role");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const terms = document.getElementById("terms");
const registerMessage = document.getElementById("registerMessage");

const companyField = document.getElementById("companyField");
const companyNameInput = document.getElementById("companyName");

// Backend URL (pages are served by the same Express server)
const API_URL = "/api/auth/register";

const LOGIN_PAGES = {
    student: "index.html",
    recruiter: "company-login.html"
};

// Company name is only needed for recruiter accounts
function updateCompanyField() {
    const isRecruiter = role.value === "recruiter";

    companyField.hidden = !isRecruiter;
    companyNameInput.required = isRecruiter;
}

role.addEventListener("change", updateCompanyField);

// Pre-select the account type from links such as register.html?role=recruiter
const requestedRole = new URLSearchParams(window.location.search).get("role");

if (requestedRole === "student" || requestedRole === "recruiter") {
    role.value = requestedRole;
}

updateCompanyField();

// Show or hide password
document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.toggle);

        if (!input) return;

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

    if (!email.value.trim() || !email.validity.valid) {
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

    const submitButton = registerForm.querySelector(
        'button[type="submit"]'
    );

    const buttonText = submitButton.querySelector("span");

    let registered = false;

    submitButton.disabled = true;

    if (buttonText) {
        buttonText.textContent = "Creating account...";
    }

    try {
        const requestBody = {
            fullName: fullName.value.trim(),
            email: email.value.trim().toLowerCase(),
            role: role.value,
            password: password.value,
            confirmPassword: confirmPassword.value
        };

        if (role.value === "recruiter") {
            if (!companyNameInput.value.trim()) {
                showMessage("Please enter your company name.");
                companyNameInput.focus();
                return;
            }

            requestBody.companyName = companyNameInput.value.trim();
        }

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showMessage(
                data.message || "Registration failed. Please try again."
            );
            return;
        }

        const loginPage = LOGIN_PAGES[role.value];

        showMessage(
            "Account created successfully! Taking you to sign in...",
            true
        );

        registered = true;
        registerForm.reset();
        updateCompanyField();

        setTimeout(() => {
            window.location.href = loginPage;
        }, 1500);

    } catch (error) {
        console.error("Registration request failed:", error);

        showMessage(
            "Cannot connect to the server. Check the backend and API port."
        );

    } finally {
        // Stay disabled while redirecting after a successful registration.
        if (!registered) {
            submitButton.disabled = false;

            if (buttonText) {
                buttonText.textContent = "Create my account";
            }
        }
    }
});

// Terms of Use placeholder
const termsLink = document.getElementById("termsLink");

if (termsLink) {
    termsLink.addEventListener("click", (event) => {
        event.preventDefault();
        showMessage("The Terms of Use page will be added later.");
    });
}

// Privacy Policy placeholder
const privacyLink = document.getElementById("privacyLink");

if (privacyLink) {
    privacyLink.addEventListener("click", (event) => {
        event.preventDefault();
        showMessage("The Privacy Policy page will be added later.");
    });
}