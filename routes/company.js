const express = require("express");
const User = require("../models/Recruiter");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Activity = require("../models/Activity");
const { logActivity } = require("../utils/activity");
const v = require("../utils/validation");

// Mounted behind requireAuth("recruiter"). Every query is scoped to
// req.user._id from the session; company IDs from the client are never used.
const router = express.Router();

const PIPELINE_STATUSES = ["applied", "under_review", "shortlisted", "interview_scheduled"];
const MANUAL_STATUSES = ["applied", "under_review", "shortlisted", "selected", "rejected"];

const STATUS_LABELS = {
  applied: "Applied",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected",
};

// ---------- Serializers ----------

function serializeProfile(user) {
  return {
    companyName: user.companyName,
    fullName: user.fullName,
    email: user.email,
    description: user.description || "",
    industry: user.industry || "",
    website: user.website || "",
    location: user.location || "",
    createdAt: user.createdAt,
  };
}

function serializeJob(job, applicationCount = 0) {
  return {
    id: job._id,
    title: job.title,
    description: job.description,
    skills: job.skills,
    experienceLevel: job.experienceLevel,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    location: job.location,
    vacancies: job.vacancies,
    deadline: job.deadline,
    status: job.status,
    closedAt: job.closedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    applicationCount,
  };
}

function serializeApplication(application) {
  const { student, job, interview } = application;

  return {
    id: application._id,
    status: application.status,
    skills: application.skills,
    coverNote: application.coverNote,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    candidate: student
      ? { name: student.fullName, email: student.email }
      : { name: "Deleted account", email: "" },
    job: job
      ? { id: job._id, title: job.title, status: job.status }
      : { id: null, title: "Deleted job", status: "closed" },
    interview: interview
      ? {
          scheduledAt: interview.scheduledAt,
          durationMinutes: interview.durationMinutes,
          mode: interview.mode,
          meetingDetails: interview.meetingDetails,
          notes: interview.notes,
          status: interview.status,
          feedback: interview.feedback,
          completedAt: interview.completedAt,
        }
      : null,
  };
}

function serializeActivity(activity) {
  return {
    id: activity._id,
    type: activity.type,
    message: activity.message,
    createdAt: activity.createdAt,
  };
}

// ---------- Helpers ----------

async function applicationCounts(companyId, jobIds) {
  const rows = await Application.aggregate([
    { $match: { company: companyId, job: { $in: jobIds } } },
    { $group: { _id: "$job", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function findOwnedJob(req, id) {
  if (!v.isObjectId(id)) return null;
  return Job.findOne({ _id: id, company: req.user._id });
}

function findOwnedApplication(req, id) {
  if (!v.isObjectId(id)) return null;
  return Application.findOne({ _id: id, company: req.user._id })
    .populate("student", "fullName email")
    .populate("job", "title status");
}

function parseJobInput(body = {}) {
  const title = v.requiredText(body.title, "Job title", 120);
  const employmentType = v.oneOf(body.employmentType, Job.EMPLOYMENT_TYPES, "employment type");
  const experienceLevel = v.oneOf(body.experienceLevel, Job.EXPERIENCE_LEVELS, "experience level");
  const workplaceType = v.oneOf(body.workplaceType, Job.WORKPLACE_TYPES, "workplace type");
  const location =
    workplaceType === "remote"
      ? v.optionalText(body.location, "Location", 150)
      : v.requiredText(body.location, "Location", 150);
  const vacancies = v.integer(body.vacancies, "Number of vacancies", 1, 1000);
  const deadline = v.futureDateOnly(body.deadline, "Application deadline");
  const skills = v.textList(body.skills, "Required skills", 20, 40);

  if (!skills.length) {
    throw new v.InputError("Add at least one required skill.");
  }

  const description = v.requiredText(body.description, "Job description", 5000);

  return {
    title,
    description,
    skills,
    experienceLevel,
    employmentType,
    workplaceType,
    location,
    vacancies,
    deadline,
  };
}

function notFound(res, what) {
  return res.status(404).json({ message: `${what} not found.` });
}

// ---------- Overview ----------

router.get("/overview", async (req, res) => {
  const company = req.user._id;
  const now = new Date();

  const [
    activeJobs,
    totalJobs,
    totalApplications,
    inPipeline,
    interviewsScheduled,
    recentJobs,
    recentActivity,
  ] = await Promise.all([
    Job.countDocuments({
      company,
      status: "open",
      $or: [{ deadline: null }, { deadline: { $gte: now } }],
    }),
    Job.countDocuments({ company }),
    Application.countDocuments({ company }),
    Application.countDocuments({ company, status: { $in: PIPELINE_STATUSES } }),
    Application.countDocuments({
      company,
      "interview.status": "scheduled",
      "interview.scheduledAt": { $gte: now },
    }),
    Job.find({ company }).sort({ createdAt: -1 }).limit(5),
    Activity.find({ company }).sort({ createdAt: -1 }).limit(8),
  ]);

  const counts = await applicationCounts(company, recentJobs.map((job) => job._id));

  return res.json({
    stats: {
      activeJobs,
      totalJobs,
      totalApplications,
      inPipeline,
      interviewsScheduled,
    },
    recentJobs: recentJobs.map((job) =>
      serializeJob(job, counts.get(String(job._id)) || 0)
    ),
    recentActivity: recentActivity.map(serializeActivity),
  });
});

// ---------- Company profile ----------

router.get("/profile", (req, res) => {
  return res.json({ profile: serializeProfile(req.user) });
});

router.patch("/profile", async (req, res) => {
  const body = req.body || {};

  const updates = {
    companyName: v.requiredText(body.companyName, "Company name", 100),
    fullName: v.requiredText(body.fullName, "Contact person", 100),
    industry: v.optionalText(body.industry, "Industry", 100),
    location: v.optionalText(body.location, "Location", 150),
    website: v.websiteUrl(body.website),
    description: v.optionalText(body.description, "Company description", 2000),
  };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  await logActivity(req.user._id, "profile_updated", "Company profile updated");

  return res.json({
    message: "Company profile saved.",
    profile: serializeProfile(user),
  });
});

// ---------- Jobs ----------

router.get("/jobs", async (req, res) => {
  const filter = { company: req.user._id };

  if (req.query.status) {
    filter.status = v.oneOf(req.query.status, Job.JOB_STATUSES, "job status");
  }

  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(500);
  const counts = await applicationCounts(req.user._id, jobs.map((job) => job._id));

  return res.json({
    jobs: jobs.map((job) => serializeJob(job, counts.get(String(job._id)) || 0)),
  });
});

router.post("/jobs", async (req, res) => {
  const input = parseJobInput(req.body);

  const job = await Job.create({
    ...input,
    company: req.user._id,
  });

  await logActivity(req.user._id, "job_posted", `Posted job "${job.title}"`);

  return res.status(201).json({
    message: "Job posted successfully.",
    job: serializeJob(job),
  });
});

router.get("/jobs/:id", async (req, res) => {
  const job = await findOwnedJob(req, req.params.id);
  if (!job) return notFound(res, "Job");

  const rows = await Application.aggregate([
    { $match: { company: req.user._id, job: job._id } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return res.json({
    job: serializeJob(job, total),
    applicationsByStatus: byStatus,
  });
});

router.put("/jobs/:id", async (req, res) => {
  const job = await findOwnedJob(req, req.params.id);
  if (!job) return notFound(res, "Job");

  const input = parseJobInput(req.body);

  job.set(input);
  await job.save();

  await logActivity(req.user._id, "job_updated", `Updated job "${job.title}"`);

  const counts = await applicationCounts(req.user._id, [job._id]);

  return res.json({
    message: "Job updated successfully.",
    job: serializeJob(job, counts.get(String(job._id)) || 0),
  });
});

router.patch("/jobs/:id/status", async (req, res) => {
  const job = await findOwnedJob(req, req.params.id);
  if (!job) return notFound(res, "Job");

  const status = v.oneOf((req.body || {}).status, Job.JOB_STATUSES, "job status");

  if (job.status !== status) {
    job.status = status;
    job.closedAt = status === "closed" ? new Date() : null;
    await job.save();

    await logActivity(
      req.user._id,
      status === "closed" ? "job_closed" : "job_reopened",
      `${status === "closed" ? "Closed" : "Reopened"} job "${job.title}"`
    );
  }

  const counts = await applicationCounts(req.user._id, [job._id]);

  return res.json({
    message: status === "closed" ? "Job closed." : "Job reopened.",
    job: serializeJob(job, counts.get(String(job._id)) || 0),
  });
});

router.delete("/jobs/:id", async (req, res) => {
  const job = await findOwnedJob(req, req.params.id);
  if (!job) return notFound(res, "Job");

  // Never silently delete candidates' applications.
  const applications = await Application.countDocuments({ job: job._id });

  if (applications > 0) {
    return res.status(409).json({
      message: `This job has ${applications} application${applications === 1 ? "" : "s"}. Close the job instead of deleting it.`,
    });
  }

  await job.deleteOne();
  await logActivity(req.user._id, "job_deleted", `Deleted job "${job.title}"`);

  return res.json({ message: "Job deleted." });
});

// ---------- Applications / candidates ----------

router.get("/applications", async (req, res) => {
  const filter = { company: req.user._id };

  if (req.query.job) {
    if (!v.isObjectId(req.query.job)) {
      throw new v.InputError("Please choose a valid job.");
    }
    filter.job = req.query.job;
  }

  if (req.query.status) {
    filter.status = v.oneOf(req.query.status, Application.APPLICATION_STATUSES, "status");
  }

  const applications = await Application.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("student", "fullName email")
    .populate("job", "title status");

  let results = applications.map(serializeApplication);

  const query = v.optionalText(req.query.q, "Search", 100).toLowerCase();

  if (query) {
    results = results.filter((application) =>
      [
        application.candidate.name,
        application.candidate.email,
        application.job.title,
        ...application.skills,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }

  return res.json({ applications: results });
});

router.patch("/applications/:id/status", async (req, res) => {
  const application = await findOwnedApplication(req, req.params.id);
  if (!application) return notFound(res, "Application");

  const status = v.oneOf(
    (req.body || {}).status,
    MANUAL_STATUSES,
    "status (use Schedule interview to schedule)"
  );

  let interviewCancelled = false;

  // Moving a candidate on cancels any interview still pending.
  if (application.interview && application.interview.status === "scheduled") {
    application.interview.status = "cancelled";
    interviewCancelled = true;
  }

  application.status = status;
  await application.save();

  await logActivity(
    req.user._id,
    "application_status",
    `${application.student ? application.student.fullName : "A candidate"} moved to ${STATUS_LABELS[status]} for "${application.job ? application.job.title : "a deleted job"}"`
  );

  return res.json({
    message: interviewCancelled
      ? "Status updated. The scheduled interview was cancelled."
      : "Status updated.",
    application: serializeApplication(application),
  });
});

// ---------- Interviews ----------

router.post("/applications/:id/interview", async (req, res) => {
  const application = await findOwnedApplication(req, req.params.id);
  if (!application) return notFound(res, "Application");

  if (["selected", "rejected"].includes(application.status)) {
    return res.status(409).json({
      message: "Interviews can't be scheduled for candidates who have already been selected or rejected.",
    });
  }

  const body = req.body || {};
  const rescheduling =
    application.interview && application.interview.status === "scheduled";

  application.interview = {
    scheduledAt: v.futureDateTime(body.scheduledAt, "Interview date and time", 365),
    durationMinutes: v.integer(body.durationMinutes, "Duration", 15, 240),
    mode: v.oneOf(body.mode, Application.INTERVIEW_MODES, "interview format"),
    meetingDetails: v.optionalText(body.meetingDetails, "Meeting details", 300),
    notes: v.optionalText(body.notes, "Internal notes", 1000),
    status: "scheduled",
    feedback: "",
    completedAt: null,
  };
  application.status = "interview_scheduled";
  await application.save();

  await logActivity(
    req.user._id,
    "interview_scheduled",
    `Interview ${rescheduling ? "rescheduled" : "scheduled"} with ${application.student ? application.student.fullName : "a candidate"} for "${application.job ? application.job.title : "a deleted job"}"`
  );

  return res.json({
    message: rescheduling ? "Interview rescheduled." : "Interview scheduled.",
    application: serializeApplication(application),
  });
});

router.patch("/applications/:id/interview", async (req, res) => {
  const application = await findOwnedApplication(req, req.params.id);
  if (!application) return notFound(res, "Application");

  if (!application.interview || application.interview.status !== "scheduled") {
    return res.status(409).json({
      message: "There is no scheduled interview for this candidate.",
    });
  }

  const body = req.body || {};
  const action = v.oneOf(body.action, ["complete", "cancel"], "action");
  const name = application.student ? application.student.fullName : "a candidate";

  if (action === "complete") {
    application.interview.status = "completed";
    application.interview.completedAt = new Date();
    application.interview.feedback = v.optionalText(body.feedback, "Feedback", 2000);
  } else {
    application.interview.status = "cancelled";
    application.status = "shortlisted";
  }

  await application.save();

  await logActivity(
    req.user._id,
    action === "complete" ? "interview_completed" : "interview_cancelled",
    `Interview with ${name} ${action === "complete" ? "marked as completed" : "cancelled"}`
  );

  return res.json({
    message: action === "complete" ? "Interview marked as completed." : "Interview cancelled.",
    application: serializeApplication(application),
  });
});

module.exports = router;
