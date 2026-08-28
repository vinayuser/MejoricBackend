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

let cachedTransporter = null;
let cachedCredentialsKey = "";

function createMailTransporter() {
  const { user, pass } = getMailCredentials();
  if (!user || !pass) return null;

  const credentialsKey = `${user}:${pass}`;
  if (cachedTransporter && cachedCredentialsKey === credentialsKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    tls: { rejectUnauthorized: false },
  });
  cachedCredentialsKey = credentialsKey;
  return cachedTransporter;
}

module.exports = { createMailTransporter, getMailCredentials };
