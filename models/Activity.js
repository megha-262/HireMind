const mongoose = require("mongoose");

const ACTIVITY_TYPES = [
  "job_posted",
  "job_updated",
  "job_closed",
  "job_reopened",
  "job_deleted",
  "application_received",
  "application_status",
  "interview_scheduled",
  "interview_completed",
  "interview_cancelled",
  "profile_updated",
];

// Real events in a company's hiring workflow, shown as Recent Activity.
const activitySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "activities",
  }
);

activitySchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
