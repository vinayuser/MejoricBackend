const mongoose = require("mongoose");
const Corporate = require("../../models/Corporate");
const CorporateInvoice = require("../../models/CorporateInvoice");
const CorporateUsageLog = require("../../models/CorporateUsageLog");
const User = require("../../models/User");
const { throwError } = require("../../utils");
const { getRemainingMinutes } = require("../../helpers/corporateBilling.helper");

const CYCLE_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function computePeriodForCycle(cycle, anchorDate = new Date()) {
  const months = CYCLE_MONTHS[cycle] || 1;
  const now = new Date(anchorDate);
  const periodStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const periodEnd = endOfDay(addMonths(periodStart, months) - 86400000);
  return { periodStart, periodEnd, billingCycle: cycle };
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `CORP-${year}-`;
  const last = await CorporateInvoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber")
    .lean();
  let seq = 1;
  if (last?.invoiceNumber) {
    const part = last.invoiceNumber.split("-").pop();
    seq = (parseInt(part, 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function buildLineItems(corporate, options = {}) {
  const items = [];
  const fee = options.platformFee ?? corporate.monthlyPlatformFee ?? 0;
  const cycle = options.billingCycle || corporate.billingCycle || "monthly";
  const cycleLabel = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    half_yearly: "Half-yearly",
    yearly: "Annual",
  }[cycle] || "Monthly";

  if (fee > 0) {
    items.push({
      type: "platform_fee",
      description: `${cycleLabel} corporate platform fee — ${corporate.name}`,
      quantity: 1,
      unitPrice: fee,
      amount: roundMoney(fee),
    });
  }

  if (options.includeMinuteBundle) {
    const audio = corporate.audioMinutesTotal || 0;
    const video = corporate.videoMinutesTotal || 0;
    const chat = corporate.chatMinutesTotal || 0;
    if (audio + video + chat > 0) {
      items.push({
        type: "minute_bundle",
        description: `Included minutes: Audio ${audio}m, Video ${video}m, Chat ${chat}m`,
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      });
    }
  }

  if (options.setupFee && options.setupFee > 0) {
    items.push({
      type: "setup_fee",
      description: "Corporate onboarding / setup fee",
      quantity: 1,
      unitPrice: options.setupFee,
      amount: roundMoney(options.setupFee),
    });
  }

  return items;
}

function calcTotals(lineItems, taxPercent = 18) {
  const subtotal = roundMoney(
    lineItems.reduce((sum, li) => sum + (li.amount || 0), 0),
  );
  const taxAmount = roundMoney(subtotal * (taxPercent / 100));
  const totalAmount = roundMoney(subtotal + taxAmount);
  return { subtotal, taxPercent, taxAmount, totalAmount };
}

function deriveInvoiceStatus(invoice) {
  if (invoice.status === "cancelled" || invoice.status === "draft") {
    return invoice.status;
  }
  const paid = invoice.amountPaid || 0;
  const total = invoice.totalAmount || 0;
  if (paid >= total && total > 0) return "paid";
  if (paid > 0 && paid < total) return "partially_paid";
  if (invoice.dueDate && new Date() > new Date(invoice.dueDate)) return "overdue";
  return "pending";
}

async function refreshInvoiceStatus(invoice) {
  const next = deriveInvoiceStatus(invoice);
  if (next !== invoice.status) {
    invoice.status = next;
    if (next === "paid" && !invoice.paidAt) {
      invoice.paidAt = new Date();
    }
    await invoice.save();
  }
  return invoice;
}

async function getCorporateById(id) {
  const corporate = await Corporate.findOne({ _id: id, isDeleted: false });
  if (!corporate) throwError(404, "Corporate account not found");
  return corporate;
}

exports.createInitialInvoices = async (corporate) => {
  const created = [];
  const termsDays = corporate.paymentTermsDays ?? 15;

  if (corporate.setupFee > 0) {
    const lineItems = buildLineItems(corporate, {
      setupFee: corporate.setupFee,
      platformFee: 0,
      includeMinuteBundle: false,
    });
    const totals = calcTotals(lineItems);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termsDays);
    const invoice = await CorporateInvoice.create({
      corporateId: corporate._id,
      invoiceNumber: await generateInvoiceNumber(),
      billingCycle: "one_time",
      periodStart: startOfDay(new Date()),
      periodEnd: endOfDay(new Date()),
      lineItems,
      ...totals,
      dueDate,
      status: "pending",
      minuteAllocation: { audio: 0, video: 0, chat: 0 },
      notes: "Setup fee invoice",
    });
    created.push(invoice);
  }

  if (corporate.monthlyPlatformFee > 0 && corporate.autoRenewInvoice !== false) {
    const cycle = corporate.billingCycle || "monthly";
    const { periodStart, periodEnd } = computePeriodForCycle(
      cycle,
      corporate.contractStartDate || new Date(),
    );
    const existing = await CorporateInvoice.findOne({
      corporateId: corporate._id,
      periodStart,
      isDeleted: false,
      billingCycle: { $ne: "one_time" },
    });
    if (!existing) {
      const lineItems = buildLineItems(corporate, { includeMinuteBundle: true });
      const totals = calcTotals(lineItems);
      const dueDate = new Date(periodStart);
      dueDate.setDate(dueDate.getDate() + termsDays);
      const invoice = await CorporateInvoice.create({
        corporateId: corporate._id,
        invoiceNumber: await generateInvoiceNumber(),
        billingCycle: cycle,
        periodStart,
        periodEnd,
        lineItems,
        ...totals,
        dueDate,
        status: "pending",
        minuteAllocation: {
          audio: corporate.audioMinutesTotal || 0,
          video: corporate.videoMinutesTotal || 0,
          chat: corporate.chatMinutesTotal || 0,
        },
      });
      created.push(invoice);
    }
  }

  return created;
};

exports.generateInvoice = async (corporateId, payload = {}) => {
  const corporate = await getCorporateById(corporateId);
  const cycle = payload.billingCycle || corporate.billingCycle || "monthly";
  const { periodStart, periodEnd } = payload.periodStart
    ? {
        periodStart: startOfDay(new Date(payload.periodStart)),
        periodEnd: endOfDay(new Date(payload.periodEnd)),
      }
    : computePeriodForCycle(cycle);

  const duplicate = await CorporateInvoice.findOne({
    corporateId,
    periodStart,
    isDeleted: false,
    status: { $ne: "cancelled" },
  });
  if (duplicate) {
    throwError(409, "An invoice already exists for this billing period");
  }

  const platformFee =
    payload.platformFee != null
      ? Number(payload.platformFee)
      : corporate.monthlyPlatformFee || 0;

  const lineItems =
    payload.lineItems?.length > 0
      ? payload.lineItems
      : buildLineItems(corporate, {
          platformFee,
          billingCycle: cycle,
          includeMinuteBundle: payload.includeMinuteBundle !== false,
          setupFee: 0,
        });

  const taxPercent = payload.taxPercent != null ? Number(payload.taxPercent) : 18;
  const totals = calcTotals(lineItems, taxPercent);
  if (totals.totalAmount <= 0) {
    throwError(422, "Invoice total must be greater than zero");
  }

  const termsDays = corporate.paymentTermsDays ?? 15;
  const dueDate = payload.dueDate
    ? new Date(payload.dueDate)
    : (() => {
        const d = new Date(periodStart);
        d.setDate(d.getDate() + termsDays);
        return d;
      })();

  return CorporateInvoice.create({
    corporateId,
    invoiceNumber: await generateInvoiceNumber(),
    billingCycle: cycle,
    periodStart,
    periodEnd,
    lineItems,
    ...totals,
    dueDate,
    status: "pending",
    notes: payload.notes?.trim() || "",
    minuteAllocation: {
      audio: corporate.audioMinutesTotal || 0,
      video: corporate.videoMinutesTotal || 0,
      chat: corporate.chatMinutesTotal || 0,
    },
  });
};

exports.recordPayment = async (invoiceId, payload = {}, adminUserId) => {
  const invoice = await CorporateInvoice.findOne({
    _id: invoiceId,
    isDeleted: false,
  });
  if (!invoice) throwError(404, "Invoice not found");
  if (invoice.status === "cancelled") {
    throwError(400, "Cannot record payment on a cancelled invoice");
  }

  const amount = roundMoney(Number(payload.amount));
  if (!amount || amount <= 0) throwError(422, "Payment amount must be positive");

  const balance = roundMoney(invoice.totalAmount - (invoice.amountPaid || 0));
  if (amount > balance + 0.01) {
    throwError(422, `Payment exceeds balance due (₹${balance})`);
  }

  invoice.payments.push({
    amount,
    paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
    method: payload.method || "bank_transfer",
    reference: payload.reference?.trim() || "",
    notes: payload.notes?.trim() || "",
    recordedBy: adminUserId,
  });
  invoice.amountPaid = roundMoney((invoice.amountPaid || 0) + amount);
  invoice.status = deriveInvoiceStatus(invoice);
  if (invoice.status === "paid") invoice.paidAt = new Date();
  await invoice.save();
  return invoice;
};

exports.listInvoices = async (corporateId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const filter = { corporateId, isDeleted: false };
  if (query.status && query.status !== "all") filter.status = query.status;

  const [data, total] = await Promise.all([
    CorporateInvoice.find(filter)
      .sort({ periodStart: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CorporateInvoice.countDocuments(filter),
  ]);

  return {
    data: data.map((inv) => ({
      ...inv,
      balanceDue: roundMoney(Math.max(0, inv.totalAmount - (inv.amountPaid || 0))),
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

exports.listUsageLogs = async (corporateId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));
  const filter = { corporateId };
  if (query.usageType && query.usageType !== "all") {
    filter.usageType = query.usageType;
  }

  const [data, total] = await Promise.all([
    CorporateUsageLog.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CorporateUsageLog.countDocuments(filter),
  ]);

  return { data, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
};

exports.getUsageStats = async (corporateId) => {
  const corpObjectId = new mongoose.Types.ObjectId(corporateId);
  const stats = await CorporateUsageLog.aggregate([
    { $match: { corporateId: corpObjectId } },
    {
      $group: {
        _id: "$usageType",
        totalMinutes: { $sum: "$minutesUsed" },
        sessions: { $sum: 1 },
      },
    },
  ]);
  const map = Object.fromEntries(stats.map((s) => [s._id, s]));
  return {
    audio: map.audio || { totalMinutes: 0, sessions: 0 },
    video: map.video || { totalMinutes: 0, sessions: 0 },
    chat: map.chat || { totalMinutes: 0, sessions: 0 },
  };
};

exports.getCorporateDashboard = async (corporateId) => {
  const corporate = await getCorporateById(corporateId);
  const corpObj = corporate.toObject();

  const memberCount = await User.countDocuments({
    corporateId,
    isDeleted: false,
  });

  let invoices = await CorporateInvoice.find({
    corporateId,
    isDeleted: false,
  })
    .sort({ periodStart: -1 })
    .lean();

  for (const inv of invoices) {
    if (["pending", "partially_paid"].includes(inv.status)) {
      const doc = await CorporateInvoice.findById(inv._id);
      if (doc) await refreshInvoiceStatus(doc);
    }
  }

  invoices = await CorporateInvoice.find({ corporateId, isDeleted: false })
    .sort({ periodStart: -1 })
    .lean();

  const usageStats = await exports.getUsageStats(corporateId);
  const recentUsage = await CorporateUsageLog.find({ corporateId })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const outstanding = invoices
    .filter((i) => ["pending", "partially_paid", "overdue"].includes(i.status))
    .reduce(
      (sum, i) => sum + Math.max(0, (i.totalAmount || 0) - (i.amountPaid || 0)),
      0,
    );

  const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  const nextDue = invoices.find((i) =>
    ["pending", "partially_paid", "overdue"].includes(i.status),
  );

  return {
    corporate: {
      ...corpObj,
      memberCount,
      audioMinutesRemaining: getRemainingMinutes(corpObj, "audio"),
      videoMinutesRemaining: getRemainingMinutes(corpObj, "video"),
      chatMinutesRemaining: getRemainingMinutes(corpObj, "chat"),
    },
    billing: {
      monthlyPlatformFee: corpObj.monthlyPlatformFee || 0,
      billingCycle: corpObj.billingCycle || "monthly",
      contractStartDate: corpObj.contractStartDate,
      contractEndDate: corpObj.contractEndDate,
      paymentTermsDays: corpObj.paymentTermsDays ?? 15,
      totalOutstanding: roundMoney(outstanding),
      totalPaid: roundMoney(totalPaid),
      nextDueInvoice: nextDue
        ? {
            ...nextDue,
            balanceDue: roundMoney(
              Math.max(0, nextDue.totalAmount - (nextDue.amountPaid || 0)),
            ),
          }
        : null,
      invoiceCount: invoices.length,
      overdueCount: invoices.filter((i) => i.status === "overdue").length,
    },
    usageStats,
    recentUsage,
    invoices: invoices.slice(0, 12).map((inv) => ({
      ...inv,
      balanceDue: roundMoney(
        Math.max(0, inv.totalAmount - (inv.amountPaid || 0)),
      ),
    })),
  };
};

exports.getBillingOverview = async () => {
  const corporates = await Corporate.find({ isDeleted: false }).lean();
  const ids = corporates.map((c) => c._id);
  const invoices = await CorporateInvoice.find({
    corporateId: { $in: ids },
    isDeleted: false,
  }).lean();

  let totalOutstanding = 0;
  let totalCollected = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    totalCollected += inv.amountPaid || 0;
    const status = deriveInvoiceStatus(inv);
    if (["pending", "partially_paid", "overdue"].includes(status)) {
      totalOutstanding += Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
      if (status === "overdue") overdueCount += 1;
    }
  }

  const monthlyRecurring = corporates
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + (c.monthlyPlatformFee || 0), 0);

  return {
    activeCorporates: corporates.filter((c) => c.isActive).length,
    totalCorporates: corporates.length,
    monthlyRecurringRevenue: roundMoney(monthlyRecurring),
    totalOutstanding: roundMoney(totalOutstanding),
    totalCollected: roundMoney(totalCollected),
    overdueInvoices: overdueCount,
  };
};

exports.listMembers = async (corporateId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const filter = { corporateId, isDeleted: false };

  const [data, total] = await Promise.all([
    User.find(filter)
      .select("name email city age createdAt isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { data, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
};

exports.logCorporateUsage = async ({
  corporateId,
  userId,
  usageType,
  minutesUsed,
  source = "call",
  referenceId,
  metadata,
}) => {
  if (!corporateId || !minutesUsed) return null;
  return CorporateUsageLog.create({
    corporateId,
    userId: userId || undefined,
    usageType,
    minutesUsed: Math.ceil(Number(minutesUsed) || 0),
    source,
    referenceId,
    metadata,
  });
};

exports.cancelInvoice = async (invoiceId) => {
  const invoice = await CorporateInvoice.findOne({
    _id: invoiceId,
    isDeleted: false,
  });
  if (!invoice) throwError(404, "Invoice not found");
  if (invoice.amountPaid > 0) {
    throwError(400, "Cannot cancel an invoice with recorded payments");
  }
  invoice.status = "cancelled";
  await invoice.save();
  return invoice;
};
