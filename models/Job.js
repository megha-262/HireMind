const mongoose = require("mongoose");

const EXPERIENCE_LEVELS = ["internship", "entry", "mid", "senior", "lead"];
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "temporary"];
const WORKPLACE_TYPES = ["on_site", "remote", "hybrid"];
const JOB_STATUSES = ["open", "closed"];

const jobSchema = new mongoose.Schema(
  {
    // Owner company, always taken from the authenticated session
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    skills: {
      type: [String],
      default: [],
    },

    experienceLevel: {
      type: String,
      enum: EXPERIENCE_LEVELS,
      required: true,
    },

    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      required: true,
    },

    workplaceType: {
      type: String,
      enum: WORKPLACE_TYPES,
      required: true,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    vacancies: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },

    deadline: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: JOB_STATUSES,
      default: "open",
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

jobSchema.index({ company: 1, createdAt: -1 });
jobSchema.index({ status: 1, deadline: 1 });

const Job = mongoose.model("Job", jobSchema);

Job.EXPERIENCE_LEVELS = EXPERIENCE_LEVELS;
Job.EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
Job.WORKPLACE_TYPES = WORKPLACE_TYPES;
Job.JOB_STATUSES = JOB_STATUSES;

module.exports = Job;
