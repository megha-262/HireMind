const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/Recruiter");
const Session = require("../models/Session");
const {
  DASHBOARDS,
  createSession,
  destroySession,
  requireAuth,
} = require("../middleware/auth");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABELS = { student: "student", recruiter: "company" };

// Compared against when no user is found, so a missing account takes as
// long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("hiremind-dummy-password", 12);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    createdAt: user.createdAt,
  };
}

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
    } = req.body || {};

    if (
      !isNonEmptyString(fullName) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(role) ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (!["student", "recruiter"].includes(role)) {
      return res.status(400).json({
        message: "Please select a valid account type.",
      });
    }

    if (fullName.trim().length > 100) {
      return res.status(400).json({
        message: "Full name must be 100 characters or fewer.",
      });
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    if (password.length > 72) {
      return res.status(400).json({
        message: "Password must be 72 characters or fewer.",
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    if (role === "recruiter" && !isNonEmptyString(companyName)) {
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
      user: publicUser(user),
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
    const { email, password, role, remember } = req.body || {};

    if (!isNonEmptyString(email) || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (!["student", "recruiter"].includes(role)) {
      return res.status(400).json({
        message: "Please choose student or company login.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.passwordHash : DUMMY_HASH
    );

    if (!user || !passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Credentials are correct but belong to the other account type.
    if (user.role !== role) {
      const otherPage =
        user.role === "student" ? "Student Login" : "Company Login";

      return res.status(403).json({
        message: `This is a ${ROLE_LABELS[user.role]} account. Please sign in through the ${otherPage} page.`,
      });
    }

    await createSession(res, user, remember === true);

    return res.status(200).json({
      message: "Login successful!",
      user: publicUser(user),
      redirectTo: DASHBOARDS[user.role],
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
});

// Logout the current session
router.post("/logout", async (req, res) => {
  try {
    await destroySession(req, res);

    return res.status(200).json({
      message: "You have been signed out.",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    return res.status(500).json({
      message: "Logout failed. Please try again.",
    });
  }
});

// Change password (any signed-in account). Other sessions are signed out.
router.post("/change-password", requireAuth(), async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        message: "Please fill in all password fields.",
      });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({
        message: "New password must be between 8 and 72 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New passwords do not match.",
      });
    }

    const user = await User.findById(req.user._id).select("+passwordHash");

    // 400 rather than 401, so the client does not treat it as a lost session.
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({
        message: "Your current password is incorrect.",
      });
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({
        message: "Choose a new password that is different from your current one.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    await Session.deleteMany({ user: user._id, _id: { $ne: req.sessionId } });

    return res.status(200).json({
      message: "Password updated. Any other devices have been signed out.",
    });
  } catch (error) {
    console.error("Change password error:", error.message);

    return res.status(500).json({
      message: "Password could not be changed. Please try again.",
    });
  }
});

// Sign out every session except the current one
router.post("/logout-others", requireAuth(), async (req, res) => {
  try {
    const { deletedCount } = await Session.deleteMany({
      user: req.user._id,
      _id: { $ne: req.sessionId },
    });

    return res.status(200).json({
      message:
        deletedCount > 0
          ? `Signed out of ${deletedCount} other session${deletedCount === 1 ? "" : "s"}.`
          : "There were no other active sessions.",
    });
  } catch (error) {
    console.error("Logout others error:", error.message);

    return res.status(500).json({
      message: "Could not sign out other sessions. Please try again.",
    });
  }
});

// Current signed-in user
router.get("/me", requireAuth(), (req, res) => {
  return res.status(200).json({
    user: publicUser(req.user),
    redirectTo: DASHBOARDS[req.user.role],
  });
});

module.exports = router;
