// Company dashboard: routing, data loading, and actions.
// Account details come from session.js; everything else from /api/company.
// Shared helpers live in dashboard-utils.js.

// ---------- Company constants ----------

const MANUAL_STATUSES = ["applied", "under_review", "shortlisted", "selected", "rejected"];
const FINAL_STATUSES = ["selected", "rejected"];

const ACTIVITY_ICONS = {
  job_posted: "i-briefcase",
  job_updated: "i-briefcase",
  job_closed: "i-briefcase",
  job_reopened: "i-briefcase",
  job_deleted: "i-briefcase",
  application_received: "i-file",
  application_status: "i-users",
  interview_scheduled: "i-calendar",
  interview_completed: "i-clipboard",
  interview_cancelled: "i-calendar",
  profile_updated: "i-building"
};

// ---------- State ----------

const state = {
  ready: false,
  jobs: [],
  applications: [],
  editingJobId: null,
  candidateJobPreset: "",
  scheduleTarget: null,
  completeTarget: null
};

// ---------- Company helpers ----------

function candidateCell(application, withNote = false) {
  return h("td", {},
    h("div", { class: "cell-title", text: application.candidate.name }),
    h("div", { class: "cell-sub", text: application.candidate.email }),
    withNote && application.coverNote
      ? h("details", { class: "cover-note" },
          h("summary", { text: "Cover note" }),
          h("p", { text: application.coverNote })
        )
      : null
  );
}

// ---------- Routing ----------

const views = $$("[data-view]").map(view => view.dataset.view);
const NAV_FOR_ROUTE = { "edit-job": "jobs" };

function parseRoute() {
  const [route = "", param = ""] = window.location.hash.slice(1).split("/");

  if (route === "edit-job" && param) return { route, view: "post-job", param };
  if (views.includes(route)) return { route, view: route, param: "" };

  return { route: "dashboard", view: "dashboard", param: "" };
}

function showView() {
  const { route, view, param } = parseRoute();
  const navTarget = NAV_FOR_ROUTE[route] || view;

  $$("[data-view]").forEach(section => {
    section.hidden = section.dataset.view !== view;
  });

  $$("[data-view-link]").forEach(link => {
    const active = link.dataset.viewLink === navTarget;
    link.classList.toggle("active", active);

    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0 });

  if (state.ready) loadRoute(route, param);
}

function loadRoute(route, param) {
  switch (route) {
    case "dashboard": return loadOverview();
    case "profile": return loadProfile();
    case "post-job": return startNewJob();
    case "edit-job": return startEditJob(param);
    case "jobs": return loadJobs();
    case "candidates": return loadCandidates();
    case "interviews": return loadInterviews();
    case "results": return loadResults();
    case "settings": return resetSettings();
  }
}

function reloadCurrentRoute() {
  const { route, param } = parseRoute();
  loadRoute(route, param);
}

window.addEventListener("hashchange", showView);

document.addEventListener("hiremind:session", () => {
  state.ready = true;
  reloadCurrentRoute();
});

// ---------- Dashboard overview ----------

const STAT_CARDS = [
  {
    key: "activeJobs",
    label: "Active jobs",
    icon: "i-briefcase",
    tone: "purple",
    href: "#jobs",
    hint: stats => `${stats.totalJobs} job${stats.totalJobs === 1 ? "" : "s"} posted in total`,
    empty: stats => stats.totalJobs
      ? { text: "No open jobs right now.", action: ["#jobs", "Manage jobs"] }
      : { text: "No jobs posted yet.", action: ["#post-job", "Post your first job"] }
  },
  {
    key: "totalApplications",
    label: "Total applications",
    icon: "i-file",
    tone: "blue",
    href: "#candidates",
    hint: () => "Across all your job postings",
    empty: stats => ({
      text: "No applications received yet.",
      action: stats.activeJobs ? null : ["#post-job", "Post a job"]
    })
  },
  {
    key: "inPipeline",
    label: "Candidates in pipeline",
    icon: "i-users",
    tone: "green",
    href: "#candidates",
    hint: () => "Applied, in review, shortlisted, or interviewing",
    empty: () => ({ text: "No candidates in your pipeline.", action: null })
  },
  {
    key: "interviewsScheduled",
    label: "Interviews scheduled",
    icon: "i-calendar",
    tone: "orange",
    href: "#interviews",
    hint: () => "Upcoming interviews",
    empty: stats => ({
      text: "No interviews scheduled.",
      action: stats.inPipeline ? ["#interviews", "Schedule an interview"] : null
    })
  }
];

function renderStats(stats) {
  $("#statsGrid").replaceChildren(
    ...STAT_CARDS.map(card => {
      const value = stats[card.key];
      const empty = value === 0 ? card.empty(stats) : null;

      return h("article", { class: "stat-card" },
        h("div", { class: "stat-head" },
          h("span", { class: `stat-icon tone-${card.tone}` }, icon(card.icon)),
          h("span", { class: "stat-label", text: card.label })
        ),
        h("p", { class: "stat-value", text: String(value) }),
        empty
          ? h("p", { class: "stat-note", text: empty.text })
          : h("p", { class: "stat-note", text: card.hint(stats) }),
        empty && empty.action
          ? h("a", { class: "text-link", href: empty.action[0], text: `${empty.action[1]} →` })
          : !empty
            ? h("a", { class: "text-link", href: card.href, text: "View →" })
            : null
      );
    })
  );
}

function renderRecentJobs(jobs) {
  const container = $("#recentJobs");

  if (!jobs.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No jobs posted yet.",
      message: "Post a job to start receiving applications from students.",
      action: linkButton("#post-job", "Post your first job")
    }));
    return;
  }

  container.replaceChildren(
    h("ul", { class: "item-list" },
      jobs.map(job => {
        const status = jobDisplayStatus(job);

        return h("li", {},
          h("button", { type: "button", class: "item-button", dataset: { action: "view-job", id: job.id } },
            h("span", { class: "item-main" },
              h("span", { class: "cell-title", text: job.title }),
              h("span", { class: "cell-sub", text: `${jobLocation(job)} · Posted ${formatDate(job.createdAt)}` })
            ),
            h("span", { class: "item-meta" },
              h("span", { class: "cell-sub", text: `${job.applicationCount} application${job.applicationCount === 1 ? "" : "s"}` }),
              badge(status, LABELS.jobStatus[status])
            )
          )
        );
      })
    )
  );
}

function renderActivity(activity) {
  const container = $("#recentActivity");

  if (!activity.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No activity yet.",
      message: "New job postings, applications, and interview updates will appear here."
    }));
    return;
  }

  container.replaceChildren(
    h("ul", { class: "activity-list" },
      activity.map(item =>
        h("li", {},
          h("span", { class: "activity-icon" }, icon(ACTIVITY_ICONS[item.type] || "i-spark")),
          h("span", { class: "activity-text", text: item.message }),
          h("time", { class: "cell-sub", datetime: item.createdAt, title: formatDateTime(item.createdAt), text: timeAgo(item.createdAt) })
        )
      )
    )
  );
}

async function loadOverview() {
  const token = nextToken("overview");

  $("#statsGrid").replaceChildren(stateBlock({ type: "loading", title: "Loading dashboard…" }));
  $("#recentJobs").replaceChildren();
  $("#recentActivity").replaceChildren();

  try {
    const data = await api("/api/company/overview");
    if (!isCurrent("overview", token)) return;

    renderStats(data.stats);
    renderRecentJobs(data.recentJobs);
    renderActivity(data.recentActivity);
  } catch (error) {
    if (!isCurrent("overview", token)) return;

    $("#statsGrid").replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load your dashboard.",
      message: error.message,
      action: retryButton(loadOverview)
    }));
  }
}

$("#recentJobs").addEventListener("click", event => {
  const button = event.target.closest("[data-action='view-job']");
  if (button) openJobDialog(button.dataset.id);
});

// ---------- Company profile ----------

const profileForm = $("#profileForm");

function fillProfile(profile) {
  profileForm.elements.companyName.value = profile.companyName;
  profileForm.elements.fullName.value = profile.fullName;
  profileForm.elements.email.value = profile.email;
  profileForm.elements.industry.value = profile.industry;
  profileForm.elements.location.value = profile.location;
  profileForm.elements.website.value = profile.website;
  profileForm.elements.description.value = profile.description;
}

function setProfileFormDisabled(disabled) {
  $$("input:not([readonly]), textarea, button", profileForm).forEach(element => {
    element.disabled = disabled;
  });
}

async function loadProfile() {
  const token = nextToken("profile");

  setAlert($("#profileMessage"), "");
  markInvalid(profileForm, null);
  setProfileFormDisabled(true);

  try {
    const { profile } = await api("/api/company/profile");
    if (!isCurrent("profile", token)) return;

    fillProfile(profile);
    setProfileFormDisabled(false);
  } catch (error) {
    if (!isCurrent("profile", token)) return;
    setAlert($("#profileMessage"), `Couldn't load your profile. ${error.message}`);
  }
}

profileForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("#profileMessage");
  const submit = $("#profileSubmit");
  const values = {
    companyName: profileForm.elements.companyName.value.trim(),
    fullName: profileForm.elements.fullName.value.trim(),
    industry: profileForm.elements.industry.value.trim(),
    location: profileForm.elements.location.value.trim(),
    website: profileForm.elements.website.value.trim(),
    description: profileForm.elements.description.value.trim()
  };

  if (!values.companyName) {
    markInvalid(profileForm, profileForm.elements.companyName);
    setAlert(message, "Company name is required.");
    return;
  }

  if (!values.fullName) {
    markInvalid(profileForm, profileForm.elements.fullName);
    setAlert(message, "Contact person is required.");
    return;
  }

  markInvalid(profileForm, null);
  setAlert(message, "");
  setBusy(submit, true, "Saving…");

  try {
    const data = await api("/api/company/profile", { method: "PATCH", body: values });

    fillProfile(data.profile);
    $$("[data-company-name]").forEach(element => {
      element.textContent = data.profile.companyName;
    });
    $$("[data-company-initials]").forEach(element => {
      element.textContent = initialsOf(data.profile.companyName);
    });

    setAlert(message, data.message, "success");
  } catch (error) {
    setAlert(message, error.message);
  } finally {
    setBusy(submit, false);
  }
});

// ---------- Post / edit job ----------

const jobForm = $("#jobForm");

function updateLocationRequirement() {
  const remote = jobForm.elements.workplaceType.value === "remote";

  $("#jobLocationRequired").hidden = remote;
  jobForm.elements.location.placeholder = remote ? "Optional, e.g. Anywhere in India" : "e.g. Pune, India";
}

function setJobFormDisabled(disabled) {
  $$("input, select, textarea, button", jobForm).forEach(element => {
    element.disabled = disabled;
  });
}

function prepareJobForm(editing) {
  jobForm.reset();
  markInvalid(jobForm, null);
  setAlert($("#jobFormMessage"), "");
  setJobFormDisabled(false);

  jobForm.elements.deadline.min = toLocalInputValue(new Date()).slice(0, 10);
  $("#jobFormTitle").textContent = editing ? "Edit job" : "Post a job";
  $("#jobFormSubtitle").textContent = editing
    ? "Update the details of this job posting."
    : "Fields marked * are required. Open jobs are visible to students on HireMind.";
  $("#jobSubmit").textContent = editing ? "Save changes" : "Post job";
  $("#jobCancel").hidden = !editing;

  updateLocationRequirement();
}

function startNewJob() {
  nextToken("job-form");
  state.editingJobId = null;
  prepareJobForm(false);
}

async function startEditJob(id) {
  const token = nextToken("job-form");

  state.editingJobId = id;
  prepareJobForm(true);
  setJobFormDisabled(true);

  try {
    const { job } = await api(`/api/company/jobs/${encodeURIComponent(id)}`);
    if (!isCurrent("job-form", token)) return;

    jobForm.elements.title.value = job.title;
    jobForm.elements.employmentType.value = job.employmentType;
    jobForm.elements.experienceLevel.value = job.experienceLevel;
    jobForm.elements.workplaceType.value = job.workplaceType;
    jobForm.elements.location.value = job.location;
    jobForm.elements.vacancies.value = job.vacancies;
    jobForm.elements.deadline.value = job.deadline ? job.deadline.slice(0, 10) : "";
    jobForm.elements.skills.value = job.skills.join(", ");
    jobForm.elements.description.value = job.description;

    updateLocationRequirement();
    setJobFormDisabled(false);
  } catch (error) {
    if (!isCurrent("job-form", token)) return;

    setAlert($("#jobFormMessage"), `Couldn't load this job. ${error.message}`);
  }
}

function readJobForm() {
  const skills = jobForm.elements.skills.value.split(",").map(skill => skill.trim()).filter(Boolean);

  const values = {
    title: jobForm.elements.title.value.trim(),
    employmentType: jobForm.elements.employmentType.value,
    experienceLevel: jobForm.elements.experienceLevel.value,
    workplaceType: jobForm.elements.workplaceType.value,
    location: jobForm.elements.location.value.trim(),
    vacancies: Number(jobForm.elements.vacancies.value),
    deadline: jobForm.elements.deadline.value || null,
    skills,
    description: jobForm.elements.description.value.trim()
  };

  const checks = [
    [!values.title, jobForm.elements.title, "Job title is required."],
    [!values.employmentType, jobForm.elements.employmentType, "Please choose an employment type."],
    [!values.experienceLevel, jobForm.elements.experienceLevel, "Please choose an experience level."],
    [!values.workplaceType, jobForm.elements.workplaceType, "Please choose a workplace type."],
    [values.workplaceType !== "remote" && !values.location, jobForm.elements.location, "Location is required for on-site and hybrid jobs."],
    [!Number.isInteger(values.vacancies) || values.vacancies < 1 || values.vacancies > 1000, jobForm.elements.vacancies, "Number of vacancies must be a whole number between 1 and 1000."],
    [values.deadline && values.deadline < jobForm.elements.deadline.min, jobForm.elements.deadline, "Application deadline cannot be in the past."],
    [!skills.length, jobForm.elements.skills, "Add at least one required skill."],
    [skills.length > 20, jobForm.elements.skills, "Add at most 20 skills."],
    [!values.description, jobForm.elements.description, "Job description is required."]
  ];

  const failed = checks.find(([invalid]) => invalid);
  return failed ? { error: failed[2], field: failed[1] } : { values };
}

jobForm.elements.workplaceType.addEventListener("change", updateLocationRequirement);

jobForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("#jobFormMessage");
  const submit = $("#jobSubmit");
  const { values, error, field } = readJobForm();

  if (error) {
    markInvalid(jobForm, field);
    setAlert(message, error);
    return;
  }

  markInvalid(jobForm, null);
  setAlert(message, "");
  setBusy(submit, true, state.editingJobId ? "Saving…" : "Posting…");

  try {
    const data = state.editingJobId
      ? await api(`/api/company/jobs/${encodeURIComponent(state.editingJobId)}`, { method: "PUT", body: values })
      : await api("/api/company/jobs", { method: "POST", body: values });

    showToast(data.message);
    window.location.hash = "#jobs";
  } catch (requestError) {
    setAlert(message, requestError.message);
  } finally {
    setBusy(submit, false);
  }
});

// ---------- Manage jobs ----------

function renderJobs() {
  const container = $("#jobsList");
  const query = $("#jobSearch").value.trim().toLowerCase();
  const statusFilter = $("#jobStatusFilter").value;

  if (!state.jobs.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No jobs posted yet.",
      message: "Create your first job posting to start receiving applications.",
      action: linkButton("#post-job", "Post a job")
    }));
    return;
  }

  const jobs = state.jobs.filter(job =>
    (!statusFilter || job.status === statusFilter) &&
    (!query || job.title.toLowerCase().includes(query))
  );

  if (!jobs.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No jobs match your filters.",
      message: "Try a different search or status."
    }));
    return;
  }

  container.replaceChildren(table(
    ["Job", "Location", "Type", "Status", "Created", "Applications", "Actions"],
    jobs.map(job => {
      const status = jobDisplayStatus(job);

      return h("tr", {},
        h("td", {},
          h("button", { type: "button", class: "link-button cell-title", dataset: { action: "view", id: job.id }, text: job.title }),
          h("div", { class: "cell-sub", text: LABELS.experienceLevel[job.experienceLevel] })
        ),
        h("td", { text: jobLocation(job) }),
        h("td", { text: LABELS.employmentType[job.employmentType] }),
        h("td", {}, badge(status, LABELS.jobStatus[status])),
        h("td", { text: formatDate(job.createdAt) }),
        h("td", { class: "numeric", text: String(job.applicationCount) }),
        h("td", {},
          h("div", { class: "row-actions" },
            actionButton("View", "view", job.id),
            actionButton("Edit", "edit", job.id),
            actionButton(job.status === "open" ? "Close" : "Reopen", "toggle", job.id),
            actionButton("Delete", "delete", job.id, "btn-ghost-danger")
          )
        )
      );
    })
  ));
}

async function loadJobs() {
  const token = nextToken("jobs");
  $("#jobsList").replaceChildren(stateBlock({ type: "loading", title: "Loading jobs…" }));

  try {
    const { jobs } = await api("/api/company/jobs");
    if (!isCurrent("jobs", token)) return;

    state.jobs = jobs;
    renderJobs();
  } catch (error) {
    if (!isCurrent("jobs", token)) return;

    $("#jobsList").replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load your jobs.",
      message: error.message,
      action: retryButton(loadJobs)
    }));
  }
}

async function toggleJob(job) {
  const closing = job.status === "open";

  if (closing) {
    const confirmed = await confirmAction({
      title: `Close "${job.title}"?`,
      message: "Students will no longer be able to apply. Existing applications are kept, and you can reopen the job later.",
      confirmText: "Close job"
    });
    if (!confirmed) return;
  }

  try {
    const data = await api(`/api/company/jobs/${job.id}/status`, {
      method: "PATCH",
      body: { status: closing ? "closed" : "open" }
    });
    showToast(data.message);
  } catch (error) {
    showToast(error.message, "error");
  }

  reloadCurrentRoute();
}

async function deleteJob(job) {
  const confirmed = await confirmAction({
    title: `Delete "${job.title}"?`,
    message: "This permanently removes the job posting. This can't be undone.",
    confirmText: "Delete job"
  });
  if (!confirmed) return;

  try {
    const data = await api(`/api/company/jobs/${job.id}`, { method: "DELETE" });
    showToast(data.message);
  } catch (error) {
    showToast(error.message, "error");
  }

  loadJobs();
}

$("#jobSearch").addEventListener("input", renderJobs);
$("#jobStatusFilter").addEventListener("change", renderJobs);

$("#jobsList").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const job = state.jobs.find(item => item.id === button.dataset.id);
  if (!job) return;

  switch (button.dataset.action) {
    case "view": return openJobDialog(job.id);
    case "edit": window.location.hash = `#edit-job/${job.id}`; return;
    case "toggle": return toggleJob(job);
    case "delete": return deleteJob(job);
  }
});

// ---------- Job details dialog ----------

async function openJobDialog(id) {
  const dialog = $("#jobDialog");
  const body = $("#jobDialogBody");
  const token = nextToken("job-dialog");

  $("#jobDialogTitle").textContent = "Job details";
  body.replaceChildren(stateBlock({ type: "loading", title: "Loading job…" }));
  openDialog(dialog);

  try {
    const { job, applicationsByStatus } = await api(`/api/company/jobs/${encodeURIComponent(id)}`);
    if (!isCurrent("job-dialog", token)) return;

    const status = jobDisplayStatus(job);
    const pipeline = Object.entries(LABELS.applicationStatus)
      .filter(([key]) => applicationsByStatus[key])
      .map(([key, label]) => h("li", {}, badge(key, label), h("strong", { text: String(applicationsByStatus[key]) })));

    const viewCandidates = h("button", { type: "button", class: "btn btn-secondary", text: "View candidates" });
    viewCandidates.addEventListener("click", () => {
      state.candidateJobPreset = job.id;
      dialog.close();
      window.location.hash = "#candidates";
    });

    const edit = h("a", { href: `#edit-job/${job.id}`, class: "btn btn-primary", text: "Edit job" });
    edit.addEventListener("click", () => dialog.close());

    $("#jobDialogTitle").textContent = job.title;
    body.replaceChildren(
      h("div", { class: "dialog-badges" },
        badge(status, LABELS.jobStatus[status]),
        h("span", { class: "muted", text: `Posted ${formatDate(job.createdAt)}` })
      ),
      h("dl", { class: "meta-grid" },
        h("div", {}, h("dt", { text: "Employment type" }), h("dd", { text: LABELS.employmentType[job.employmentType] })),
        h("div", {}, h("dt", { text: "Experience level" }), h("dd", { text: LABELS.experienceLevel[job.experienceLevel] })),
        h("div", {}, h("dt", { text: "Location" }), h("dd", { text: jobLocation(job) })),
        h("div", {}, h("dt", { text: "Vacancies" }), h("dd", { text: String(job.vacancies) })),
        h("div", {}, h("dt", { text: "Application deadline" }), h("dd", { text: job.deadline ? formatDate(job.deadline, true) : "No deadline" })),
        h("div", {}, h("dt", { text: "Applications" }), h("dd", { text: String(job.applicationCount) }))
      ),
      h("h3", { text: "Required skills" }),
      skillChips(job.skills),
      h("h3", { text: "Description" }),
      h("p", { class: "prewrap", text: job.description }),
      pipeline.length ? h("h3", { text: "Applications by status" }) : null,
      pipeline.length ? h("ul", { class: "pipeline-list" }, pipeline) : null,
      h("div", { class: "dialog-actions" }, viewCandidates, edit)
    );
  } catch (error) {
    if (!isCurrent("job-dialog", token)) return;

    body.replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load this job.",
      message: error.message
    }));
  }
}

// ---------- Candidates ----------

function interviewSummary(application) {
  const interview = application.interview;
  if (!interview) return h("span", { class: "muted", text: "—" });

  const overdue = interview.status === "scheduled" && new Date(interview.scheduledAt) < new Date();
  const status = overdue ? "overdue" : interview.status;

  return h("div", {},
    badge(status, LABELS.interviewStatus[status]),
    interview.status !== "cancelled"
      ? h("div", { class: "cell-sub", text: formatDateTime(interview.scheduledAt) })
      : null
  );
}

function statusSelect(application) {
  const select = h("select", {
    class: "status-select",
    dataset: { id: application.id, previous: application.status },
    "aria-label": `Application status for ${application.candidate.name}`
  });

  const options = MANUAL_STATUSES.slice();
  if (!options.includes(application.status)) options.splice(3, 0, application.status);

  options.forEach(status => {
    select.append(h("option", {
      value: status,
      selected: status === application.status,
      disabled: status === "interview_scheduled",
      text: LABELS.applicationStatus[status]
    }));
  });

  return select;
}

function canSchedule(application) {
  return !FINAL_STATUSES.includes(application.status) &&
    !(application.interview && application.interview.status === "scheduled");
}

function renderCandidates() {
  const container = $("#candidatesList");
  const query = $("#candidateSearch").value.trim().toLowerCase();
  const jobFilter = $("#candidateJobFilter").value;
  const statusFilter = $("#candidateStatusFilter").value;

  if (!state.applications.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No applications received yet.",
      message: state.jobs.some(job => job.status === "open")
        ? "Candidates will appear here when students apply to your open jobs."
        : "Post a job so students can apply. Candidates will appear here.",
      action: state.jobs.some(job => job.status === "open") ? null : linkButton("#post-job", "Post a job")
    }));
    return;
  }

  const applications = state.applications.filter(application =>
    (!jobFilter || application.job.id === jobFilter) &&
    (!statusFilter || application.status === statusFilter) &&
    (!query || [
      application.candidate.name,
      application.candidate.email,
      application.job.title,
      ...application.skills
    ].some(value => value.toLowerCase().includes(query)))
  );

  if (!applications.length) {
    container.replaceChildren(stateBlock({
      type: "empty",
      title: "No candidates match your filters.",
      message: "Try a different search, job, or status."
    }));
    return;
  }

  container.replaceChildren(table(
    ["Candidate", "Applied job", "Applied", "Skills", "Status", "Interview", ""],
    applications.map(application =>
      h("tr", {},
        candidateCell(application, true),
        h("td", { text: application.job.title }),
        h("td", { text: formatDate(application.createdAt) }),
        h("td", {}, skillChips(application.skills, 4)),
        h("td", {}, statusSelect(application)),
        h("td", {}, interviewSummary(application)),
        h("td", {},
          canSchedule(application)
            ? actionButton("Schedule interview", "schedule", application.id)
            : null
        )
      )
    )
  ));
}

function fillJobFilter() {
  const select = $("#candidateJobFilter");
  const current = state.candidateJobPreset || select.value;

  select.replaceChildren(
    h("option", { value: "", text: "All jobs" }),
    ...state.jobs.map(job => h("option", { value: job.id, text: job.title }))
  );

  select.value = state.jobs.some(job => job.id === current) ? current : "";
  state.candidateJobPreset = "";
}

async function loadCandidates() {
  const token = nextToken("candidates");
  $("#candidatesList").replaceChildren(stateBlock({ type: "loading", title: "Loading candidates…" }));

  try {
    const [{ applications }, { jobs }] = await Promise.all([
      api("/api/company/applications"),
      api("/api/company/jobs")
    ]);
    if (!isCurrent("candidates", token)) return;

    state.applications = applications;
    state.jobs = jobs;
    fillJobFilter();
    renderCandidates();
  } catch (error) {
    if (!isCurrent("candidates", token)) return;

    $("#candidatesList").replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load candidates.",
      message: error.message,
      action: retryButton(loadCandidates)
    }));
  }
}

async function changeStatus(select) {
  const application = state.applications.find(item => item.id === select.dataset.id);
  const status = select.value;
  if (!application) return;

  const hasInterview = application.interview && application.interview.status === "scheduled";

  if (hasInterview || status === "rejected") {
    const confirmed = await confirmAction({
      title: `Move ${application.candidate.name} to ${LABELS.applicationStatus[status]}?`,
      message: hasInterview
        ? "This candidate has a scheduled interview. Changing the status will cancel it."
        : "The candidate will see that their application was not successful.",
      confirmText: "Change status"
    });

    if (!confirmed) {
      select.value = select.dataset.previous;
      return;
    }
  }

  select.disabled = true;

  try {
    const data = await api(`/api/company/applications/${application.id}/status`, {
      method: "PATCH",
      body: { status }
    });

    Object.assign(application, data.application);
    showToast(data.message);
  } catch (error) {
    showToast(error.message, "error");
  }

  reloadCurrentRoute();
}

$("#candidateSearch").addEventListener("input", renderCandidates);
$("#candidateJobFilter").addEventListener("change", renderCandidates);
$("#candidateStatusFilter").addEventListener("change", renderCandidates);

$("#candidatesList").addEventListener("change", event => {
  if (event.target.matches(".status-select")) changeStatus(event.target);
});

$("#candidatesList").addEventListener("click", event => {
  const button = event.target.closest("[data-action='schedule']");
  if (button) openSchedule(button.dataset.id);
});

// ---------- Interview management ----------

function renderInterviews() {
  const eligible = state.applications.filter(application =>
    application.status === "shortlisted" && canSchedule(application)
  );

  const upcoming = state.applications
    .filter(application => application.interview && application.interview.status === "scheduled")
    .sort((a, b) => new Date(a.interview.scheduledAt) - new Date(b.interview.scheduledAt));

  $("#eligibleList").replaceChildren(
    eligible.length
      ? table(
          ["Candidate", "Job", "Skills", "Applied", ""],
          eligible.map(application =>
            h("tr", {},
              candidateCell(application),
              h("td", { text: application.job.title }),
              h("td", {}, skillChips(application.skills, 3)),
              h("td", { text: formatDate(application.createdAt) }),
              h("td", {}, actionButton("Schedule interview", "schedule", application.id, "btn-secondary"))
            )
          )
        )
      : stateBlock({
          type: "empty",
          title: "No candidates are ready to schedule.",
          message: "Shortlist candidates in the Candidates section to schedule interviews with them.",
          action: linkButton("#candidates", "Go to candidates", "btn-secondary")
        })
  );

  $("#upcomingList").replaceChildren(
    upcoming.length
      ? table(
          ["Candidate", "Job", "Date and time", "Format", "Status", ""],
          upcoming.map(application => {
            const interview = application.interview;

            return h("tr", {},
              candidateCell(application),
              h("td", { text: application.job.title }),
              h("td", {},
                h("div", { text: formatDateTime(interview.scheduledAt) }),
                h("div", { class: "cell-sub", text: `${interview.durationMinutes} minutes` })
              ),
              h("td", {},
                h("div", { text: LABELS.mode[interview.mode] }),
                interview.meetingDetails ? h("div", { class: "cell-sub", text: interview.meetingDetails }) : null
              ),
              h("td", {}, interviewSummary(application)),
              h("td", {},
                h("div", { class: "row-actions" },
                  actionButton("Reschedule", "reschedule", application.id),
                  actionButton("Mark completed", "complete", application.id),
                  actionButton("Cancel", "cancel-interview", application.id, "btn-ghost-danger")
                )
              )
            );
          })
        )
      : stateBlock({
          type: "empty",
          title: "No interviews scheduled.",
          message: "Scheduled interviews will appear here."
        })
  );
}

async function loadApplicationsInto(key, containers, render, retry) {
  const token = nextToken(key);
  containers.forEach(container => container.replaceChildren(stateBlock({ type: "loading" })));

  try {
    const { applications } = await api("/api/company/applications");
    if (!isCurrent(key, token)) return;

    state.applications = applications;
    render();
  } catch (error) {
    if (!isCurrent(key, token)) return;

    containers[0].replaceChildren(stateBlock({
      type: "error",
      title: "Couldn't load interview data.",
      message: error.message,
      action: retryButton(retry)
    }));
    containers.slice(1).forEach(container => container.replaceChildren());
  }
}

function loadInterviews() {
  return loadApplicationsInto("interviews", [$("#eligibleList"), $("#upcomingList")], renderInterviews, loadInterviews);
}

async function cancelInterview(application) {
  const confirmed = await confirmAction({
    title: `Cancel interview with ${application.candidate.name}?`,
    message: "The candidate will be moved back to Shortlisted.",
    confirmText: "Cancel interview"
  });
  if (!confirmed) return;

  try {
    const data = await api(`/api/company/applications/${application.id}/interview`, {
      method: "PATCH",
      body: { action: "cancel" }
    });
    showToast(data.message);
  } catch (error) {
    showToast(error.message, "error");
  }

  reloadCurrentRoute();
}

$("#eligibleList").addEventListener("click", event => {
  const button = event.target.closest("[data-action='schedule']");
  if (button) openSchedule(button.dataset.id);
});

$("#upcomingList").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const application = state.applications.find(item => item.id === button.dataset.id);
  if (!application) return;

  switch (button.dataset.action) {
    case "reschedule": return openSchedule(application.id);
    case "complete": return openComplete(application.id);
    case "cancel-interview": return cancelInterview(application);
  }
});

// ---------- Schedule dialog ----------

const scheduleForm = $("#scheduleForm");

function openSchedule(applicationId) {
  const application = state.applications.find(item => item.id === applicationId);
  if (!application) return;

  const existing = application.interview && application.interview.status === "scheduled"
    ? application.interview
    : null;

  state.scheduleTarget = application.id;
  scheduleForm.reset();
  markInvalid(scheduleForm, null);
  setAlert($("#scheduleMessage"), "");

  $("#scheduleTitle").textContent = existing ? "Reschedule interview" : "Schedule interview";
  $("#scheduleSubmit").textContent = existing ? "Reschedule" : "Schedule";
  $("#scheduleCandidate").textContent = `${application.candidate.name} · ${application.job.title}`;

  scheduleForm.elements.scheduledAt.min = toLocalInputValue(new Date());

  if (existing) {
    scheduleForm.elements.scheduledAt.value = toLocalInputValue(new Date(existing.scheduledAt));
    scheduleForm.elements.durationMinutes.value = String(existing.durationMinutes);
    scheduleForm.elements.mode.value = existing.mode;
    scheduleForm.elements.meetingDetails.value = existing.meetingDetails;
    scheduleForm.elements.notes.value = existing.notes;
  }

  openDialog($("#scheduleDialog"));
}

scheduleForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("#scheduleMessage");
  const submit = $("#scheduleSubmit");
  const when = scheduleForm.elements.scheduledAt.value ? new Date(scheduleForm.elements.scheduledAt.value) : null;

  if (!when || Number.isNaN(when.getTime())) {
    markInvalid(scheduleForm, scheduleForm.elements.scheduledAt);
    setAlert(message, "Please choose the interview date and time.");
    return;
  }

  if (when <= new Date()) {
    markInvalid(scheduleForm, scheduleForm.elements.scheduledAt);
    setAlert(message, "The interview must be scheduled in the future.");
    return;
  }

  markInvalid(scheduleForm, null);
  setAlert(message, "");
  setBusy(submit, true, "Saving…");

  try {
    const data = await api(`/api/company/applications/${state.scheduleTarget}/interview`, {
      method: "POST",
      body: {
        scheduledAt: when.toISOString(),
        durationMinutes: Number(scheduleForm.elements.durationMinutes.value),
        mode: scheduleForm.elements.mode.value,
        meetingDetails: scheduleForm.elements.meetingDetails.value.trim(),
        notes: scheduleForm.elements.notes.value.trim()
      }
    });

    $("#scheduleDialog").close();
    showToast(data.message);
    reloadCurrentRoute();
  } catch (error) {
    setAlert(message, error.message);
  } finally {
    setBusy(submit, false);
  }
});

// ---------- Complete dialog ----------

const completeForm = $("#completeForm");

function openComplete(applicationId) {
  const application = state.applications.find(item => item.id === applicationId);
  if (!application) return;

  state.completeTarget = application.id;
  completeForm.reset();
  setAlert($("#completeMessage"), "");
  $("#completeCandidate").textContent =
    `${application.candidate.name} · ${application.job.title} · ${formatDateTime(application.interview.scheduledAt)}`;

  openDialog($("#completeDialog"));
}

completeForm.addEventListener("submit", async event => {
  event.preventDefault();

  const submit = $("#completeSubmit");
  setBusy(submit, true, "Saving…");

  try {
    const data = await api(`/api/company/applications/${state.completeTarget}/interview`, {
      method: "PATCH",
      body: { action: "complete", feedback: completeForm.elements.feedback.value.trim() }
    });

    $("#completeDialog").close();
    showToast(data.message);
    reloadCurrentRoute();
  } catch (error) {
    setAlert($("#completeMessage"), error.message);
  } finally {
    setBusy(submit, false);
  }
});

// ---------- Interview results ----------

function renderResults() {
  const completed = state.applications
    .filter(application => application.interview && application.interview.status === "completed")
    .sort((a, b) => new Date(b.interview.completedAt) - new Date(a.interview.completedAt));

  if (!completed.length) {
    $("#resultsList").replaceChildren(stateBlock({
      type: "empty",
      title: "No completed interviews yet.",
      message: "When you mark an interview as completed, it appears here with your team's feedback.",
      action: linkButton("#interviews", "Go to interview management", "btn-secondary")
    }));
    return;
  }

  $("#resultsList").replaceChildren(table(
    ["Candidate", "Job", "Interview", "Feedback", "Decision"],
    completed.map(application => {
      const decided = FINAL_STATUSES.includes(application.status);

      return h("tr", {},
        candidateCell(application),
        h("td", { text: application.job.title }),
        h("td", {},
          h("div", { text: formatDateTime(application.interview.scheduledAt) }),
          h("div", { class: "cell-sub", text: LABELS.mode[application.interview.mode] })
        ),
        h("td", { class: "feedback-cell" },
          application.interview.feedback
            ? h("p", { class: "prewrap", text: application.interview.feedback })
            : h("span", { class: "muted", text: "No feedback recorded" })
        ),
        h("td", {},
          decided
            ? badge(application.status, LABELS.applicationStatus[application.status])
            : h("div", { class: "row-actions" },
                actionButton("Select", "select", application.id, "btn-secondary"),
                actionButton("Reject", "reject", application.id, "btn-ghost-danger")
              )
        )
      );
    })
  ));
}

function loadResults() {
  return loadApplicationsInto("results", [$("#resultsList")], renderResults, loadResults);
}

$("#resultsList").addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const application = state.applications.find(item => item.id === button.dataset.id);
  if (!application) return;

  const status = button.dataset.action === "select" ? "selected" : "rejected";

  const confirmed = await confirmAction({
    title: `Mark ${application.candidate.name} as ${LABELS.applicationStatus[status]}?`,
    message: `This records your hiring decision for "${application.job.title}". The candidate will see the updated status.`,
    confirmText: status === "selected" ? "Select candidate" : "Reject candidate",
    danger: status === "rejected"
  });
  if (!confirmed) return;

  try {
    const data = await api(`/api/company/applications/${application.id}/status`, {
      method: "PATCH",
      body: { status }
    });
    showToast(data.message);
  } catch (error) {
    showToast(error.message, "error");
  }

  loadResults();
});

// ---------- Settings ----------

const passwordForm = $("#passwordForm");

function resetSettings() {
  passwordForm.reset();
  markInvalid(passwordForm, null);
  setAlert($("#passwordMessage"), "");
  setAlert($("#sessionsMessage"), "");
}

passwordForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("#passwordMessage");
  const submit = $("#passwordSubmit");
  const values = {
    currentPassword: passwordForm.elements.currentPassword.value,
    newPassword: passwordForm.elements.newPassword.value,
    confirmPassword: passwordForm.elements.confirmPassword.value
  };

  const checks = [
    [!values.currentPassword, passwordForm.elements.currentPassword, "Please enter your current password."],
    [values.newPassword.length < 8 || values.newPassword.length > 72, passwordForm.elements.newPassword, "New password must be between 8 and 72 characters."],
    [values.newPassword !== values.confirmPassword, passwordForm.elements.confirmPassword, "New passwords do not match."]
  ];

  const failed = checks.find(([invalid]) => invalid);

  if (failed) {
    markInvalid(passwordForm, failed[1]);
    setAlert(message, failed[2]);
    return;
  }

  markInvalid(passwordForm, null);
  setAlert(message, "");
  setBusy(submit, true, "Updating…");

  try {
    const data = await api("/api/auth/change-password", { method: "POST", body: values });
    passwordForm.reset();
    setAlert(message, data.message, "success");
  } catch (error) {
    setAlert(message, error.message);
  } finally {
    setBusy(submit, false);
  }
});

$("#logoutOthers").addEventListener("click", async event => {
  const button = event.currentTarget;
  const message = $("#sessionsMessage");

  setBusy(button, true, "Signing out…");

  try {
    const data = await api("/api/auth/logout-others", { method: "POST" });
    setAlert(message, data.message, "success");
  } catch (error) {
    setAlert(message, error.message);
  } finally {
    setBusy(button, false);
  }
});

showView();
