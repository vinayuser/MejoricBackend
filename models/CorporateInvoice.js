const mongoose = require("mongoose");

const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["bank_transfer", "cheque", "razorpay", "cash", "upi", "other"],
      default: "bank_transfer",
    },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true, versionKey: false },
);

const lineItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "platform_fee",
        "minute_bundle",
        "setup_fee",
        "overage",
        "adjustment",
        "other",
      ],
      default: "platform_fee",
    },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false, versionKey: false },
);

const corporateInvoiceSchema = new mongoose.Schema(
  {
    corporateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Corporate",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "half_yearly", "yearly", "one_time"],
      default: "monthly",
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 18, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"],
      default: "pending",
      index: true,
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    payments: [paymentEntrySchema],
    notes: { type: String, trim: true },
    /** Snapshot of minute allocation for this billing period */
    minuteAllocation: {
      audio: { type: Number, default: 0 },
      video: { type: Number, default: 0 },
      chat: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  { timestamps: true, versionKey: false },
);

corporateInvoiceSchema.index({ corporateId: 1, periodStart: -1 });
corporateInvoiceSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model("CorporateInvoice", corporateInvoiceSchema);
