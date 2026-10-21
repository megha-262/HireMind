// Student dashboard: view switching, job browsing, and applications.
// Account data is filled in by session.js from the authenticated session;
// shared helpers live in dashboard-utils.js, sidebar/menu in dashboard-shell.js.
const views = $$("[data-view]").map(view => view.dataset.view);
const DEFAULT_VIEW = "dashboard";

const studentState = {
  ready: false,
  jobs: [],
  applyTarget: null
};

function currentView() {
  const requested = window.location.hash.slice(1);
  return views.includes(requested) ? requested : DEFAULT_VIEW;
}

function showView() {
  const current = currentView();

  $$("[data-view]").forEach(view => {
    view.hidden = view.dataset.view !== current;
  });

  $$("[data-view-link]").forEach(link => {
    const active = link.dataset.viewLink === current;
    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  window.scrollTo({ top: 0 });

  if (studentState.ready) loadView(current);
}

function loadView(view) {
  if (view === "jobs") loadStudentJobs();
  if (view === "applications") loadStudentApplications();
}

window.addEventListener("hashchange", showView);

document.addEventListener("hiremind:session", () => {
  studentState.ready = true;
  loadView(currentView());
});

// ---------- Find jobs ----------

function renderStudentJobs() {
  const container = $("#studentJobsList");
  const query = $("#studentJobSearch").value.trim().toLowerCase();
  const workplace = $("#studentWorkplaceFilter").value;

  if (!studentState.jobs.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No open jobs right now.",
      message: "Companies haven't posted any open positions yet. Check back soon."
    }));
    return;
  }

  const jobs = studentState.jobs.filter(job =>
    (!workplace || job.workplaceType === workplace) &&
    (!query || [job.title, job.company.name, ...job.skills]
      .some(value => value.toLowerCase().includes(query)))
  );

  if (!jobs.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No jobs match your search.",
      message: "Try a different keyword or workplace."
    }));
    return;
  }

  container.replaceChildren(
    h("div", { class: "job-list" },
      jobs.map(job =>
        h("article", { class: "card job-card" },
          h("div", { class: "job-card-head" },
            h("div", {},
              h("h2", { text: job.title }),
              h("p", { class: "muted", text: job.company.industry ? `${job.company.name} · ${job.company.industry}` : job.company.name })
            ),
            job.applied
              ? badge("selected", "Applied")
              : actionButton("Apply", "apply", job.id, "btn-primary")
          ),
          h("p", { class: "job-meta" },
            [
              jobLocation(job),
              LABELS.employmentType[job.employmentType],
              LABELS.experienceLevel[job.experienceLevel],
              job.deadline ? `Apply by ${formatDate(job.deadline, true)}` : null
            ].filter(Boolean).join(" · ")
          ),
          skillChips(job.skills, 8),
          h("details", { class: "job-details" },
            h("summary", { text: "View description" }),
            h("p", { class: "prewrap", text: job.description })
          )
        )
      )
    )
  );
}

async function loadStudentJobs() {
  const token = nextToken("student-jobs");
  $("#studentJobsList").replaceChildren(stateBlock({ type: "loading", title: "Loading jobs…" }));

  try {
    const { jobs } = await api("/api/student/jobs");
    if (!isCurrent("student-jobs", token)) return;

    studentState.jobs = jobs;
    renderStudentJobs();
  } catch (error) {
    if (!isCurrent("student-jobs", token)) return;

    $("#studentJobsList").replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load jobs.",
      message: error.message,
      action: retryButton(loadStudentJobs)
    }));
  }
}

$("#studentJobSearch").addEventListener("input", renderStudentJobs);
$("#studentWorkplaceFilter").addEventListener("change", renderStudentJobs);

$("#studentJobsList").addEventListener("click", event => {
  const button = event.target.closest("[data-action='apply']");
  if (button) openApply(button.dataset.id);
});

// ---------- Apply dialog ----------

const applyForm = $("#applyForm");

function openApply(jobId) {
  const job = studentState.jobs.find(item => item.id === jobId);
  if (!job) return;

  studentState.applyTarget = job.id;
  applyForm.reset();
  setAlert($("#applyMessage"), "");
  $("#applyTitle").textContent = `Apply for ${job.title}`;
  $("#applyJob").textContent = job.company.name;

  openDialog($("#applyDialog"));
}

applyForm.addEventListener("submit", async event => {
  event.preventDefault();

  const submit = $("#applySubmit");
  const skills = applyForm.elements.skills.value.split(",").map(skill => skill.trim()).filter(Boolean);

  if (skills.length > 20) {
    setAlert($("#applyMessage"), "Add at most 20 skills.");
    return;
  }

  setBusy(submit, true, "Submitting…");

  try {
    const data = await api(`/api/student/jobs/${studentState.applyTarget}/apply`, {
      method: "POST",
      body: { skills, coverNote: applyForm.elements.coverNote.value.trim() }
    });

    $("#applyDialog").close();
    showToast(data.message);
    loadStudentJobs();
  } catch (error) {
    setAlert($("#applyMessage"), error.message);
  } finally {
    setBusy(submit, false);
  }
});

// ---------- My applications ----------

function interviewInfo(interview) {
  if (!interview) return h("span", { class: "muted", text: "—" });

  if (interview.status !== "scheduled") {
    return badge(interview.status, LABELS.interviewStatus[interview.status]);
  }

  return h("div", {},
    h("div", { class: "cell-title", text: formatDateTime(interview.scheduledAt) }),
    h("div", { class: "cell-sub", text: `${LABELS.mode[interview.mode]} · ${interview.durationMinutes} minutes` }),
    interview.meetingDetails ? h("div", { class: "cell-sub", text: interview.meetingDetails }) : null
  );
}

async function loadStudentApplications() {
  const container = $("#studentApplicationsList");
  const token = nextToken("student-applications");

  container.replaceChildren(stateBlock({ type: "loading", title: "Loading applications…" }));

  try {
    const { applications } = await api("/api/student/applications");
    if (!isCurrent("student-applications", token)) return;

    if (!applications.length) {
      container.replaceChildren(stateBlock({
        type: "empty",
        title: "You haven't applied for any jobs yet.",
        message: "Browse open positions and apply to start tracking your applications here.",
        action: linkButton("#jobs", "Find jobs")
      }));
      return;
    }

    container.replaceChildren(table(
      ["Job", "Company", "Applied", "Status", "Interview"],
      applications.map(application =>
        h("tr", {},
          h("td", { class: "cell-title", text: application.job.title }),
          h("td", { text: application.job.companyName || "—" }),
          h("td", { text: formatDate(application.createdAt) }),
          h("td", {}, badge(application.status, LABELS.applicationStatus[application.status])),
          h("td", {}, interviewInfo(application.interview))
        )
      )
    ));
  } catch (error) {
    if (!isCurrent("student-applications", token)) return;

    container.replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load your applications.",
      message: error.message,
      action: retryButton(loadStudentApplications)
    }));
  }
}

showView();
