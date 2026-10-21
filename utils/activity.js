const Activity = require("../models/Activity");

// Records a hiring event for a company. A logging failure never fails the
// request that triggered it.
async function logActivity(companyId, type, message) {
  try {
    await Activity.create({
      company: companyId,
      type,
      message: message.slice(0, 300),
    });
  } catch (error) {
    console.error("Activity log error:", error.message);
  }
}

module.exports = { logActivity };
