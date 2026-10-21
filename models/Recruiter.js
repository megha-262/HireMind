const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "recruiter"],
      required: true,
    },

    companyName: {
      type: String,
      trim: true,
      default: "",
    },

    // Optional company profile details (recruiter accounts only)
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    industry: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    website: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 150,
    },
  },
  {
    timestamps: true,
    collection: "login",
  }
);

module.exports = mongoose.model("User", userSchema);