const nodemailer = require("nodemailer");
const {
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  termsChapters,
  privacyPolicySections,
} = require("../../content/signupLegalContent");

const getFrontendBaseUrl = () =>
  (
    process.env.FRONTEND_BASE_URL ||
    process.env.WEB_BASE_URL ||
    process.env.APP_BASE_URL ||
    "https://mejoric.com"
  ).replace(/\/$/, "");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDisplayName = (name = "") => {
  const trimmed = String(name).trim();
  if (!trimmed) return "User";
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildPrivacyPolicyHtml = () =>
  privacyPolicySections
    .map((section) => {
      const paragraphs = (section.paragraphs || [])
        .map(
          (paragraph) =>
            `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.7; color: #444;">${escapeHtml(paragraph)}</p>`,
        )
        .join("");

      const listItems = (section.listItems || []).length
        ? `<ul style="margin: 0 0 12px 20px; padding: 0; color: #444; font-size: 14px; line-height: 1.7;">${section.listItems
            .map((item) => `<li style="margin-bottom: 8px;">${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "";

      const footer = section.footer
        ? `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.7; color: #444;">${escapeHtml(section.footer)}</p>`
        : "";

      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px; font-size: 16px; color: #5b21b6;">
            ${escapeHtml(section.num)}. ${escapeHtml(section.title)}
          </h3>
          <p style="margin: 0 0 12px; font-size: 12px; color: #7c3aed; font-weight: bold;">
            ${escapeHtml(section.clause)}
          </p>
          ${paragraphs}
          ${listItems}
          ${footer}
        </div>
      `;
    })
    .join("");

const buildTermsChaptersHtml = () =>
  `<ol style="margin: 0; padding-left: 20px; color: #444; font-size: 14px; line-height: 1.8;">${termsChapters
    .map(
      (chapter) =>
        `<li style="margin-bottom: 8px;"><strong>Chapter ${escapeHtml(chapter.num)}:</strong> ${escapeHtml(chapter.title)}</li>`,
    )
    .join("")}</ol>`;

const buildSignupAgreementHtml = ({ name, email, agreedAt }) => {
  const baseUrl = getFrontendBaseUrl();
  const termsUrl = `${baseUrl}/terms-and-conditions`;
  const privacyUrl = `${baseUrl}/privacy-policy`;
  const displayName = formatDisplayName(name);
  const agreementDate = new Date(agreedAt).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  return `
    <div style="max-width: 720px; margin: auto; padding: 32px 24px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
      <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #9333ea); padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Welcome to Mejoric</h1>
          <p style="margin: 10px 0 0; color: #ede9fe; font-size: 14px;">Account registration and legal agreement confirmation</p>
        </div>

        <div style="padding: 28px 24px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #333;">Dear ${escapeHtml(displayName)},</p>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
            Thank you for creating your Mejoric account. This email confirms that on
            <strong>${escapeHtml(agreementDate)}</strong> you agreed to our
            <strong>Terms and Conditions</strong> and <strong>Privacy Policy</strong>
            while signing up with <strong>${escapeHtml(email)}</strong>.
          </p>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #444;">
            Please keep this email for your records. You can also review the latest versions online at any time:
          </p>

          <div style="margin-bottom: 28px;">
            <a href="${termsUrl}" style="display: inline-block; margin-right: 12px; margin-bottom: 12px; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: bold;">
              View Terms &amp; Conditions
            </a>
            <a href="${privacyUrl}" style="display: inline-block; margin-bottom: 12px; background: #ffffff; color: #7c3aed; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: bold; border: 1px solid #c4b5fd;">
              View Privacy Policy
            </a>
          </div>

          <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 20px; margin-bottom: 28px;">
            <h2 style="margin: 0 0 10px; font-size: 18px; color: #5b21b6;">Agreement Summary</h2>
            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #444;">
              Document version: <strong>${escapeHtml(TERMS_VERSION)}</strong><br>
              Effective date: <strong>${escapeHtml(TERMS_EFFECTIVE_DATE)}</strong><br>
              Registered email: <strong>${escapeHtml(email)}</strong>
            </p>
          </div>

          <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Privacy Policy</h2>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: #666;">
            Chapter 9 — Data Privacy and Confidentiality from the Mejoric User Terms
            (Version ${escapeHtml(TERMS_VERSION)}, effective ${escapeHtml(TERMS_EFFECTIVE_DATE)}).
          </p>
          ${buildPrivacyPolicyHtml()}

          <h2 style="margin: 32px 0 16px; font-size: 20px; color: #111827;">Terms and Conditions</h2>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: #666;">
            Below is the table of contents for the Mejoric Terms and Conditions you agreed to.
            The full document is available here:
            <a href="${termsUrl}" style="color: #7c3aed;">${termsUrl}</a>
          </p>
          ${buildTermsChaptersHtml()}
        </div>

        <div style="padding: 20px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9ca3af; text-align: center;">
            © ${new Date().getFullYear()} Mejoric Private Limited. All rights reserved.<br>
            If you did not create this account, please contact us immediately.
          </p>
        </div>
      </div>
    </div>
  `;
};

exports.sendSignupAgreementMail = async ({ email, name, agreedAt = new Date() }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });

  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: email,
    subject: "Your Mejoric Account — Terms & Privacy Policy Agreement",
    html: buildSignupAgreementHtml({ name, email, agreedAt }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Signup agreement email sent to ${email}:`, info.response);
    return { success: true, message: info.response };
  } catch (error) {
    console.error("Error sending signup agreement email:", error);
    return { success: false, error };
  }
};
