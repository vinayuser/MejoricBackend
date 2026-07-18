const { createMailTransporter } = require("./createTransporter");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function appBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.APP_URL ||
    "https://mejoric.com"
  ).replace(/\/$/, "");
}

function buildEmailShell({ title, subtitle, bodyHtml }) {
  return `
    <div style="max-width: 640px; margin: auto; padding: 24px; font-family: Arial, sans-serif; background-color: #f7f7f5;">
      <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e3dcf0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c6ba8, #5f4f86); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px;">${escapeHtml(title)}</h1>
          ${subtitle ? `<p style="margin: 10px 0 0; color: #e3dcf0; font-size: 14px;">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div style="padding: 24px;">${bodyHtml}</div>
        <div style="padding: 16px 24px; background: #f4f1fa; border-top: 1px solid #e3dcf0;">
          <p style="margin: 0; font-size: 12px; color: #808080; text-align: center;">
            © ${new Date().getFullYear()} Mejoric. Join only from your Mejoric account — meeting access is verified against your enrollment.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendMail({ to, subject, html }) {
  const transporter = createMailTransporter();
  if (!transporter) {
    console.warn("⚠️ Therapy email skipped — NODEMAILER credentials not configured");
    return { success: false, skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, message: info.response };
  } catch (error) {
    console.error(`Error sending therapy email to ${to}:`, error);
    return { success: false, error };
  }
}

/**
 * Confirmation email with platform join links (purchase-gated).
 * Never emails a raw public Zoom link as the primary CTA.
 */
exports.sendTherapyEnrollmentEmail = async ({
  userEmail,
  userName,
  cohortTheme,
  amountPaid,
  enrollmentId,
  slots = [],
}) => {
  const base = appBaseUrl();
  const slotRows = slots
    .map((slot) => {
      const when = new Date(slot.scheduledAt).toLocaleString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      const joinUrl = `${base}/therapy-session/${enrollmentId}?slot=${slot._id || slot.id}`;
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e3dcf0;">
            <div style="font-weight: 600; color: #0c0c0c;">${escapeHtml(slot.label || "Session")}</div>
            <div style="font-size: 13px; color: #5a5a5a; margin-top: 4px;">${escapeHtml(when)} IST</div>
            <a href="${escapeHtml(joinUrl)}" style="display: inline-block; margin-top: 10px; background: #7c6ba8; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;">
              Join from Mejoric
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = buildEmailShell({
    title: "Group therapy enrollment confirmed",
    subtitle: cohortTheme,
    bodyHtml: `
      <p style="font-size: 15px; color: #333;">Hi ${escapeHtml(userName || "there")},</p>
      <p style="font-size: 14px; color: #555; line-height: 1.6;">
        Your seat in <strong>${escapeHtml(cohortTheme)}</strong> is confirmed
        (₹${escapeHtml(String(amountPaid))}). Sessions open only for enrolled members —
        please join from Mejoric while logged in.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${slotRows || "<tr><td>Session schedule will be shared soon.</td></tr>"}
      </table>
      <p style="font-size: 12px; color: #808080; margin-top: 20px;">
        Do not share join links. Access is checked against your purchase on every join.
      </p>
    `,
  });

  return sendMail({
    to: userEmail,
    subject: `Enrolled: ${cohortTheme} — Mejoric Group Therapy`,
    html,
  });
};
