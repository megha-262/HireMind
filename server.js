require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");
const studentRoutes = require("./routes/student");
const { apiErrorHandler } = require("./utils/validation");
const {
  DASHBOARDS,
  LOGIN_PAGES,
  isDatabaseReady,
  loadSession,
  requireAuth,
} = require("./middleware/auth");

const app = express();

// Pages are served by this same server, so same-origin requests need no
// CORS. Set CLIENT_ORIGIN (comma separated) only for a separate frontend.
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
  : false;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// Never serve backend source or project files as static assets.
app.use((req, res, next) => {
  const requestPath = safePath(req.path);

  if (
    /^\/(server\.js|package(-lock)?\.json|routes|models|middleware|utils|node_modules)(\/|$)/.test(
      requestPath
    )
  ) {
    return res.status(404).send("Not found");
  }

  next();
});

// Protected pages and the role allowed to open each one.
const PROTECTED_PAGES = {
  "/student-dashboard.html": "student",
  "/interview-setup.html": "student",
  "/interview-room.html": "student",
  "/company-dashboard.html": "recruiter",
};

const LOGIN_PAGE_PATHS = Object.values(LOGIN_PAGES);

function safePath(requestPath) {
  try {
    return decodeURIComponent(requestPath).toLowerCase();
  } catch {
    return requestPath.toLowerCase();
  }
}

app.use(async (req, res, next) => {
  const requestPath = safePath(req.path);
  const requiredRole = PROTECTED_PAGES[requestPath];
  const isLoginPage = LOGIN_PAGE_PATHS.includes(requestPath);

  if (!requiredRole && !isLoginPage) return next();

  if (!isDatabaseReady()) {
    if (isLoginPage) return next();
    return res
      .status(503)
      .send("HireMind is temporarily unavailable. Please try again shortly.");
  }

  await loadSession(req, res, () => {});

  if (isLoginPage) {
    // Already signed in: go straight to the right dashboard.
    if (req.user) return res.redirect(DASHBOARDS[req.user.role]);
    return next();
  }

  if (req.sessionError) {
    return res
      .status(503)
      .send("HireMind is temporarily unavailable. Please try again shortly.");
  }

  if (!req.user) {
    return res.redirect(LOGIN_PAGES[requiredRole]);
  }

  if (req.user.role !== requiredRole) {
    return res.redirect(DASHBOARDS[req.user.role]);
  }

  // Do not let the browser cache protected pages after logout.
  res.set("Cache-Control", "no-store");
  return res.sendFile(path.join(__dirname, requestPath), {
    cacheControl: false,
  });
});

app.use(express.static(__dirname, {
  dotfiles: "deny",
  index: false
}));

app.use("/api", (req, res, next) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      message: "Service temporarily unavailable. Please try again shortly.",
    });
  }

  next();
}, loadSession);

app.use("/api/auth", authRoutes);
app.use("/api/company", requireAuth("recruiter"), companyRoutes);
app.use("/api/student", requireAuth("student"), studentRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found." });
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/", (req, res) => {
  res.send("HireMind Backend is running!");
});

app.use(apiErrorHandler);

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.log("Retrying MongoDB connection in 5 seconds...");
    setTimeout(connectDatabase, 5000);
  }
}

function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to your .env file.");
    process.exit(1);
  }

  const PORT = process.env.PORT || 5000;

  // Start listening even if the database is down, so pages can show a
  // proper "unavailable" message instead of failing to connect.
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  connectDatabase();
}

startServer();
