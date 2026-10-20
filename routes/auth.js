const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/Recruiter");

const router = express.Router();

// Register Student or Recruiter
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      role,
      password,
      confirmPassword,
      companyName,
    } = req.body;

    if (!fullName || !email || !role || !password) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (!["student", "recruiter"].includes(role)) {
      return res.status(400).json({
        message: "Please select a valid account type.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    if (role === "recruiter" && !companyName?.trim()) {
      return res.status(400).json({
        message: "Company name is required for recruiters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      companyName:
        role === "recruiter" ? companyName.trim() : "",
    });

    return res.status(201).json({
      message: "Account created successfully!",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});

// Login Student or Recruiter
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (
      !user ||
      (role && user.role !== role) ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      message: "Login successful!",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
});

module.exports = router;