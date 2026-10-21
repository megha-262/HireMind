const mongoose = require("mongoose");

const APPLICATION_STATUSES = [
  "applied",
  "under_review",
  "shortlisted",
  "interview_scheduled",
  "selected",
  "rejected",
];

const INTERVIEW_MODES = ["video", "phone", "in_person"];
const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled"];

// One interview per application, scheduled by the company.
const interviewSchema = new mongoose.Schema(
  {
    scheduledAt: {
      type: Date,
      required: true,
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
      max: 240,
    },

    mode: {
      type: String,
      enum: INTERVIEW_MODES,
      required: true,
    },

    // Shared with the candidate (meeting link, address, or phone details)
    meetingDetails: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    // Internal to the company
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: "scheduled",
    },

    // Internal interviewer feedback recorded on completion
    feedback: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // Copied from the job so every company query can be scoped by owner
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    skills: {
      type: [String],
      default: [],
    },

    coverNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "applied",
    },

    interview: {
      type: interviewSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "applications",
  }
);

applicationSchema.index({ job: 1, student: 1 }, { unique: true });
applicationSchema.index({ company: 1, createdAt: -1 });
applicationSchema.index({ student: 1, createdAt: -1 });

const Application = mongoose.model("Application", applicationSchema);

Application.APPLICATION_STATUSES = APPLICATION_STATUSES;
Application.INTERVIEW_MODES = INTERVIEW_MODES;
Application.INTERVIEW_STATUSES = INTERVIEW_STATUSES;

module.exports = Application;
