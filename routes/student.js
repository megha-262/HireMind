const express = require("express");
const Job = require("../models/Job");
const Application = require("../models/Application");
const { logActivity } = require("../utils/activity");
const v = require("../utils/validation");

// Mounted behind requireAuth("student"). Students only see open jobs and
// their own applications; company-internal notes are never returned.
const router = express.Router();

function openJobFilter() {
  return {
    status: "open",
    $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
  };
}

function serializePublicJob(job, applied) {
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
    createdAt: job.createdAt,
    company: {
      name: job.company.companyName,
      industry: job.company.industry || "",
      website: job.company.website || "",
    },
    applied,
  };
}

router.get("/jobs", async (req, res) => {
  const jobs = (
    await Job.find(openJobFilter())
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("company", "companyName industry website")
  ).filter((job) => job.company);

  const appliedJobIds = new Set(
    (
      await Application.find({
        student: req.user._id,
        job: { $in: jobs.map((job) => job._id) },
      }).distinct("job")
    ).map(String)
  );

  return res.json({
    jobs: jobs.map((job) => serializePublicJob(job, appliedJobIds.has(String(job._id)))),
  });
});

router.post("/jobs/:id/apply", async (req, res) => {
  if (!v.isObjectId(req.params.id)) {
    return res.status(404).json({ message: "Job not found." });
  }

  const job = await Job.findOne({ _id: req.params.id, ...openJobFilter() });

  if (!job) {
    return res.status(404).json({
      message: "This job is no longer accepting applications.",
    });
  }

  const body = req.body || {};

  try {
    await Application.create({
      job: job._id,
      company: job.company,
      student: req.user._id,
      skills: v.textList(body.skills, "Skills", 20, 40),
      coverNote: v.optionalText(body.coverNote, "Cover note", 1000),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already applied for this job.",
      });
    }
    throw error;
  }

  await logActivity(
    job.company,
    "application_received",
    `New application from ${req.user.fullName} for "${job.title}"`
  );

  return res.status(201).json({ message: "Application submitted." });
});

router.get("/applications", async (req, res) => {
  const applications = await Application.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({
      path: "job",
      select: "title status company",
      populate: { path: "company", select: "companyName" },
    });

  return res.json({
    applications: applications.map((application) => {
      const { job, interview } = application;

      return {
        id: application._id,
        status: application.status,
        createdAt: application.createdAt,
        job: {
          title: job ? job.title : "Job no longer available",
          companyName: job && job.company ? job.company.companyName : "",
        },
        // Only candidate-facing interview details (no internal notes/feedback)
        interview: interview
          ? {
              scheduledAt: interview.scheduledAt,
              durationMinutes: interview.durationMinutes,
              mode: interview.mode,
              meetingDetails: interview.meetingDetails,
              status: interview.status,
            }
          : null,
      };
    }),
  });
});

module.exports = router;
