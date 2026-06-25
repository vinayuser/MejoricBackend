const { createMailTransporter } = require("./createTransporter");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatSessionDateTime(scheduledAt, slotLabel) {
  const date = new Date(scheduledAt);
  const datePart = date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `${datePart} at ${slotLabel} (IST)`;
}

function buildEmailShell({ title, subtitle, bodyHtml }) {
  return `
    <div style="max-width: 640px; margin: auto; padding: 24px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
      <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #9333ea); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px;">${escapeHtml(title)}</h1>
          ${subtitle ? `<p style="margin: 10px 0 0; color: #ede9fe; font-size: 14px;">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div style="padding: 24px;">
          ${bodyHtml}
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
            © ${new Date().getFullYear()} Mejoric. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildMeetingDetailsHtml({ meetingId, password, joinUrl, startUrl, forMentor }) {
  const link = forMentor ? startUrl : joinUrl;
  const linkLabel = forMentor ? "Start meeting as host" : "Join meeting as participant";
  const roleNote = forMentor
    ? "You will join as the meeting host."
    : "You will join as a participant.";

  return `
    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px; font-size: 16px; color: #5b21b6;">Zoom meeting details</h3>
      <p style="margin: 0 0 12px; font-size: 13px; color: #666;">${roleNote}</p>
      ${meetingId ? `<p style="margin: 0 0 8px; font-size: 14px; color: #444;"><strong>Meeting ID:</strong> ${escapeHtml(meetingId)}</p>` : ""}
      ${password ? `<p style="margin: 0 0 8px; font-size: 14px; color: #444;"><strong>Passcode:</strong> ${escapeHtml(password)}</p>` : ""}
      ${link ? `<p style="margin: 12px 0 0;"><a href="${escapeHtml(link)}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: bold;">${linkLabel}</a></p>` : ""}
    </div>
  `;
}

function buildGuestDetailsHtml(guestDetails) {
  const rows = [
    ["Name", guestDetails.fullName],
    ["Email", guestDetails.email],
    ["Phone", guestDetails.phone],
    ["Gender", guestDetails.gender],
    ["Age", guestDetails.age],
    ["Budget", guestDetails.budget],
    ["Support needs", guestDetails.supportNeeds],
  ].filter(([, value]) => value);

  return `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px; font-size: 16px; color: #0f172a;">Client details</h3>
      ${rows
        .map(
          ([label, value]) =>
            `<p style="margin: 0 0 8px; font-size: 14px; color: #444;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
        )
        .join("")}
    </div>
  `;
}

async function sendMail({ to, subject, html }) {
  const transporter = createMailTransporter();
  if (!transporter) {
    console.warn("⚠️ Booking email skipped — NODEMAILER credentials not configured");
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
    console.error(`Error sending booking email to ${to}:`, error);
    return { success: false, error };
  }
}

exports.sendBookingConfirmationToUser = async ({
  userEmail,
  userName,
  mentorName,
  scheduledAt,
  slotLabel,
  zoomMeetingId,
  zoomPassword,
  zoomJoinUrl,
}) => {
  const sessionTime = formatSessionDateTime(scheduledAt, slotLabel);
  const html = buildEmailShell({
    title: "Your mentor session is confirmed",
    subtitle: "Mejoric appointment booking",
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #444;">Dear ${escapeHtml(userName)},</p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        Your appointment with <strong>${escapeHtml(mentorName)}</strong> has been scheduled.
      </p>
      <p style="margin: 0 0 8px; font-size: 15px; color: #444;"><strong>Date & time:</strong> ${escapeHtml(sessionTime)}</p>
      <p style="margin: 0 0 8px; font-size: 15px; color: #444;"><strong>Duration:</strong> 30 minutes</p>
      ${buildMeetingDetailsHtml({
        meetingId: zoomMeetingId,
        password: zoomPassword,
        joinUrl: zoomJoinUrl,
        forMentor: false,
      })}
      <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #666;">
        You will receive reminder emails 30 minutes and 5 minutes before your session.
      </p>
    `,
  });

  return sendMail({
    to: userEmail,
    subject: `Mejoric — Session confirmed with ${mentorName}`,
    html,
  });
};

exports.sendBookingConfirmationToMentor = async ({
  mentorEmail,
  mentorName,
  guestDetails,
  scheduledAt,
  slotLabel,
  zoomMeetingId,
  zoomPassword,
  zoomStartUrl,
  zoomJoinUrl,
}) => {
  const sessionTime = formatSessionDateTime(scheduledAt, slotLabel);
  const html = buildEmailShell({
    title: "New appointment booked",
    subtitle: "A client has scheduled a session with you",
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #444;">Dear ${escapeHtml(mentorName)},</p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        You have a new upcoming mentor session on Mejoric.
      </p>
      <p style="margin: 0 0 8px; font-size: 15px; color: #444;"><strong>Date & time:</strong> ${escapeHtml(sessionTime)}</p>
      <p style="margin: 0 0 8px; font-size: 15px; color: #444;"><strong>Duration:</strong> 30 minutes</p>
      ${buildGuestDetailsHtml(guestDetails)}
      ${buildMeetingDetailsHtml({
        meetingId: zoomMeetingId,
        password: zoomPassword,
        startUrl: zoomStartUrl,
        joinUrl: zoomJoinUrl,
        forMentor: true,
      })}
      <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #666;">
        You can also view and join this session from your mentor dashboard under <strong>Upcoming</strong>.
      </p>
    `,
  });

  return sendMail({
    to: mentorEmail,
    subject: `Mejoric — New booking from ${guestDetails.fullName}`,
    html,
  });
};

exports.sendBookingReminderEmail = async ({
  recipientEmail,
  recipientName,
  mentorName,
  guestName,
  scheduledAt,
  slotLabel,
  minutesBefore,
  zoomMeetingId,
  zoomPassword,
  zoomJoinUrl,
  zoomStartUrl,
  forMentor,
}) => {
  const sessionTime = formatSessionDateTime(scheduledAt, slotLabel);
  const otherParty = forMentor ? guestName : mentorName;
  const title =
    minutesBefore === 30
      ? "Your session starts in 30 minutes"
      : "Your session starts in 5 minutes";

  const html = buildEmailShell({
    title,
    subtitle: `Reminder — Mejoric mentor session`,
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #444;">Dear ${escapeHtml(recipientName)},</p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        This is a reminder that your session with <strong>${escapeHtml(otherParty)}</strong>
        ${minutesBefore === 30 ? "is scheduled to begin in about 30 minutes" : "starts in 5 minutes"}.
      </p>
      <p style="margin: 0 0 8px; font-size: 15px; color: #444;"><strong>Date & time:</strong> ${escapeHtml(sessionTime)}</p>
      ${minutesBefore === 5
        ? buildMeetingDetailsHtml({
            meetingId: zoomMeetingId,
            password: zoomPassword,
            startUrl: zoomStartUrl,
            joinUrl: zoomJoinUrl,
            forMentor,
          })
        : `<p style="margin: 0; font-size: 14px; line-height: 1.7; color: #666;">The meeting link will be included in the 5-minute reminder email.</p>`
      }
    `,
  });

  return sendMail({
    to: recipientEmail,
    subject: `Mejoric — Session reminder (${minutesBefore} min) with ${otherParty}`,
    html,
  });
};
