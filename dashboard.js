if (sessionStorage.getItem("hireMindLoggedIn") !== "true") {
  window.location.replace("index.html");
}
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const sections = ["overview", "practice", "history", "feedback", "profile"];
let toastTimeout;
let lastFocusedElement = null;

const sampleInterviews = [
  { title: "Java Developer", type: "Technical", date: "Oct 18, 2026", score: "84/100", status: "Completed" },
  { title: "HR Practice", type: "HR", date: "Oct 16, 2026", score: "76/100", status: "Completed" },
  { title: "Data Structures", type: "Technical", date: "Oct 14, 2026", score: "—", status: "Not started" },
  { title: "Problem Solving", type: "Technical", date: "Oct 12, 2026", score: "79/100", status: "Completed" },
  { title: "Self Introduction", type: "HR", date: "Oct 10, 2026", score: "73/100", status: "Completed" }
];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function openModal(title, content) {
  lastFocusedElement = document.activeElement;
  $("#modalTitle").textContent = title;
  $("#modalBody").replaceChildren();

  if (typeof content === "string") {
    const paragraph = document.createElement("p");
    paragraph.textContent = content;
    $("#modalBody").append(paragraph);
  } else {
    $("#modalBody").append(content);
  }

  $("#modalBackdrop").classList.remove("hidden");
  $("#modalClose").focus();
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function navigateTo(section) {
  if (!sections.includes(section)) return;

  sections.forEach(name => {
    const element = $(`#${name}Section`);
    if (element) element.classList.toggle("hidden", name !== section);
  });

  $$(".nav-link[data-section]").forEach(button => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  const labels = {
    overview: "Overview",
    practice: "Practice Interviews",
    history: "Interview History",
    feedback: "My Feedback",
    profile: "My Profile"
  };

  $("#breadcrumbName").textContent = labels[section];
  $("#sidebar").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderInterviews() {
  const tbody = $("#historyTable");
  tbody.replaceChildren();

  sampleInterviews.forEach(interview => {
    const row = document.createElement("tr");

    const values = [
      interview.title,
      interview.type,
      interview.date,
      interview.score
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");

      if (index === 0) {
        const icon = document.createElement("span");
        icon.className = `table-icon ${interview.type === "HR" ? "blue" : "purple"}`;
        icon.textContent = interview.type === "HR" ? "♡" : "⌘";

        const title = document.createElement("span");
        title.className = "table-title";
        title.textContent = value;

        cell.append(icon, title);
      } else {
        cell.textContent = value;
      }

      row.append(cell);
    });

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${interview.status === "Completed" ? "completed" : "pending"}`;
    status.textContent = interview.status;
    statusCell.append(status);
    row.append(statusCell);

    const actionCell = document.createElement("td");
    const action = document.createElement("button");
    action.className = "row-action";
    action.textContent = interview.status === "Completed" ? "View ↗" : "Start ↗";

    if (interview.status === "Completed") {
      action.addEventListener("click", () => showFeedback(interview.title));
    } else {
      action.addEventListener("click", () => showPracticeSetup("Technical"));
    }

    actionCell.append(action);
    row.append(actionCell);
    tbody.append(row);
  });
}

function showFeedback(title) {
  const interview = sampleInterviews.find(item => item.title === title);

  if (!interview || interview.status !== "Completed") {
    showToast("Complete a practice session to see feedback.");
    return;
  }

  const content = document.createElement("div");

  const score = document.createElement("p");
  score.textContent = `Sample score: ${interview.score}`;

  const explanation = document.createElement("p");
  explanation.textContent =
    "This is demonstration feedback. Real question-level feedback and AI-generated scores will be added after backend and evaluation integration.";

  const tips = document.createElement("ul");

  [
    "Explain your approach step by step.",
    "Use specific examples to support your answers.",
    "Review concepts that you find challenging."
  ].forEach(text => {
    const item = document.createElement("li");
    item.textContent = text;
    tips.append(item);
  });

  content.append(score, explanation, tips);
  openModal(`${title} — Feedback`, content);
}

function showPracticeSetup(type) {
  const content = document.createElement("div");
  const description = document.createElement("p");
  description.textContent =
    `${type} interview selected. Choose a difficulty and duration for your demo setup.`;

  const label = document.createElement("label");
  label.htmlFor = "practiceDifficulty";
  label.textContent = "Difficulty";

  const difficulty = document.createElement("select");
  difficulty.id = "practiceDifficulty";
  difficulty.className = "demo-select";

  ["Beginner", "Intermediate", "Advanced"].forEach(level => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level;
    difficulty.append(option);
  });

  const durationLabel = document.createElement("label");
  durationLabel.htmlFor = "practiceDuration";
  durationLabel.textContent = "Duration";

  const duration = document.createElement("select");
  duration.id = "practiceDuration";
  duration.className = "demo-select";

  ["15 minutes", "30 minutes", "45 minutes"].forEach(time => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    duration.append(option);
  });

  const startButton = document.createElement("button");
  startButton.className = "primary-button full-width";
  startButton.style.marginTop = "15px";
  startButton.textContent = "Continue demo setup";

  startButton.addEventListener("click", () => {
    const chosenDifficulty = difficulty.value;
    const chosenDuration = duration.value;
    closeModal();

    openModal("Practice setup saved", 
      `Your demo selection: ${type} interview, ${chosenDifficulty} difficulty, ${chosenDuration}. The actual interview room will be implemented next.`
    );
  });

  content.append(description, label, difficulty, durationLabel, duration, startButton);
  openModal(`Set up ${type} practice`, content);
}

$$(".nav-link[data-section], .profile-mini, .top-avatar").forEach(button => {
  button.addEventListener("click", () => navigateTo(button.dataset.section));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => navigateTo(button.dataset.go));
});

$$("[data-section]").forEach(button => {
  if (button.matches(".nav-link, .profile-mini, .top-avatar")) return;
  button.addEventListener("click", () => navigateTo(button.dataset.section));
});

$$("[data-start]").forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.start;
    window.location.href =
      `interview-setup.html?type=${encodeURIComponent(type)}`;
  });
});

$$("[data-feedback]").forEach(button => {
  button.addEventListener("click", () => showFeedback(button.dataset.feedback));
});

$("#menuToggle").addEventListener("click", () => {
  const sidebar = $("#sidebar");
  const isOpen = sidebar.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
});

$("#helpButton").addEventListener("click", () => {
  openModal("HireMind Help & Support",
    "This is the frontend demo. Help documentation and support integration can be added as the project develops."
  );
});

$("#notificationButton").addEventListener("click", () => {
  openModal("Notifications", "You are all caught up! Real interview notifications will be connected later.");
});

$("#modalClose").addEventListener("click", closeModal);
$("#modalOkay").addEventListener("click", closeModal);

$("#modalBackdrop").addEventListener("click", event => {
  if (event.target === $("#modalBackdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#modalBackdrop").classList.contains("hidden")) {
    closeModal();
  }
});

$("#profileForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#fullName").value.trim();
  const email = $("#email").value.trim();

  if (!name || !email || !$("#email").checkValidity()) {
    showToast("Please enter a valid name and email.");
    return;
  }

  const firstName = name.split(/\s+/)[0];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  $("#welcomeName").textContent = firstName;
  $("#sidebarName").textContent = name;
  $("#profileDisplayName").textContent = name;
  $("#profileAvatar").textContent = initials;
  $$(".top-avatar, .avatar").forEach(element => {
    element.textContent = initials;
  });

  showToast("Demo profile updated for this page session.");
});

renderInterviews();
navigateTo("overview");
