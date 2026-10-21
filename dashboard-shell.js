// Shared dashboard chrome: mobile sidebar and account menu.
// Used by the student and company dashboards.
(function () {
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("sidebarScrim");
  const menuToggle = document.getElementById("menuToggle");
  const accountButton = document.getElementById("accountButton");
  const accountDropdown = document.getElementById("accountDropdown");

  function setSidebar(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  function setAccountMenu(open) {
    accountDropdown.hidden = !open;
    accountButton.setAttribute("aria-expanded", String(open));
  }

  menuToggle.addEventListener("click", () => {
    setSidebar(!sidebar.classList.contains("open"));
  });

  scrim.addEventListener("click", () => setSidebar(false));

  accountButton.addEventListener("click", event => {
    event.stopPropagation();
    setAccountMenu(accountDropdown.hidden);
  });

  document.addEventListener("click", event => {
    if (!accountDropdown.hidden && !event.target.closest(".account-menu")) {
      setAccountMenu(false);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;

    if (!accountDropdown.hidden) {
      setAccountMenu(false);
      accountButton.focus();
    }

    if (sidebar.classList.contains("open")) {
      setSidebar(false);
      menuToggle.focus();
    }
  });

  // Navigating closes the mobile sidebar and the account menu.
  window.addEventListener("hashchange", () => {
    setSidebar(false);
    setAccountMenu(false);
  });
})();
