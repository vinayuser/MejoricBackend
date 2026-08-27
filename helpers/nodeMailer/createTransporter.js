const nodemailer = require("nodemailer");

function getMailCredentials() {
  const user = String(process.env.NODEMAILER_EMAIL || "")
    .split("#")[0]
    .trim();
  const pass = String(process.env.NODEMAILER_PASSWORD || "")
    .split("#")[0]
    .trim();
  return { user, pass };
}

function createMailTransporter() {
  const { user, pass } = getMailCredentials();
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

module.exports = { createMailTransporter, getMailCredentials };
