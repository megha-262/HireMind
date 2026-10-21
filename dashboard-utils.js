// Shared helpers for the student and company dashboards: API calls,
// safe DOM building (textContent only), formatting, feedback, and dialogs.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// ---------- Labels ----------

const LABELS = {
  employmentType: {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    internship: "Internship",
    temporary: "Temporary"
  },
  experienceLevel: {
    internship: "Internship",
    entry: "Entry level",
    mid: "Mid level",
    senior: "Senior",
    lead: "Lead / Manager"
  },
  workplaceType: {
    on_site: "On-site",
    hybrid: "Hybrid",
    remote: "Remote"
  },
  applicationStatus: {
    applied: "Applied",
    under_review: "Under Review",
    shortlisted: "Shortlisted",
    interview_scheduled: "Interview Scheduled",
    selected: "Selected",
    rejected: "Rejected"
  },
  jobStatus: {
    open: "Open",
    closed: "Closed",
    expired: "Deadline passed"
  },
  interviewStatus: {
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
    overdue: "Awaiting outcome"
  },
  mode: {
    video: "Video call",
    phone: "Phone call",
    in_person: "In person"
  }
};

const TONES = {
  open: "green",
  closed: "gray",
  expired: "orange",
  applied: "blue",
  under_review: "purple",
  shortlisted: "teal",
  interview_scheduled: "orange",
  selected: "green",
  rejected: "red",
  scheduled: "orange",
  completed: "green",
  cancelled: "gray",
  overdue: "orange"
};

const loadTokens = {};

// ---------- API ----------

async function api(path, { method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store"
    });
  } catch {
    throw new Error("Can't reach the HireMind server. Check your connection and try again.");
  }

  if (response.status === 401) {
    window.location.replace(document.body.dataset.role === "recruiter" ? "company-login.html" : "index.html");
    throw new Error("Your session has expired. Please sign in again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }

  return data;
}

// ---------- DOM helpers ----------

function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else element.setAttribute(key, value === true ? "" : value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }

  return element;
}

function icon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");

  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#${id}`);
  svg.append(use);

  return svg;
}

function badge(value, label) {
  return h("span", { class: "badge", dataset: { tone: TONES[value] || "gray" }, text: label });
}

function skillChips(skills, limit = Infinity) {
  if (!skills.length) return h("span", { class: "muted", text: "—" });

  const shown = skills.slice(0, limit).map(skill => h("span", { class: "chip", text: skill }));

  if (skills.length > limit) {
    shown.push(h("span", { class: "chip chip-more", text: `+${skills.length - limit}` }));
  }

  return h("div", { class: "chip-list" }, shown);
}

function stateBlock({ type, title, message, action }) {
  if (type === "loading") {
    return h("div", { class: "section-state", role: "status" },
      h("span", { class: "spinner spinner-small", "aria-hidden": "true" }),
      h("p", { class: "muted", text: title || "Loading…" })
    );
  }

  return h("div", { class: `section-state ${type === "error" ? "is-error" : ""}`, role: type === "error" ? "alert" : null },
    h("p", { class: "section-state-title", text: title }),
    message ? h("p", { class: "muted", text: message }) : null,
    action || null
  );
}

function linkButton(href, text, variant = "btn-primary") {
  return h("a", { href, class: `btn ${variant}`, text });
}

function actionButton(text, action, id, variant = "btn-ghost") {
  return h("button", { type: "button", class: `btn btn-small ${variant}`, dataset: { action, id }, text });
}

function retryButton(handler) {
  const button = h("button", { type: "button", class: "btn btn-secondary", text: "Try again" });
  button.addEventListener("click", handler);
  return button;
}

function table(headers, rows) {
  return h("div", { class: "table-wrap" },
    h("table", { class: "data-table" },
      h("thead", {}, h("tr", {}, headers.map(text => h("th", { scope: "col", text })))),
      h("tbody", {}, rows)
    )
  );
}

// ---------- Formatting ----------

function formatDate(value, utc = false) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(utc ? { timeZone: "UTC" } : {})
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;

  return formatDate(value);
}

// "YYYY-MM-DDTHH:mm" in local time, for datetime-local / date inputs
function toLocalInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function jobDisplayStatus(job) {
  if (job.status === "open" && job.deadline && new Date(job.deadline) < new Date()) {
    return "expired";
  }
  return job.status;
}

function jobLocation(job) {
  const workplace = LABELS.workplaceType[job.workplaceType];
  return job.location ? `${workplace} · ${job.location}` : workplace;
}

// ---------- Feedback (toast + form alerts + busy buttons) ----------

let toastTimer;

function showToast(message, type = "success") {
  const toast = $("#toast");

  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

function setAlert(element, message, type = "error") {
  element.hidden = !message;
  element.textContent = message || "";
  element.dataset.type = type;
}

function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }

  button.disabled = busy;
}

function markInvalid(form, field) {
  $$("[aria-invalid]", form).forEach(input => input.removeAttribute("aria-invalid"));

  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

// Ignores responses from superseded requests (e.g. fast navigation).
function nextToken(key) {
  loadTokens[key] = (loadTokens[key] || 0) + 1;
  return loadTokens[key];
}

function isCurrent(key, token) {
  return loadTokens[key] === token;
}

// ---------- Dialogs ----------

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function confirmAction({ title, message, confirmText = "Confirm", danger = true }) {
  const dialog = $("#confirmDialog");

  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  $("#confirmOk").textContent = confirmText;
  $("#confirmOk").className = `btn ${danger ? "btn-danger" : "btn-primary"}`;

  return new Promise(resolve => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "confirm");
    };

    dialog.returnValue = "";
    dialog.addEventListener("close", onClose);
    openDialog(dialog);
  });
}

if ($("#confirmOk")) {
  $("#confirmOk").addEventListener("click", () => $("#confirmDialog").close("confirm"));
}

$$("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close("cancel"));
});

$$("dialog").forEach(dialog => {
  // Clicking the backdrop closes the dialog
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close("cancel");
  });
});
