// Shared by protected pages: loads the signed-in user and wires up logout.
// The server already blocks unauthenticated page loads; this fills the page
// from the session (never from hard-coded or stored demo data) and keeps it
// in sync if the session expires or the page is restored from the back cache.
//
// Page contract:
//   <body data-role="student|recruiter" class="is-loading">
//   [data-user-*] / [data-company-name]  elements filled from /api/auth/me
//   [data-load-error]                    receives the load error message
//   [data-retry]                         retries loading the account
//   [data-logout]                        signs out
// Dispatches "hiremind:session" on document (detail: user) when ready.
(function () {
  const LOGIN_PAGES = {
    student: "index.html",
    recruiter: "company-login.html"
  };

  const ROLE_LABELS = {
    student: "Student",
    recruiter: "Company"
  };

  const body = document.body;
  const pageRole = body.dataset.role;
  const loginPage = LOGIN_PAGES[pageRole] || "index.html";

  function initialsOf(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toUpperCase();
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function fill(selector, value) {
    document.querySelectorAll(selector).forEach(element => {
      element.textContent = value;
    });
  }

  function setState(state) {
    body.classList.remove("is-loading", "is-ready", "is-error");
    body.classList.add(`is-${state}`);
    body.setAttribute("aria-busy", String(state === "loading"));
  }

  function showError(message) {
    fill("[data-load-error]", message);
    setState("error");
  }

  function showUser(user) {
    fill("[data-user-name]", user.fullName);
    fill("[data-user-first-name]", user.fullName.split(/\s+/)[0]);
    fill("[data-user-email]", user.email);
    fill("[data-user-initials]", initialsOf(user.fullName));
    fill("[data-user-role]", ROLE_LABELS[user.role] || user.role);
    fill("[data-user-joined]", formatDate(user.createdAt));
    fill("[data-company-name]", user.companyName || "");
    fill("[data-company-initials]", initialsOf(user.companyName || user.fullName));
    setState("ready");

    // Lets page scripts load their own data once the account is known.
    document.dispatchEvent(new CustomEvent("hiremind:session", { detail: user }));
  }

  async function loadUser() {
    setState("loading");

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (response.status === 401) {
        window.location.replace(loginPage);
        return;
      }

      if (!response.ok) {
        showError(
          response.status === 503
            ? "HireMind is temporarily unavailable. Please try again in a moment."
            : "We couldn't load your account details. Please try again."
        );
        return;
      }

      const data = await response.json();

      if (data.user.role !== pageRole) {
        window.location.replace(data.redirectTo);
        return;
      }

      showUser(data.user);
    } catch (error) {
      showError(
        "We couldn't reach the HireMind server. Check your connection and try again."
      );
    }
  }

  async function logout(button) {
    button.disabled = true;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });
    } finally {
      window.location.replace(loginPage);
    }
  }

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => logout(button));
  });

  document.querySelectorAll("[data-retry]").forEach(button => {
    button.addEventListener("click", loadUser);
  });

  window.addEventListener("pageshow", event => {
    if (event.persisted) loadUser();
  });

  loadUser();
})();
