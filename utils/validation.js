// Small server-side input validators shared by the API routes.
// Each throws an InputError (HTTP 400) with a user-friendly message.

class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isObjectId(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

function optionalText(value, label, max) {
  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    throw new InputError(`${label} must be text.`);
  }

  const text = value.trim();

  if (text.length > max) {
    throw new InputError(`${label} must be ${max} characters or fewer.`);
  }

  return text;
}

function requiredText(value, label, max) {
  const text = optionalText(value, label, max);

  if (!text) {
    throw new InputError(`${label} is required.`);
  }

  return text;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new InputError(`Please choose a valid ${label}.`);
  }

  return value;
}

function integer(value, label, min, max) {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new InputError(
      `${label} must be a whole number between ${min} and ${max}.`
    );
  }

  return number;
}

// Accepts an array or a comma-separated string; trims and removes duplicates.
function textList(value, label, maxItems, maxLength) {
  let items;

  if (value === undefined || value === null) items = [];
  else if (Array.isArray(value)) items = value;
  else if (typeof value === "string") items = value.split(",");
  else throw new InputError(`${label} must be a list.`);

  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (typeof item !== "string") {
      throw new InputError(`${label} must be text.`);
    }

    const text = item.trim();
    if (!text) continue;

    if (text.length > maxLength) {
      throw new InputError(
        `Each item in ${label.toLowerCase()} must be ${maxLength} characters or fewer.`
      );
    }

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  if (result.length > maxItems) {
    throw new InputError(`${label} can contain at most ${maxItems} items.`);
  }

  return result;
}

// Only http(s) addresses, so a stored website can never be a javascript: URL.
function websiteUrl(value) {
  const text = optionalText(value, "Website", 200);
  if (!text) return "";

  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  let url;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new InputError("Please enter a valid website address.");
  }

  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
    throw new InputError("Please enter a valid website address.");
  }

  return url.href;
}

// A YYYY-MM-DD date that is today or later (UTC); stored as the end of that day.
function futureDateOnly(value, label) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new InputError(`Please enter a valid ${label.toLowerCase()}.`);
  }

  const start = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) {
    throw new InputError(`Please enter a valid ${label.toLowerCase()}.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  if (value < today) {
    throw new InputError(`${label} cannot be in the past.`);
  }

  return new Date(`${value}T23:59:59.999Z`);
}

function futureDateTime(value, label, maxDaysAhead) {
  const date = typeof value === "string" ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    throw new InputError(`Please choose a valid ${label.toLowerCase()}.`);
  }

  const now = Date.now();

  if (date.getTime() <= now) {
    throw new InputError(`${label} must be in the future.`);
  }

  if (date.getTime() > now + maxDaysAhead * 24 * 60 * 60 * 1000) {
    throw new InputError(`${label} must be within the next ${maxDaysAhead} days.`);
  }

  return date;
}

// Final error handler for JSON APIs.
function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof InputError) {
    return res.status(400).json({ message: error.message });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "The request body is not valid JSON." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "The request is too large." });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ message: "Please check the submitted details." });
  }

  console.error("API error:", error.message);

  return res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
}

module.exports = {
  InputError,
  apiErrorHandler,
  futureDateOnly,
  futureDateTime,
  integer,
  isObjectId,
  oneOf,
  optionalText,
  requiredText,
  textList,
  websiteUrl,
};
