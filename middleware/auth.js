const crypto = require("crypto");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const User = require("../models/Recruiter");

const SESSION_COOKIE = "hm_session";
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const REMEMBER_SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const DASHBOARDS = {
  student: "/student-dashboard.html",
  recruiter: "/company-dashboard.html",
};

const LOGIN_PAGES = {
  student: "/index.html",
  recruiter: "/company-login.html",
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(header = "") {
  const cookies = {};

  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  });

  return cookies;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

async function createSession(res, user, remember) {
  const token = crypto.randomBytes(32).toString("base64url");
  const lifetime = remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS;

  await Session.create({
    tokenHash: hashToken(token),
    user: user._id,
    role: user.role,
    expiresAt: new Date(Date.now() + lifetime),
  });

  // Without "remember me" the cookie is dropped when the browser closes.
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    ...(remember ? { maxAge: lifetime } : {}),
  });
}

async function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];

  if (token) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }

  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Attaches req.user when the request carries a valid session cookie.
async function loadSession(req, res, next) {
  req.user = null;

  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return next();

  try {
    const session = await Session.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });

    if (session) {
      const user = await User.findById(session.user);

      if (user && user.role === session.role) {
        req.user = user;
        req.sessionId = session._id;
      }
    }

    next();
  } catch (error) {
    console.error("Session lookup error:", error.message);
    req.sessionError = true;
    next();
  }
}

function requireAuth(role) {
  return (req, res, next) => {
    if (req.sessionError) {
      return res.status(503).json({
        message: "Service temporarily unavailable. Please try again.",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Please sign in to continue.",
      });
    }

    if (role && req.user.role !== role) {
      return res.status(403).json({
        message: "You do not have access to this resource.",
      });
    }

    next();
  };
}

module.exports = {
  DASHBOARDS,
  LOGIN_PAGES,
  createSession,
  destroySession,
  isDatabaseReady,
  loadSession,
  requireAuth,
};
