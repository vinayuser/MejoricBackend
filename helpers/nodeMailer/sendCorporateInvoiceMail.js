const { createMailTransporter, getMailCredentials } = require("./createTransporter");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const CYCLE_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Annual",
  one_time: "One-time",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "—";
  }
}

function nl2br(text = "") {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

/** Mejoric (seller) details for tax invoices — set in Server/.env */
function getMejoricBillingProfile() {
  return {
    legalName:
      process.env.MEJORIC_LEGAL_NAME?.trim() || "Mejoric",
    gstin: process.env.MEJORIC_GSTIN?.trim() || "",
    address: process.env.MEJORIC_BILLING_ADDRESS?.trim() || "",
    email:
      process.env.MEJORIC_BILLING_EMAIL?.trim() ||
      process.env.NODEMAILER_EMAIL?.trim() ||
      "support@mejoric.com",
    phone: process.env.MEJORIC_BILLING_PHONE?.trim() || "",
  };
}

function buildEmailShell({ title, subtitle, bodyHtml }) {
  return `
    <div style="max-width: 640px; margin: auto; padding: 24px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
      <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #5f4f86, #7c6ba8); padding: 24px; text-align: center;">
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

function partyBlockHtml({ heading, name, gstin, address, email, phone }) {
  return `
    <td style="width: 50%; vertical-align: top; padding: 0 8px 0 0;">
      <div style="background: #f8f7fb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; min-height: 120px;">
        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280;">
          ${escapeHtml(heading)}
        </p>
        <p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #111827;">
          ${escapeHtml(name || "—")}
        </p>
        ${
          gstin
            ? `<p style="margin: 0 0 6px; font-size: 13px; color: #374151;"><strong>GSTIN:</strong> ${escapeHtml(gstin)}</p>`
            : `<p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">GSTIN: Not provided</p>`
        }
        ${
          address
            ? `<p style="margin: 0 0 6px; font-size: 13px; color: #4b5563; line-height: 1.5;">${nl2br(address)}</p>`
            : ""
        }
        ${email ? `<p style="margin: 0 0 2px; font-size: 12px; color: #6b7280;">${escapeHtml(email)}</p>` : ""}
        ${phone ? `<p style="margin: 0; font-size: 12px; color: #6b7280;">${escapeHtml(phone)}</p>` : ""}
      </div>
    </td>
  `;
}

/**
 * Email corporate invoice to the company owner (billingContactEmail).
 * Includes GSTIN + billing addresses for both parties.
 */
async function sendCorporateInvoiceEmail({ corporate, invoice }) {
  const to = String(corporate?.billingContactEmail || "")
    .trim()
    .toLowerCase();
  if (!to) {
    console.warn(
      "[Corporate Invoice Email] Skipped — no billingContactEmail on corporate",
      corporate?._id,
    );
    return null;
  }

  const transporter = createMailTransporter();
  const { user } = getMailCredentials();
  if (!transporter) {
    console.warn(
      "[Corporate Invoice Email] Skipped — NODEMAILER_EMAIL / NODEMAILER_PASSWORD missing",
    );
    return null;
  }

  const seller = getMejoricBillingProfile();
  const ownerName =
    corporate.billingContactName?.trim() ||
    corporate.name ||
    "there";
  const isOnboarding =
    invoice.invoiceKind === "onboarding" || invoice.billingCycle === "one_time";
  const kindLabel = isOnboarding ? "Onboarding" : "Subscription";
  const periodLabel = isOnboarding
    ? "One-time"
    : `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`;
  const lineItems = invoice.lineItems || [];
  const taxPercent = invoice.taxPercent ?? 18;

  const linesHtml = lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px;">
          ${escapeHtml(item.description || "")}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 14px; text-align: right; white-space: nowrap;">
          ${escapeHtml(money(item.amount))}
        </td>
      </tr>`,
    )
    .join("");

  const loginUrl =
    process.env.CORPORATE_BASE_URL ||
    "https://corporate.mejoric.com";

  const bodyHtml = `
    <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(ownerName)},
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; color: #374151; line-height: 1.6;">
      A new <strong>${escapeHtml(kindLabel)}</strong> tax invoice has been generated for
      <strong>${escapeHtml(corporate.name || "your company")}</strong>.
    </p>

    <table style="width: 100%; border-collapse: separate; border-spacing: 0 0; margin-bottom: 20px;">
      <tr>
        ${partyBlockHtml({
          heading: "From (supplier)",
          name: seller.legalName,
          gstin: seller.gstin,
          address: seller.address,
          email: seller.email,
          phone: seller.phone,
        })}
        ${partyBlockHtml({
          heading: "Bill to (customer)",
          name: corporate.name,
          gstin: corporate.gstNumber,
          address: corporate.billingAddress,
          email: corporate.billingContactEmail,
          phone: corporate.billingContactPhone,
        })}
      </tr>
    </table>

    <div style="background: #f8f7fb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Invoice number</p>
      <p style="margin: 0 0 14px; font-size: 18px; font-weight: 700; color: #1f2937;">${escapeHtml(invoice.invoiceNumber)}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Period</td>
          <td style="padding: 4px 0; color: #111827; text-align: right;">${escapeHtml(periodLabel)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Billing cycle</td>
          <td style="padding: 4px 0; color: #111827; text-align: right;">${escapeHtml(CYCLE_LABELS[invoice.billingCycle] || invoice.billingCycle || "—")}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Due date</td>
          <td style="padding: 4px 0; color: #111827; text-align: right;">${escapeHtml(formatDate(invoice.dueDate))}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Status</td>
          <td style="padding: 4px 0; color: #111827; text-align: right; text-transform: capitalize;">${escapeHtml((invoice.status || "pending").replace(/_/g, " "))}</td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Description</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml || `<tr><td colspan="2" style="padding: 12px; color: #9ca3af; text-align: center;">No line items</td></tr>`}
      </tbody>
    </table>

    <table style="width: 100%; max-width: 280px; margin-left: auto; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 4px 0; color: #6b7280;">Subtotal</td>
        <td style="padding: 4px 0; text-align: right; color: #111827;">${escapeHtml(money(invoice.subtotal))}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #6b7280;">GST (${escapeHtml(String(taxPercent))}%)</td>
        <td style="padding: 4px 0; text-align: right; color: #111827;">${escapeHtml(money(invoice.taxAmount))}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0 4px; color: #111827; font-weight: 700; border-top: 1px solid #e5e7eb;">Total due</td>
        <td style="padding: 8px 0 4px; text-align: right; color: #111827; font-weight: 700; border-top: 1px solid #e5e7eb;">${escapeHtml(money(invoice.totalAmount))}</td>
      </tr>
    </table>

    ${
      invoice.notes
        ? `<p style="margin: 0 0 20px; font-size: 13px; color: #6b7280;"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>`
        : ""
    }

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      Please arrange payment by the due date. Sign in to your corporate dashboard for usage details:
    </p>
    <div style="text-align: center; margin: 8px 0 20px;">
      <a href="${escapeHtml(loginUrl.replace(/\/$/, ""))}/corporate/login"
         style="display: inline-block; background: #5f4f86; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Open corporate login
      </a>
    </div>
    <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
      This is a computer-generated invoice. GST has been charged at ${escapeHtml(String(taxPercent))}%.
      For billing queries, contact ${escapeHtml(seller.email)}.
    </p>
  `;

  const html = buildEmailShell({
    title: "Mejoric Tax Invoice",
    subtitle: `${kindLabel} · ${invoice.invoiceNumber}`,
    bodyHtml,
  });

  const info = await transporter.sendMail({
    from: user,
    to,
    subject: `Invoice ${invoice.invoiceNumber} — ${corporate.name || "Mejoric Corporate"} (${money(invoice.totalAmount)})`,
    html,
  });

  console.log(
    `[Corporate Invoice Email] Sent ${invoice.invoiceNumber} to ${to}`,
    info?.messageId || "",
  );
  return info;
}

module.exports = {
  sendCorporateInvoiceEmail,
  getMejoricBillingProfile,
};
